#!/usr/bin/env python3
"""APK Signature Scheme v2 签名器（纯 Python，RSA-PKCS1-v1.5 + SHA-256）。

用法:
    python3 sign_apk_v2.py <unsigned.apk> <key.pem> <cert.der> <out.apk>

等价于 apksigner 的:
    apksigner sign --v1-signing-enabled false --v2-signing-enabled true \
                   --v3-signing-enabled false --out out.apk unsigned.apk

为什么自带一个：本项目在只有 Python 的环境（Android 上的 proot 沙箱 /
无 JDK 的构建机）里也要能签名。规范见
https://source.android.com/docs/security/features/apksigning/v2

结构要点（踩过的坑都注在代码里）：
  * 签名块插在中央目录（CD）之前；两处 size 字段必须相等
  * digest 覆盖三块：0..CD起点、CD、以及 **CD-offset 被改写为签名块起点的 EOCD 副本**
  * 最终 EOCD 里的 CD-offset 指向**真实 CD**（验证器从 CD 反向定位签名块）
"""
import hashlib
import struct
import sys

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding

CHUNK = 1048576
ALGO_RSA_PKCS1_SHA256 = 0x0103
BLOCK_ID_V2 = 0x7109871a
MAGIC = b"APK Sig Block 42"


def lp(data: bytes) -> bytes:
    """u32(长度) + 数据"""
    return struct.pack("<I", len(data)) + data


def lp_seq(items) -> bytes:
    """u32(总长度) + 各条 lp 拼接"""
    return lp(b"".join(lp(i) for i in items))


def section_digest(blob: bytes) -> bytes:
    """分块 sha256：每块前缀 \\xa5 + u32(块长)"""
    out = []
    pos = 0
    if not blob:
        return b""
    while pos < len(blob):
        chunk = blob[pos:pos + CHUNK]
        out.append(hashlib.sha256(b"\xa5" + struct.pack("<I", len(chunk)) + chunk).digest())
        pos += CHUNK
    return b"".join(out)


def apk_digest(sections) -> bytes:
    """顶层：\\x5a + u32(总分块数) + 各块摘要"""
    digests = b"".join(section_digest(s) for s in sections)
    total = sum((len(s) + CHUNK - 1) // CHUNK for s in sections)
    return hashlib.sha256(b"\x5a" + struct.pack("<I", total) + digests).digest()


def find_eocd(data: bytes) -> int:
    idx = data.rfind(b"PK\x05\x06")
    if idx < 0:
        raise ValueError("未找到 EOCD")
    if idx + 22 + struct.unpack_from("<H", data, idx + 20)[0] != len(data):
        raise ValueError("EOCD 注释长度与实际不符")
    return idx


def sign(unsigned: str, key_pem: str, cert_der: str, out: str) -> None:
    data = open(unsigned, "rb").read()
    eocd_off = find_eocd(data)
    cd_off = struct.unpack_from("<I", data, eocd_off + 16)[0]
    if data[cd_off:cd_off + 4] != b"PK\x01\x02":
        raise ValueError("EOCD 的 CD-offset 未指向中央目录")

    # digest 用的 EOCD 副本：CD-offset 改写为「签名块起点」（插块后 == 原 cd_off）
    eocd = bytearray(data[eocd_off:])
    struct.pack_into("<I", eocd, 16, cd_off)
    digest = apk_digest([data[:cd_off], data[cd_off:eocd_off], bytes(eocd)])

    key = serialization.load_pem_private_key(open(key_pem, "rb").read(), password=None)
    cert = open(cert_der, "rb").read()
    spki = key.public_key().public_bytes(
        serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)

    # signed data = digests 序列 + certs 序列 + 属性序列（各自带长度前缀，**不再整体再包一层**）
    digests_field = lp_seq([struct.pack("<I", ALGO_RSA_PKCS1_SHA256) + lp(digest)])
    certs_field = lp_seq([cert])
    attrs_field = lp_seq([])
    signed_data = digests_field + certs_field + attrs_field

    signature = key.sign(signed_data, padding.PKCS1v15(), hashes.SHA256())
    signatures_field = lp_seq([struct.pack("<I", ALGO_RSA_PKCS1_SHA256) + lp(signature)])

    # signer = lp(signed_data) + signatures 序列 + lp(spki)
    signer = lp(signed_data) + signatures_field + lp(spki)
    v2_value = lp_seq([signer])

    pair = struct.pack("<Q", len(v2_value) + 4) + struct.pack("<I", BLOCK_ID_V2) + v2_value
    # 两处 size 字段相等，值 = 块总长 - 8（pairs + size 字段 + magic）
    size_val = len(pair) + 8 + 16
    block = struct.pack("<Q", size_val) + pair + struct.pack("<Q", size_val) + MAGIC

    # 最终 EOCD：CD-offset 指向真实 CD（块尾）
    final_eocd = bytearray(data[eocd_off:])
    struct.pack_into("<I", final_eocd, 16, cd_off + len(block))
    out_bytes = data[:cd_off] + block + data[cd_off:eocd_off] + bytes(final_eocd)
    open(out, "wb").write(out_bytes)
    print(f"signed: {out}  ({len(out_bytes)} bytes)")


if __name__ == "__main__":
    if len(sys.argv) != 5:
        print(__doc__)
        sys.exit(2)
    sign(*sys.argv[1:])
