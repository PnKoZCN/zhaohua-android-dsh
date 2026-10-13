#!/usr/bin/env python3
"""v181lite9b: 三档触发词自检版 — 仅替换 plugin 文件与 prompts。"""
import hashlib
import io
import os
import tarfile
import zipfile

SRC_PAYLOAD = "/workspace/v18/out/payload-v181lite9.zip"
SRC_MANIFEST = "/workspace/v18/out/kernel-manifest-v181lite9.tsv"
PLUGIN_TAR = "/workspace/v18/build/zh-prompt-switch.tar.gz"
OUT_PAYLOAD = "/workspace/v18/out/payload-v181lite9b.zip"
OUT_MANIFEST = "/workspace/v18/out/kernel-manifest-v181lite9b.tsv"
OUT_APK = "/workspace/v18/out/DeepSeekHarness-ZhaoHua-v181lite9b-unsigned.apk"
BASE_APK = "/workspace/v18/out/DeepSeekHarness-ZhaoHua-v181lite9-unsigned.apk"
PLUGIN_PREFIX = "dshroot/lib/node_modules/@zhaohua/dsh-prompt-switch/"


def build_payload():
    plugin = {}
    with tarfile.open(PLUGIN_TAR) as t:
        for m in t.getmembers():
            if m.isfile():
                plugin[m.name] = t.extractfile(m).read()
    z = zipfile.ZipFile(SRC_PAYLOAD)
    n = 0
    with zipfile.ZipFile(OUT_PAYLOAD, "w") as zo:
        for i in z.infolist():
            if i.filename.startswith(PLUGIN_PREFIX):
                rel = i.filename[len(PLUGIN_PREFIX):]
                if rel in plugin:
                    data = plugin.pop(rel)
                    zi = zipfile.ZipInfo(i.filename, date_time=(2026, 10, 13, 13, 0, 0))
                    zi.compress_type = zipfile.ZIP_DEFLATED
                    zi.external_attr = (0o100755 if rel.endswith(('.py',)) else 0o100644) << 16
                    zi.create_system = 3
                    zo.writestr(zi, data)
                    n += 1
                continue  # 已替换或丢弃
            zo.writestr(copy_info(i), z.read(i.filename))
            n += 1
        for rel in sorted(plugin):  # 剩余新文件（如 prompts/default.txt）
            zi = zipfile.ZipInfo(PLUGIN_PREFIX + rel, date_time=(2026, 10, 13, 13, 0, 0))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = (0o100644 << 16)
            zi.create_system = 3
            zo.writestr(zi, plugin[rel])
            n += 1
    print("payload9b:", os.path.getsize(OUT_PAYLOAD), "entries:", n)


def copy_info(zi):
    zi2 = zipfile.ZipInfo(zi.filename, date_time=zi.date_time)
    zi2.compress_type = zi.compress_type
    zi2.external_attr = zi.external_attr
    zi2.internal_attr = zi.internal_attr
    zi2.create_system = zi.create_system
    return zi2


def build_manifest():
    plugin = {}
    with tarfile.open(PLUGIN_TAR) as t:
        for m in t.getmembers():
            if m.isfile():
                plugin[m.name] = t.extractfile(m).read()
    rows = []
    for rel in sorted(plugin):
        d = plugin[rel]
        rows.append(f"{PLUGIN_PREFIX}{rel}\t{len(d)}\t{hashlib.sha256(d).hexdigest()}")
    base = open(SRC_MANIFEST).read().rstrip("\n")
    out = []
    for line in base.splitlines():
        if line.split("\t")[0].startswith(PLUGIN_PREFIX):
            continue
        out.append(line)
    open(OUT_MANIFEST, "w").write("\n".join(out) + "\n" + "\n".join(rows) + "\n")
    print("manifest9b rows:", len(rows))


def build_apk():
    zl = zipfile.ZipFile(BASE_APK)
    payload = open(OUT_PAYLOAD, "rb").read()
    manifest = open(OUT_MANIFEST, "rb").read()
    entries = []
    for i in zl.infolist():
        if i.filename.startswith("META-INF/"):
            continue
        if i.filename == "assets/payload.zip":
            data = payload
        elif i.filename == "assets/kernel-manifest.tsv":
            data = manifest
        else:
            data = zl.read(i.filename)
        entries.append((i.filename, i.compress_type, data, i.external_attr, i.date_time))
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
    with zipfile.ZipFile(OUT_APK, "w") as zo:
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
    z = zipfile.ZipFile(OUT_APK)
    bad = sum(1 for i in z.infolist() if i.compress_type == 0 and
              (i.header_offset + 30 + len(i.filename.encode()) + len(i.extra)) % 4)
    print("apk9b:", os.path.getsize(OUT_APK), "entries:", len(z.namelist()),
          "misaligned:", bad, "testzip:", z.testzip())


if __name__ == "__main__":
    build_payload()
    build_manifest()
    build_apk()
