#!/bin/bash
# 沙箱状态一键体检 —— 在 Harness 的 bash 工具里跑，或本机 shell 跑均可。
# 用法: bash check-sandbox.sh
set -u
D="${DSH_HOME:-/data/user/0/com.deepseek.harness/files/payload/dshhome}"
P="$(cd "$D/.." && pwd)"          # payload 目录
SBX="$D/zh-sandbox"
R="$SBX/rootfs"

echo "== 1. 开关 =="
printf 'zhaohua-sandbox.state = %s\n' "$(cat "$D/zhaohua-sandbox.state" 2>/dev/null || echo '(缺失)')"

echo "== 2. rootfs 就绪标记 =="
if [ -f "$R/usr/bin/zh-setup" ]; then echo "  OK   $R/usr/bin/zh-setup"; else echo "  MISS 标记缺失（路由器会重新解包）"; fi
for p in bin/bash bin/busybox sbin/apk etc/resolv.conf; do
  if [ -e "$R/$p" ] || [ -L "$R/$p" ]; then echo "  OK   $p"; else echo "  MISS $p"; fi
done

echo "== 3. /sdcard 旧沙箱是否已停用（应为不存在或 .disabled） =="
ls -d /sdcard/DeepSeekHarness/zh-sandbox 2>/dev/null && echo "  警告：/sdcard/DeepSeekHarness/zh-sandbox 仍存在，会被优先选中" || echo "  OK   未被优先选中"

echo "== 4. proot 及其依赖 =="
for f in proot proot-loader libhosdlatalloc.so libandroidshmem.so; do
  if [ -f "$P/bin/$f" ]; then echo "  OK   bin/$f"; else echo "  MISS bin/$f"; fi
done

echo "== 5. 硬链接能力（本机预期 FAIL，属正常） =="
T="$SBX/tmp"; mkdir -p "$T"
printf x > "$T/_hl1" 2>/dev/null
if ln "$T/_hl1" "$T/_hl2" 2>/dev/null; then echo "  hardlink OK（本机支持，GNU tar 也能用）"; else echo "  hardlink FAIL（本机不支持 —— 必须用 zh-extract.py 解包）"; fi
rm -f "$T/_hl1" "$T/_hl2"

echo "== 6. 直接跑一次 proot（沙箱内 uname 应为 'aarch64 Linux'） =="
LD_LIBRARY_PATH="$P/bin" PROOT_LOADER="$P/bin/proot-loader" PROOT_TMP_DIR="$T" \
  "$P/bin/proot" -r "$R" -0 -w /root --link2symlink --kill-on-exit \
  -b /dev -b /proc -b /sys -b /sdcard -b "$T:/tmp" \
  /usr/bin/env -i TERM=xterm HOME=/root PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin TMPDIR=/tmp \
  /bin/bash -c 'echo "  uname : $(uname -s) $(uname -m)"; echo "  alpine: $(cat /etc/alpine-release)"; echo "  uid   : $(id -u)"; echo "  bash  : $BASH_VERSION"' 2>&1 | sed 's/^/  /'

echo "== 7. 结论 =="
echo "  上面第 6 步有输出且 uname 为 aarch64 Linux → 沙箱本体可用。"
echo "  若 bash 工具里跑 git/uname 仍提示「已回落本地执行」→ DSH 进程未重启（路由器模块不热更新）。"
