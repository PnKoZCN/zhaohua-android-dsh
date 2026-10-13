#!/usr/bin/env python3
"""ZhaoHua 重打包：把插件、提示词插值、沙箱资产注入上游 APK 的 payload。

用法:
    python3 scripts/repack.py --base <上游APK> [--out <输出APK>] [--assets <vendor目录>]

需要的 vendor 资产（本仓库不含，体积大且与平台相关；用 sandbox/make-rootfs.sh 与
sandbox/fetch-sandbox-libs.py 准备）：
    vendor/bin/proot               PRoot 主程序（Android aarch64）
    vendor/bin/proot-loader        静态 ELF loader
    vendor/bin/libhosdlatalloc.so  talloc（改名匹配 DT_NEEDED）
    vendor/bin/libandroidshmem.so  libandroid-shmem
    vendor/zh-rootfs.tar.gz        Alpine rootfs 归档

流程:
    ① 读上游 APK 的 assets/payload.zip
    ② 注入三个插件到 dshroot/.../node_modules/@zhaohua/
    ③ 补 dsh 的 package.json dependencies（运行时解析闭包）
    ④ 改 dshhome/cordis.patch.yml：插件挂载 + persona 插值 + 压缩阈值
    ⑤ 放沙箱资产到 payload/bin 与 payload/dshhome
    ⑥ 更新 assets/kernel-manifest.tsv
    ⑦ 重打包（STORED 条目 4 字节对齐）
"""
import argparse
import hashlib
import io
import json
import os
import re
import sys
import tarfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NESTED = "dshroot/lib/node_modules/@deepseek-ai/dsh/node_modules/"
TOPLEVEL = "dshroot/lib/node_modules/"
# 每个插件的**已知可用**落点（两者都在真机验证过；不要想当然统一）：
#   * bash-router 挂在 dsh 的嵌套 node_modules 下 —— 它是被 loader 从 dsh 包内解析的
#   * 两个 UI 插件挂顶层 @zhaohua/ —— 它们走 profile patch 层解析
PLUGIN_DEST = {
    "@zhaohua/dsh-bash-router": NESTED + "@zhaohua/dsh-bash-router/",
    "@zhaohua/dsh-client-ui-settings-sandbox": TOPLEVEL + "@zhaohua/dsh-client-ui-settings-sandbox/",
    "@zhaohua/dsh-prompt-switch": TOPLEVEL + "@zhaohua/dsh-prompt-switch/",
}
FREE_MODEL_PREFIX = "dshhome/profiles/web/node_modules/dsh-our-free-model/"
MANIFEST_ENTRY = "assets/kernel-manifest.tsv"
PAYLOAD_ENTRY = "assets/payload.zip"

# 沙箱资产 → payload 内目标路径
SANDBOX_FILES = {
    "bin/proot": "bin/proot",
    "bin/proot-loader": "bin/proot-loader",
    "bin/libhosdlatalloc.so": "bin/libhosdlatalloc.so",
    "bin/libandroidshmem.so": "bin/libandroidshmem.so",
    "zh-extract.py": "bin/zh-extract.py",
    "zh-rootfs.tar.gz": "dshhome/zh-rootfs.tar.gz",
    "zh-setup": "dshhome/zh-setup",
}


def log(msg):
    print(f"[repack] {msg}")


# ---------------------------------------------------------------- payload 装配

def plugin_files():
    """收集 plugins/ 下三个插件的全部文件（产物 + 提示词）。"""
    out = {}
    base = os.path.join(ROOT, "plugins")
    if not os.path.isdir(base):
        return out
    for pkg in sorted(os.listdir(base)):
        pdir = os.path.join(base, pkg)
        if not os.path.isdir(pdir):
            continue
        name = json.load(open(os.path.join(pdir, "package.json")))["name"]
        for root, _dirs, files in os.walk(pdir):
            for f in files:
                fp = os.path.join(root, f)
                rel = os.path.relpath(fp, pdir)
                if rel.startswith("lib/types/"):
                    continue  # 类型产物不需要进运行时
                dest = PLUGIN_DEST.get(name)
                if dest is None:
                    log(f"⚠ 未登记的插件 {name}，跳过（请加入 PLUGIN_DEST）")
                    continue
                out[dest + rel] = open(fp, "rb").read()
    return out


