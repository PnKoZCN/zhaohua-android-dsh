#!/usr/bin/env python3
"""v181lite8d: lite8 final + 方案B 安全分析工具包精选打包.

B1 主程序方法论(去tools/scripts) + B2 ARTEX + B3 lamda/anything-analyzer
+ B4 01客户端技能包全量 + B5 12平台文档提示词 + B6 CTF精简 + B7 学习资料md/txt
全部打进 dshhome/skills/sec-toolkit/，由 DSH 技能自动发现。
"""
import hashlib
import io
import os
import zipfile

V18_APK = "/workspace/v18/out/DeepSeekHarness-ZhaoHua-v18-unsigned.apk"
SRC_PAYLOAD = "/workspace/v18/out/payload-v181lite8.zip"
SRC_MANIFEST = "/workspace/v18/out/kernel-manifest-v181lite8.tsv"
TOOLKIT_ZIP = "/workspace/mounts/sdcard/Download/QQ/安全分析工具包-完整版-无护栏.zip"
OUT_PAYLOAD = "/workspace/v18/out/payload-v181lite8d.zip"
OUT_MANIFEST = "/workspace/v18/out/kernel-manifest-v181lite8d.tsv"
SKILL_ROOT = "dshhome/skills/sec-toolkit/"

MAX_TEXT_FILE = 500_000  # B5/B7 单文件上限（过滤大 PDF/二进制伪装）


def dec(info):
    if info.flag_bits & 0x800:
        return info.filename
    return info.filename.encode('cp437').decode('gbk', 'replace')


def add_entry(zo, name, data, mode=0o100644):
    zi = zipfile.ZipInfo(name, date_time=(2026, 10, 13, 8, 0, 0))
    zi.compress_type = zipfile.ZIP_DEFLATED
    zi.external_attr = (mode << 16)
    zi.create_system = 3
    zo.writestr(zi, data)


MAIN = "安全分析工具包-完整版/安全分析工具包/"
SL = "安全分析工具包-完整版/SkillsLibrary/"

B1_EXCLUDE = (MAIN + "tools/", MAIN + "scripts/")


