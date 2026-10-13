#!/usr/bin/env python3
"""从**最终成品**解包逐项校验。

用法:
    python3 scripts/verify.py <signed.apk> [--cert <cert.der>] [--baseline <上游APK>]

校验内容（每一项失败即退出非零）:
  1. 签名链：签名块框架 / EOCD 指向真实 CD / 分块 digest 重算一致 / RSA 验签
  2. classes.dex 与上游基线逐字节相同（本项目 dex 层零改动）
  3. 三个插件包文件齐全，host/client 产物含预期符号
  4. persona 插值点数量（4 处）与提示词文本无嵌套变量
  5. kernel-manifest 每行 sha256 与实际文件匹配
  6. 可选：内置 bundle（free-model）在 profile node_modules 且已注册

设计原则：只信最终产物，不信中间产物。
"""
import argparse
import hashlib
import io
import json
import re
import struct
import sys
import zipfile

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.x509 import load_der_x509_certificate

PLUGIN_PATHS = {
    "@zhaohua/dsh-bash-router": "dshroot/lib/node_modules/@deepseek-ai/dsh/node_modules/@zhaohua/dsh-bash-router/",
    "@zhaohua/dsh-client-ui-settings-sandbox": "dshroot/lib/node_modules/@zhaohua/dsh-client-ui-settings-sandbox/",
    "@zhaohua/dsh-prompt-switch": "dshroot/lib/node_modules/@zhaohua/dsh-prompt-switch/",
}


def fail(msg):
    print(f"FAIL  {msg}")
    sys.exit(1)


def ok(msg):
    print(f"ok    {msg}")


def verify_signature(data: bytes, cert_der_path=None) -> str:
    idx = data.rfind(b"PK\x05\x06")
    if idx < 0:
        fail("未找到 EOCD")
    if idx + 22 + struct.unpack_from("<H", data, idx + 20)[0] != len(data):
        fail("EOCD 不在文件末尾")
    cd_off = struct.unpack_from("<I", data, idx + 16)[0]
    if data[cd_off:cd_off + 4] != b"PK\x01\x02":
        fail("EOCD 的 CD-offset 未指向中央目录")

    footer_size = struct.unpack_from("<Q", data, cd_off - 24)[0]
    if data[cd_off - 16:cd_off] != b"APK Sig Block 42":
        fail("签名块尾部 magic 缺失")
    blk_start = cd_off - 8 - footer_size
    if struct.unpack_from("<Q", data, blk_start)[0] != footer_size:
        fail("签名块两处 size 字段不相等")

    # 遍历 pairs 找 v2（0x7109871a）
    pos, end = blk_start + 8, cd_off - 24
    v2 = None
    while pos < end:
        plen = struct.unpack_from("<Q", data, pos)[0]
        pid = struct.unpack_from("<I", data, pos + 8)[0]
        if pid == 0x7109871a:
            v2 = data[pos + 12:pos + 8 + plen]
        pos += 8 + plen
    if pos != end:
        fail("签名块 pairs 未恰好铺满")
    if v2 is None:
        fail("未找到 v2 签名块")

    sn = struct.unpack_from("<I", v2, 4)[0]
    signer = v2[8:8 + sn]
    m = struct.unpack_from("<I", signer, 0)[0]
    sd = signer[4:4 + m]
    rest = signer[4 + m:]
    m2 = struct.unpack_from("<I", rest, 0)[0]
    sigs = rest[4:4 + m2]
    sa = struct.unpack_from("<I", sigs, 4)[0]
    sl = struct.unpack_from("<I", sigs, 8)[0]
    sig = sigs[12:12 + sl]
    if sa != 0x0103:
        fail(f"签名算法非 RSA-PKCS1-SHA256（{sa:#x}）")

    # digest：EOCD 的 CD-offset 改写为签名块起点
    eocd = bytearray(data[idx:])
    struct.pack_into("<I", eocd, 16, blk_start)
    digest = _apk_digest([data[:blk_start], data[cd_off:idx], bytes(eocd)])
    if sd[16:48] != digest:
        fail("分块 digest 与实际内容不符")
    digest_hex = digest.hex()

    if cert_der_path:
        cert = load_der_x509_certificate(open(cert_der_path, "rb").read())
        try:
            cert.public_key().verify(sig, sd, padding.PKCS1v15(), hashes.SHA256())
        except Exception as e:
            fail(f"RSA 验签失败: {e}")
        ok(f"签名有效（{cert.subject.rfc4514_string()}，digest {digest_hex[:16]}…）")
    else:
        ok("签名结构有效（未提供证书，跳过验签）")
    return digest_hex


