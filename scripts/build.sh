#!/bin/sh
# 一键构建：准备资产 -> 重打包 -> 签名 -> 校验
#
# 用法:
#   sh scripts/build.sh <上游APK> <签名密钥.pem> <证书.der> [输出APK]
#
# 首次运行前准备沙箱资产（约 5 MB，本仓库不含）：
#   sh sandbox/make-rootfs.sh vendor
#   python3 sandbox/fetch-sandbox-libs.py vendor/bin
#   # 再把 Android 版 proot 放进 vendor/bin/proot 与 vendor/bin/proot-loader
#   #（从 Termux 仓库取 proot 包，或自行用 NDK 构建）
#
# 没有沙箱资产也能构建：repack.py 会跳过缺失的资产并提示。
set -eu

BASE="${1:?用法: sh scripts/build.sh <上游APK> <key.pem> <cert.der> [out.apk]}"
KEY="${2:?缺少 key.pem}"
CERT="${3:?缺少 cert.der}"
OUT="${4:-build/signed.apk}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== 1/4 准备沙箱资产 =="
if [ ! -f vendor/zh-rootfs.tar.gz ] || [ ! -f vendor/bin/proot ]; then
  echo "vendor/ 资产不完整。请先运行："
  echo "  sh sandbox/make-rootfs.sh vendor"
  echo "  python3 sandbox/fetch-sandbox-libs.py vendor/bin"
  echo "并把 Android 版 proot / proot-loader 放到 vendor/bin/"
  echo "（继续构建仍可进行，但沙箱功能不可用）"
fi

echo "== 2/4 重打包 =="
python3 scripts/repack.py --base "$BASE" --work build --out build/unsigned.apk

echo "== 3/4 签名（APK Signature Scheme v2） =="
python3 scripts/sign_apk_v2.py build/unsigned.apk "$KEY" "$CERT" "$OUT"

echo "== 4/4 从最终成品校验 =="
python3 scripts/verify.py "$OUT" --cert "$CERT" --baseline "$BASE"

echo
echo "完成：$OUT"
echo "安装提醒：改动过 dshhome/ 下文件时必须**卸载后安装**（见 docs/BUILD.md）"