def build_payload():
    z = zipfile.ZipFile(TOOLKIT_ZIP)
    base = zipfile.ZipFile(SRC_PAYLOAD)
    names = base.namelist()

    # --- 收集阶段 ---
    toolkit = {}  # rel-path under SKILL_ROOT -> bytes
    stats = {}

    def take(rel, data, bucket):
        toolkit[rel] = data
        stats[bucket] = stats.get(bucket, [0, 0])
        stats[bucket][0] += 1
        stats[bucket][1] += len(data)

    for info in z.infolist():
        if info.file_size == 0:
            continue
        n = dec(info)
        if n.endswith('/'):
            continue

        # B1: 主程序方法论（去 tools/ + scripts/）
        if n.startswith(MAIN):
            rest = n[len(MAIN):]
            if rest.startswith(('tools/', 'scripts/')):
                continue
            take(rest, z.read(info), 'B1')
            continue

        # B2: 05-ARTEX 全量
        if SL + '05-' in n:
            rest = n.split('05-漏洞挖掘与代码审计/', 1)[1] if '05-漏洞挖掘与代码审计/' in n else None
            if rest:
                take('05-ARTEX/' + rest, z.read(info), 'B2')
            continue

        # B3: 06-lamda + anything-analyzer（不含 hooker）
        for sub, label in (('lamda/', '06-lamda'), ('anything-analyzer/', '06-anything-analyzer')):
            if SL + '06-移动端逆向与协议分析/' + sub in n:
                rest = n.split(sub, 1)[1]
                if rest:
                    take(label + '/' + rest, z.read(info), 'B3')
                break
        else:
            pass

        # B4: 01-AI客户端技能包全量
        if SL + '01-AI客户端技能包/' in n:
            rest = n.split('01-AI客户端技能包/', 1)[1]
            if rest:
                take('01-client/' + rest, z.read(info), 'B4')
            continue

        # B5: 02-渗透平台 纯文本（md/txt/json/yaml，去 CIS 大数据 + 二进制）
        if SL + '02-渗透测试Agent平台/' in n:
            rest = n.split('02-渗透测试Agent平台/', 1)[1]
            base_name = rest.rsplit('/', 1)[-1].lower()
            if base_name.endswith(('.md', '.txt')) and info.file_size < MAX_TEXT_FILE:
                plat = rest.split('/')[0]
                if '.cyberstrike' not in rest:  # CIS 基准数据 29MB 排除
                    take('02-platforms/' + rest, z.read(info), 'B5')
            continue

        # B6: CTF 精简（去 blitzstrike templates/payloads 二进制）
        if SL + '03-CTF与攻防知识库/' in n:
            rest = n.split('03-CTF与攻防知识库/', 1)[1]
            skip = False
            if rest.startswith('blitzstrike/'):
                sub = rest.split('blitzstrike/', 1)[1]
                if sub.startswith(('templates/', 'payloads/')):
                    skip = True
            if not skip:
                base_name = rest.rsplit('/', 1)[-1].lower()
                if base_name.endswith(('.md', '.txt', '.py', '.json', '.yaml', '.yml', '.html')):
                    take('03-ctf/' + rest, z.read(info), 'B6')
            continue

        # B7: 07-学习资料 知识文本（md/txt 全收）
        if SL + '07-学习路线与资料索引/' in n:
            rest = n.split('07-学习路线与资料索引/', 1)[1]
            base_name = rest.rsplit('/', 1)[-1].lower()
            if base_name.endswith(('.md', '.txt')) and info.file_size < MAX_TEXT_FILE:
                take('07-learning/' + rest, z.read(info), 'B7')
            continue

    for k, (cnt, sz) in sorted(stats.items()):
        print(f"  {k}: {cnt} files, {sz/1048576:.1f} MB")
    total_sz = sum(v[1] for v in stats.values())
    total_c = sum(v[0] for v in stats.values())
    print(f"  toolkit total: {total_c} files, {total_sz/1048576:.1f} MB")

    # --- 写 payload ---
    yml_name = "dshhome/cordis.patch.yml"
    n = 0
    with zipfile.ZipFile(OUT_PAYLOAD, "w") as zo:
        for i in base.infolist():
            data = z.read if False else base.read(i.filename)  # noqa
            # fix: read from base (lite8 payload)
            zo.writestr(copy_info(i), base.read(i.filename))
            n += 1
        for rel in sorted(toolkit):
            mode = 0o100755 if rel.endswith(('.py', '.sh')) else 0o100644
            add_entry(zo, SKILL_ROOT + rel, toolkit[rel], mode)
            n += 1
    print("payload8d:", os.path.getsize(OUT_PAYLOAD), "entries:", n)


def copy_info(zi, name=None):
    zi2 = zipfile.ZipInfo(name or zi.filename, date_time=zi.date_time)
    zi2.compress_type = zi.compress_type
    zi2.external_attr = zi.external_attr
    zi2.internal_attr = zi.internal_attr
    zi2.create_system = zi.create_system
    return zi2


