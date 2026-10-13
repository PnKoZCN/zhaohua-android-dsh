#!/usr/bin/env python3
"""生成签名用的密钥与证书（纯 Python，无需 JDK/keytool）。

用法:
    python3 scripts/make_keystore.py --cn "Your Name" [--out build/]

产出:
    build/sign.key.pem   RSA 2048 私钥（**绝不入库**）
    build/sign.cert.der  自签名证书（DER，APK v2 签名块用）

注意：这是**自签名**证书。Android 只校验「升级包的签名与已装包一致」，
不校验证书来源，因此自签即可正常安装与覆盖升级。同密钥可覆盖安装；
换密钥必须卸载重装。
"""
import argparse
import datetime
import os

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cn", default="ZhaoHua Code")
    ap.add_argument("--org", default="Lab")
    ap.add_argument("--country", default="CN")
    ap.add_argument("--out", default="build")
    a = ap.parse_args()

    os.makedirs(a.out, exist_ok=True)
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([
        x509.NameAttribute(NameOID.COUNTRY_NAME, a.country),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, a.org),
        x509.NameAttribute(NameOID.COMMON_NAME, a.cn),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    cert = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=10000))
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    key_path = os.path.join(a.out, "sign.key.pem")
    cert_path = os.path.join(a.out, "sign.cert.der")
    with open(key_path, "wb") as f:
        f.write(key.private_bytes(
            serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL,
            serialization.NoEncryption(),
        ))
    with open(cert_path, "wb") as f:
        f.write(cert.public_bytes(serialization.Encoding.DER))
    os.chmod(key_path, 0o600)

    print(f"私钥  {key_path}  (0600)")
    print(f"证书  {cert_path}  {cert.subject.rfc4514_string()}")
    print("提醒：私钥不要提交到版本库（.gitignore 已排除 *.pem/*.key）")


if __name__ == "__main__":
    main()