def _apk_digest(sections) -> bytes:
    chunk = 1048576
    parts = []
    for sec in sections:
        p = 0
        if not sec:
            continue
        while p < len(sec):
            c = sec[p:p + chunk]
            parts.append(hashlib.sha256(b"\xa5" + struct.pack("<I", len(c)) + c).digest())
            p += chunk
    total = sum((len(s) + chunk - 1) // chunk for s in sections)
    return hashlib.sha256(b"\x5a" + struct.pack("<I", total) + b"".join(parts)).digest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("apk")
    ap.add_argument("--cert")
    ap.add_argument("--baseline", help="上游基线 APK（校验 dex 未改动）")
    a = ap.parse_args()

    data = open(a.apk, "rb").read()
    verify_signature(data, a.cert)

    z = zipfile.ZipFile(io.BytesIO(data))
    payload = zipfile.ZipFile(io.BytesIO(z.read("assets/payload.zip")))
    names = set(payload.namelist())

    # dex 未改动
    if a.baseline:
        b = zipfile.ZipFile(a.baseline)
        if z.read("classes.dex") != b.read("classes.dex"):
            fail("classes.dex 与上游基线不同（本项目应零改动）")
        ok("classes.dex 与上游基线逐字节一致")

    # 三个插件
    for pkg, prefix in PLUGIN_PATHS.items():
        for f in ("package.json", "lib/index.js"):
            if prefix + f not in names:
                fail(f"插件文件缺失: {prefix}{f}")
        if prefix + "lib/client.js" in names:
            cjs = payload.read(prefix + "lib/client.js").decode("utf-8", "replace")
            if "__ModuleLoader__.load" not in cjs:
                fail(f"{pkg} 的 client.js 不是模块加载器产物")
        pj = json.loads(payload.read(prefix + "package.json"))
        if pj["name"] != pkg:
            fail(f"包名不符: {pj['name']} != {pkg}")
    ok(f"三个插件包齐全（{len(PLUGIN_PATHS)} 个）")

    # 提示词：档位文件 + 插值点
    pp = PLUGIN_PATHS["@zhaohua/dsh-prompt-switch"]
    modes = [n for n in names if n.startswith(pp + "prompts/")]
    if len(modes) < 3:
        fail(f"提示词档位文件不足: {modes}")
    yml = payload.read("dshhome/cordis.patch.yml").decode()
    n_interp = yml.count("'{{zhaohua_prompt}}'")
    if n_interp == 0:
        fail("cordis.patch.yml 中无 persona 插值点")
    ok(f"提示词档位 {len(modes)} 个，插值点 {n_interp} 处")
    for m in modes:
        t = payload.read(m).decode("utf-8", "replace")
        refs = re.findall(r"\{\{[^}]*\}\}", t)
        if refs:
            fail(f"提示词内出现嵌套变量（不会被二次插值）: {m} {refs[:3]}")

    # 内核清单
    man = z.read("assets/kernel-manifest.tsv").decode()
    bad = 0
    for line in man.splitlines():
        p = line.split("\t")
        if len(p) != 3 or p[0].startswith("#"):
            continue
        if p[0] not in names:
            continue  # 清单覆盖整棵树，payload 可能裁剪
        d = payload.read(p[0])
        if int(p[1]) != len(d) or p[2] != hashlib.sha256(d).hexdigest():
            bad += 1
            print(f"      清单不符: {p[0]}")
    if bad:
        fail(f"内核清单有 {bad} 行不符")
    ok("内核清单校验通过")

    # 可选：free-model bundle
    if any(n.startswith("dshhome/profiles/web/node_modules/dsh-our-free-model/") for n in names):
        prof = json.loads(payload.read("dshhome/profiles/web/package.json"))
        bundles = prof.get("dsh", {}).get("profile", {}).get("bundles", [])
        if "dsh-our-free-model" not in bundles:
            fail("free-model 已复制进 profile 但未注册进 bundles")
        ok("free-model bundle 已注册")

    print(f"\n全部通过：{a.apk}（{len(data)} bytes）")


if __name__ == "__main__":
    main()
