#!/bin/sh
# 构建沙箱 rootfs 归档：下载 Alpine minirootfs，植入工具箱安装器，打包。
#
# 用法: sh sandbox/make-rootfs.sh [输出目录，默认 ./vendor]
#
# 产物: <输出目录>/zh-rootfs.tar.gz   （约 4 MB，供 repack.py 打进 payload）
#       <输出目录>/zh-setup           （安装器，同时打进 payload/dshhome）
#
# 说明：归档里只放「最小发行版 + 安装器」。真正的工具链由沙箱内 `zh-setup`
# 首次运行时用 apk 安装（走设备网络），因此归档保持 ~4 MB，APK 不必背 700 MB。
set -eu

OUT="${1:-./vendor}"
ALPINE_VER="3.20"
ALPINE_REL="${ALPINE_VER}.3"
ARCH="aarch64"
URL="https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VER}/releases/${ARCH}/alpine-minirootfs-${ALPINE_REL}-${ARCH}.tar.gz"

HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$OUT"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "[rootfs] 下载 Alpine ${ALPINE_REL} ${ARCH}"
if [ -f "$OUT/alpine-minirootfs.tar.gz" ]; then
  echo "[rootfs] 复用缓存 $OUT/alpine-minirootfs.tar.gz"
else
  curl -fsSL "$URL" -o "$OUT/alpine-minirootfs.tar.gz"
fi
echo "[rootfs] sha256: $(sha256sum "$OUT/alpine-minirootfs.tar.gz" | cut -c1-32)…"

echo "[rootfs] 解包到临时目录"
mkdir -p "$WORK/rootfs"
tar xzf "$OUT/alpine-minirootfs.tar.gz" -C "$WORK/rootfs"

echo "[rootfs] 植入安装器与基础目录"
mkdir -p "$WORK/rootfs/root/work" "$WORK/rootfs/root/share"
echo "ZhaoHua sandbox rootfs" > "$WORK/rootfs/root/.zhaohua"
cp "$HERE/zh-setup" "$WORK/rootfs/usr/bin/zh-setup"
chmod 755 "$WORK/rootfs/usr/bin/zh-setup"

# 清掉缓存与挂载点内容，减小体积
rm -rf "$WORK/rootfs/var/cache/apk"/* 2>/dev/null || true
rm -rf "$WORK/rootfs/dev"/* "$WORK/rootfs/sys"/* "$WORK/rootfs/proc"/* "$WORK/rootfs/tmp"/* 2>/dev/null || true

echo "[rootfs] 打包"
# 用 python 的 tarfile：能稳定控制条目顺序与权限位（GNU tar 的硬链接优化
# 在部分文件系统上会失败，见 docs/SANDBOX.md）
python3 - "$WORK/rootfs" "$OUT/zh-rootfs.tar.gz" <<'PY'
import os, sys, tarfile
src, dst = sys.argv[1], sys.argv[2]
with tarfile.open(dst, "w:gz") as t:
    for root, dirs, files in os.walk(src):
        dirs.sort(); files.sort()
        for name in dirs + files:
            fp = os.path.join(root, name)
            rel = os.path.relpath(fp, src)
            t.add(fp, arcname=rel, recursive=False)
print(f"[rootfs] 归档 {dst} ({os.path.getsize(dst)} bytes)")
PY

cp "$HERE/zh-setup" "$OUT/zh-setup"
chmod 755 "$OUT/zh-setup"
echo "[rootfs] 完成：$OUT/zh-rootfs.tar.gz 与 $OUT/zh-setup"
echo "[rootfs] 下一步：python3 sandbox/fetch-sandbox-libs.py $OUT/bin"