def sandbox_files(assets_dir):
    out = {}
    for rel, dst in SANDBOX_FILES.items():
        fp = os.path.join(assets_dir, rel)
        if os.path.isfile(fp):
            out[dst] = open(fp, "rb").read()
        else:
            log(f"缺少可选沙箱资产：{fp}（跳过）")
    return out


# ---------------------------------------------------------------- 配置改写

PERSONA_VAR = "'{{zhaohua_prompt}}'"

COMPACTION_ROW = (
    "- id: compaction-basic\n"
    "            name: '@deepseek-ai/dsh-compaction-basic'"
)
COMPACTION_CFG = (
    COMPACTION_ROW + "\n"
    "            config:\n"
    "              thresholdRatio: 0.7\n"
    "              retainTokens: 16384\n"
    "              headroomTokens: 16384"
)

PLUGIN_MOUNTS = (
    "    # ZhaoHua 沙箱执行器（继承 dsh-bash-local，命中工具链路由时进本机 proot 沙箱）\n"
    "    - id: zhaohua-sandbox-ui\n"
    "      name: '@zhaohua/dsh-client-ui-settings-sandbox'\n"
    "    - id: zprompt\n"
    "      name: '@zhaohua/dsh-prompt-switch'\n"
    "      config: {}\n"
)


def patch_yml(yml: str) -> str:
    """persona 插值 + 插件挂载 + 压缩阈值。

    注意每个改动的失败模式（见 docs/BUILD.md「已知构建坑」）：
      * persona prefix 体缩进必须是 12 空格（键缩进 10）；插入行缩进不足会跳出
        块标量，导致 preset 插件列表解析出只有 id 没有 name 的残行
      * 用逐段重建而非 str.join 处理锚点，避免 anchor 被撒到片段两侧
    """
    # 1) persona：所有 prefix 块 -> 变量插值
    n_preset = len(re.findall(r"\n {10}prefix: \|-\n", yml))
    n_deploy = len(re.findall(r"\n {4}personaPrefix: \|-\n", yml))
    if n_preset or n_deploy:
        yml = re.sub(r"(\n {10}prefix: )\|-\n(?: {12}.*\n|\n)+", rf"\1{PERSONA_VAR}\n", yml)
        yml = re.sub(r"(\n {4}personaPrefix: )\|-\n(?: {6}.*\n|\n)+", rf"\1{PERSONA_VAR}\n", yml)
        log(f"persona 插值：{n_preset} 个 preset + {n_deploy} 个部署层")
        if "prefix: |-\n" in yml or "personaPrefix: |-\n" in yml:
            log("⚠ 仍有未替换的 persona 块（缩进与预期不符）；"
                "请手工确认，否则该模式下的提示词会失真")
    else:
        # 纯上游基线：没有 persona 行 —— 在每个 preset 的 plugins 列表头部注入一行。
        # 用逐段重建（split+for）而非 join，避免锚点被撒到片段两侧（见 docs/BUILD.md）
        anchor = "      plugins:\n"
        cnt = yml.count(anchor)
        if cnt:
            row = ("      plugins:\n"
                   "      - id: persona\n"
                   "        name: '@deepseek-ai/dsh-persona'\n"
                   "        config:\n"
                   f"          prefix: {PERSONA_VAR}\n")
            yml = yml.replace(anchor, row)
            log(f"persona 行已注入 {cnt} 个 preset（原本无人格）")
        else:
            log("⚠ 未找到 preset 的 plugins 列表；提示词不会加载")

    # 2) 插件挂载：锚在 home 级 insert 块的第一行之后（- insert: 下的 4 空格条目）
    anchor = "    - id: tool-browser\n      name: '@deepseek-ai/dsh-tool-browser'\n"
    if anchor in yml and "- id: zprompt" not in yml:
        yml = yml.replace(anchor, anchor + PLUGIN_MOUNTS, 1)
        log("插件挂载行已插入")
    elif "- id: zprompt" in yml:
        log("插件挂载行已存在，跳过")

    # 3) 压缩阈值（三个 preset 各一处）
    n = yml.count(COMPACTION_ROW)
    if n and "thresholdRatio: 0.7" not in yml:
        yml = yml.replace(COMPACTION_ROW, COMPACTION_CFG)
        log(f"压缩阈值已写入 {n} 处")

    return yml