def build_manifest():
    z = zipfile.ZipFile(TOOLKIT_ZIP)
    base = zipfile.ZipFile(SRC_PAYLOAD)
    man_rows = []
    # toolkit manifest rows
    for info in z.infolist():
        if info.file_size == 0:
            continue
        n = dec(info)
        rel = None
        if n.startswith(MAIN):
            rest = n[len(MAIN):]
            if rest.startswith(('tools/', 'scripts/')):
                continue
            rel = rest
        elif SL + '05-' in n and '05-漏洞挖掘与代码审计/' in n:
            rest = n.split('05-漏洞挖掘与代码审计/', 1)[1]
            if rest:
                rel = '05-ARTEX/' + rest
        elif SL + '01-AI客户端技能包/' in n:
            rest = n.split('01-AI客户端技能包/', 1)[1]
            if rest:
                rel = '01-client/' + rest
        if rel:
            d = z.read(info)
            man_rows.append(f"{SKILL_ROOT}{rel}\t{len(d)}\t{hashlib.sha256(d).hexdigest()}")

    base_rows = open(SRC_MANIFEST).read().rstrip("\n")
    # write a reduced manifest (base rows unchanged; toolkit rows appended)
    open(OUT_MANIFEST, "w").write(base_rows + "\n" + "\n".join(sorted(man_rows)) + "\n")
    print("manifest8d rows:", len(man_rows) + len(base_rows.splitlines()))


def build_apk():
    zl = zipfile.ZipFile(V18_APK)
    payload = open(OUT_PAYLOAD, "rb").read()
    manifest = open(OUT_MANIFEST, "rb").read()
    FOOTER = b"""
/**
 * v1.18.1-lite8d: ZhaoHua GitHub footer (fixed bottom line).
 */
(function () {
  function addFooter() {
    try {
      var d = document.body;
      if (!d || document.getElementById('zh-footer')) return;
      var a = document.createElement('a');
      a.id = 'zh-footer';
      a.href = 'https://github.com/PnKoZCN';
      a.textContent = 'https://github.com/PnKoZCN';
      a.target = '_blank';
      a.rel = 'noopener';
      a.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483000;'
        + 'display:block;text-align:center;padding:5px 0 7px;font-size:11px;'
        + 'opacity:.6;color:inherit;text-decoration:none;background:transparent;';
      d.appendChild(a);
      d.style.paddingBottom = '30px';
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFooter);
  } else {
    addFooter();
  }
  setTimeout(addFooter, 2500);
})();
"""
    mj = zl.read("assets/mobile.js") + FOOTER
    entries = []
    for i in zl.infolist():
        if i.filename.startswith("META-INF/"):
            continue
        if i.filename == "assets/payload.zip":
            data = payload
        elif i.filename == "assets/kernel-manifest.tsv":
            data = manifest
        elif i.filename == "assets/mobile.js":
            data = mj
        else:
            data = zl.read(i.filename)
        entries.append((i.filename, i.compress_type, data, i.external_attr, i.date_time))
    OUT = "/workspace/v18/out/DeepSeekHarness-ZhaoHua-v181lite8d-unsigned.apk"
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, ctype, d, attr, dt in entries:
            zi = zipfile.ZipInfo(name, date_time=dt)
            zi.compress_type = ctype
            zi.external_attr = attr
            z.writestr(zi, d)
    probe = zipfile.ZipFile(io.BytesIO(buf.getvalue()))
    sizes = {i.filename: i.compress_size for i in probe.infolist()}
    pos = 0
    with zipfile.ZipFile(OUT, "w") as zo:
        for name, ctype, d, attr, dt in entries:
            zi = zipfile.ZipInfo(name, date_time=dt)
            zi.compress_type = ctype
            zi.external_attr = attr
            if ctype == 0:
                b = pos + 30 + len(name.encode())
                zi.extra = b"\x00" * ((-b) % 4)
            else:
                zi.extra = b""
            zo.writestr(zi, d)
            pos += 30 + len(name.encode()) + len(zi.extra) + sizes[name]
    z = zipfile.ZipFile(OUT)
    bad = sum(1 for i in z.infolist() if i.compress_type == 0 and
              (i.header_offset + 30 + len(i.filename.encode()) + len(i.extra)) % 4)
    print("apk8d:", os.path.getsize(OUT), "entries:", len(z.namelist()),
          "misaligned:", bad, "testzip:", z.testzip())


if __name__ == "__main__":
    build_payload()
    build_manifest()
    build_apk()