def patch_dsh_deps(pkg: dict, names) -> dict:
    deps = pkg.setdefault("dependencies", {})
    for n in names:
        deps.setdefault(n, "1.0.0")
    return pkg


# ---------------------------------------------------------------- 打包

def copy_info(zi):
    zi2 = zipfile.ZipInfo(zi.filename, date_time=zi.date_time)
    zi2.compress_type = zi.compress_type
    zi2.external_attr = zi.external_attr
    zi2.internal_attr = zi.internal_attr
    zi2.create_system = zi.create_system
    return zi2


def zip_info(name, mode=0o100644):
    zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.external_attr = mode << 16
    zi.create_system = 3
    return zi


def build_payload(base_apk: str, out_payload: str, assets_dir: str):
    zin = zipfile.ZipFile(base_apk)
    src = zipfile.ZipFile(io.BytesIO(zin.read(PAYLOAD_ENTRY)))

    plugins = plugin_files()
    sandbox = sandbox_files(assets_dir)
    log(f"插件文件 {len(plugins)} 个，沙箱资产 {len(sandbox)} 个")

    dsh_pkg_name = NESTED + "package.json"
    dsh_pkg = None
    yml_name = "dshhome/cordis.patch.yml"
    yml_out = None
    if yml_name in src.namelist():
        yml_out = patch_yml(src.read(yml_name).decode()).encode()
    if dsh_pkg_name in src.namelist():
        d = json.loads(src.read(dsh_pkg_name))
        names = sorted({n.split("/")[0] + "/" + n.split("/")[1] if n.startswith("@") else n.split("/")[0]
                        for n in plugins})
        d = patch_dsh_deps(d, names)
        dsh_pkg = (json.dumps(d, indent=2, ensure_ascii=False) + "\n").encode()

    n = 0
    with zipfile.ZipFile(out_payload, "w") as zo:
        for i in src.infolist():
            if i.filename in plugins or i.filename in sandbox:
                continue  # 稍后写新版本
            if i.filename == yml_name and yml_out is not None:
                data = yml_out
            elif i.filename == dsh_pkg_name and dsh_pkg is not None:
                data = dsh_pkg
            else:
                data = src.read(i.filename)
            zo.writestr(copy_info(i), data)
            n += 1
        for name, data in sorted(plugins.items()):
            mode = 0o100755 if name.endswith(".py") else 0o100644
            zo.writestr(zip_info(name, mode), data)
            n += 1
        for name, data in sorted(sandbox.items()):
            mode = 0o100755 if name.startswith("bin/") or name.endswith(".py") else 0o100644
            zo.writestr(zip_info(name, mode), data)
            n += 1
    log(f"payload: {os.path.getsize(out_payload)} bytes, {n} entries")
    return sorted(list(plugins) + list(sandbox))


def build_manifest(base_apk, out_manifest, out_payload, changed_paths):
    """更新内核自检清单：改过的行重算，新增的行追加。"""
    zin = zipfile.ZipFile(base_apk)
    man = zin.read(MANIFEST_ENTRY).decode()
    payload = zipfile.ZipFile(out_payload)
    new_hashes = {}
    for p in changed_paths:
        if p.startswith("bin/") or p.startswith("dshhome/"):
            continue  # 沙箱资产不在 dshroot 树内，不进内核清单
        d = payload.read(p)
        new_hashes[p] = (len(d), hashlib.sha256(d).hexdigest())

    lines, seen = [], set()
    for line in man.splitlines():
        p = line.split("\t")[0]
        if p in new_hashes:
            size, sha = new_hashes[p]
            lines.append(f"{p}\t{size}\t{sha}")
            seen.add(p)
        elif p not in seen:
            lines.append(line)
    for p, (size, sha) in sorted(new_hashes.items()):
        if p not in seen:
            lines.append(f"{p}\t{size}\t{sha}")
    open(out_manifest, "w").write("\n".join(lines) + "\n")
    log(f"manifest 更新 {len(new_hashes)} 行")


def build_apk(base_apk, payload_path, manifest_path, out_apk):
    zl = zipfile.ZipFile(base_apk)
    payload = open(payload_path, "rb").read()
    manifest = open(manifest_path, "rb").read()
    entries = []
    for i in zl.infolist():
        if i.filename.startswith("META-INF/"):
            continue  # 旧签名，稍后重签
        if i.filename == PAYLOAD_ENTRY:
            data = payload
        elif i.filename == MANIFEST_ENTRY:
            data = manifest
        else:
            data = zl.read(i.filename)
        entries.append((i.filename, i.compress_type, data, i.external_attr, i.date_time))

    # 第一遍：量出各条目的压缩后大小（STORED 条目需要据此对齐）
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, ctype, d, attr, dt in entries:
            zi = zipfile.ZipInfo(name, date_time=dt)
            zi.compress_type = ctype
            zi.external_attr = attr
            z.writestr(zi, d)
    sizes = {i.filename: i.compress_size for i in zipfile.ZipFile(io.BytesIO(buf.getvalue())).infolist()}

    # 第二遍：写正式产物，STORED 条目 data 起点 4 字节对齐
    pos = 0
    with zipfile.ZipFile(out_apk, "w") as zo:
        for name, ctype, d, attr, dt in entries:
            zi = zipfile.ZipInfo(name, date_time=dt)
            zi.compress_type = ctype
            zi.external_attr = attr
            if ctype == zipfile.ZIP_STORED:
                base = pos + 30 + len(name.encode())
                zi.extra = b"\x00" * ((-base) % 4)
            else:
                zi.extra = b""
            zo.writestr(zi, d)
            pos += 30 + len(name.encode()) + len(zi.extra) + sizes[name]

    z = zipfile.ZipFile(out_apk)
    bad = [i.filename for i in z.infolist() if i.compress_type == 0 and
           (i.header_offset + 30 + len(i.filename.encode()) + len(i.extra)) % 4]
    log(f"APK: {os.path.getsize(out_apk)} bytes, {len(z.namelist())} entries, "
        f"错位 {len(bad)} 个, testzip={z.testzip()}")
    if bad:
        log(f"⚠ 未对齐: {bad}")


def main():
    ap = argparse.ArgumentParser(description="ZhaoHua 重打包")
    ap.add_argument("--base", required=True, help="上游/基线 APK")
    ap.add_argument("--assets", default=os.path.join(ROOT, "vendor"), help="沙箱资产目录")
    ap.add_argument("--work", default=os.path.join(ROOT, "build"), help="中间产物目录")
    ap.add_argument("--out", help="输出未签名 APK 路径")
    a = ap.parse_args()

    os.makedirs(a.work, exist_ok=True)
    out_payload = os.path.join(a.work, "payload.zip")
    out_manifest = os.path.join(a.work, "kernel-manifest.tsv")
    out_apk = a.out or os.path.join(a.work, "unsigned.apk")

    changed = build_payload(a.base, out_payload, a.assets)
    build_manifest(a.base, out_manifest, out_payload, changed)
    build_apk(a.base, out_payload, out_manifest, out_apk)
    log("完成。下一步：")
    log(f"  python3 scripts/sign_apk_v2.py {out_apk} <key.pem> <cert.der> <signed.apk>")


if __name__ == "__main__":
    main()
