# 本机 proot 沙箱

沙箱 = **内置 Android proot + Alpine aarch64 rootfs**，完全跑在手机上，不依赖任何外部服务器。

## 为什么需要它

DSH 的 `bash` 工具默认在 Android 环境执行。Android 没有 glibc 工具链、没有包管理器、`/data` 与 `/sdcard` 的限制又多。沙箱给出一个标准 Linux：有 `apk`、能装 `gcc`/`python3`/`node`，可以编译、装包、跑脚本。

## 文件布局

| 路径 | 作用 |
|---|---|
| `bin/proot` | PRoot 主程序（Android NDK 构建，动态 PIE，需 loader） |
| `bin/proot-loader` | 静态 ELF loader（`PROOT_LOADER` 指向它） |
| `bin/libhosdlatalloc.so` | talloc 2.5.0（改名以匹配 proot 的 DT_NEEDED） |
| `bin/libandroidshmem.so` | libandroid-shmem 0.7 |
| `bin/zh-extract.py` | 硬链接容错 tar 解包器 |
| `dshhome/zh-rootfs.tar.gz` | Alpine 3.20.3 aarch64 归档（约 4 MB） |
| `dshhome/zh-setup` | 沙箱内工具箱安装器（随包分发，UI 会内嵌副本） |
| `$DSH_HOME/zh-sandbox/rootfs/` | 解包后的可运行 rootfs |
| `$DSH_HOME/zh-sandbox/tmp/` | 挂进沙箱作 `/tmp` |
| `$DSH_HOME/zh-sandbox/zhbox.sh` | host 侧手动进沙箱 |

## 环境适配（7 处硬坑）

这些都是「不修就完全跑不起来」的，逐条记下：

### 1. 沙箱目录不能放 `/sdcard`

Android 的 `/sdcard` 是 **FUSE 挂载**：`noexec`，且**不支持符号链接与硬链接**。而 Alpine rootfs 里 busybox 的 applet 全是硬链接（520 条目里 334 条是 `type=2` 符号链接指向 `/bin/busybox`）——GNU tar 对指向归档内文件的符号链接会做**硬链接优化**，于是每条都撞 `EPERM`。

**结论**：rootfs 必须解到应用私有目录（`$DSH_HOME/zh-sandbox`，f2fs，可执行、支持硬链接）。路由器因此**不做** `/sdcard` 优先判定——那种「优先外部目录」的策略会被残留的半成品遮蔽。

### 2. GNU tar 解不了这个归档 → 用 `zh-extract.py`

自己解析 tar 流，不依赖 `link(2)`：

- `type=2` 符号链接 → 原样 `os.symlink`（**关键**：不要当归档内路径去做硬链接）
- `type=1` 硬链接 → `shutil.copyfile` 复制已解出的目标
- `type=0` 常规文件 → 写出并 `chmod` + `utime`
- 尾部自检：`bin`/`sbin`/`usr/bin`/`usr/sbin` 下任何 0 字节文件改为指向 `/bin/busybox` 的符号链接

### 3. `/data` 也拒绝 `link(2)`

不只是 `/sdcard`：`/data` 是 f2fs 且带 `inline_data`，硬链接同样返回 `EPERM`。所以即使解到私有目录，**也必须用 zh-extract.py**。

### 4. proot 的两个 bionic 依赖

`proot` 是动态 ELF，`DT_NEEDED` 列出 `libhosdlatalloc.so`（talloc）与 `libandroidshmem.so`——Android 系统不带，payload 也必须自带。

**且 bionic 不搜索可执行文件所在目录**（与 glibc 不同），所以调用前必须：

```sh
env LD_LIBRARY_PATH=<payload>/bin PROOT_LOADER=<payload>/bin/proot-loader ...
```

从 Termux aarch64 仓库取这两个库：

```sh
python3 sandbox/fetch-sandbox-libs.py <payload>/bin
```

（脚本解析 Termux 的 `Packages` 索引、核对 SHA256、解 ar 归档取 `data.tar`——libtalloc 里实际文件名是 `libtalloc.so.2.5.0`，符号链接不是真文件。）

### 5. toybox 的 `timeout` 不接受 `VAR=value` 前缀

Android 的 `timeout` 是 toybox 实现，GNU coreutils 也一样：把第一个参数当作要执行的程序。所以

```sh
timeout 120 LD_LIBRARY_PATH=... proot ...     # ✗ timeout: exec LD_LIBRARY_PATH=...: No such file
timeout 120 env LD_LIBRARY_PATH=... proot ... # ✓
```

**必须用真实程序 `env` 包一层。**

### 6. 随包文件没有执行位

- `proot` / `proot-loader`：随包解出是 `0600`
- `dshhome/zh-setup`：`0644`

而 App 的 **`internal-patch` 解包策略只写不存在的文件、且不保留权限位**。所以每次 `ensureReady()` 都补 `chmod 755`（幂等、便宜）；执行脚本一律走 `sh <脚本>`（读文件执行，绕过执行位依赖）。

### 7. Alpine 精简 rootfs 不带 bash，且 PEP 668 挡 pip

- 路由器用 `bash -c` 调用 → rootfs 里必须先 `apk add bash`（`zh-setup` 第一步就是它）
- Alpine 把系统 python 标为 externally managed → `zh-setup` 写 `/etc/pip.conf` 放开 `break-system-packages`

## 工具箱分区

`zh-setup` 按分区幂等安装（探针命令已存在即跳过）：

| 分区 | 探针 | 包 |
|---|---|---|
| base | `git` | bash git curl wget unzip zip tar gzip xz file jq procps |
| build | `gcc` | build-base gcc g++ make cmake ninja pkgconf |
| python | `python3` | python3 py3-pip py3-virtualenv |
| node | `node` | nodejs npm |
| binutils | `nasm` | binutils nasm |
| net | `tcpdump` | netcat-openbsd tcpdump bind-tools |
| re | `radare2` | radare2 gdb ltrace patchelf |
| efficiency | `htop` | htop vim nano less tree diffutils patch rsync openssh-client sqlite openssl-dev |
| pyre | `pip3` | pip 装 capstone + pwntools |
| gorust（可选） | `go` | go rust cargo |
| java（可选） | `java` | openjdk21-jre-headless |

用法（脚本内）：

```sh
zh-setup                    # 默认分区
zh-setup --with-java        # 加 JRE
zh-setup --only=gorust      # 只装 Go/Rust
zh-setup --dry-run          # 只打印计划
zh-setup --list             # 列分区与探针
```

## 验证

一键体检（`skills/sandbox-manager/check-sandbox.sh`）：开关状态 → rootfs 就绪标记 → `/sdcard` 残留检查 → proot 依赖 → 硬链接能力 → 沙箱内实测（`uname`/`alpine-release`/`uid`/`bash`）→ 结论。

判据：沙箱内 `uname -s -m` 是 `Linux aarch64`，`id -u` 是 `0`。

## 排障速查

| 现象 | 原因 | 处置 |
|---|---|---|
| `tar: can't link ... Permission denied` | 用了 GNU tar 或解到 `/sdcard` | 换 zh-extract.py，解到私有目录 |
| `timeout: exec LD_LIBRARY_PATH=...` | toybox 不吃 `VAR=` 前缀 | 中间插 `env` |
| `CANNOT LINK ... libhosdlatalloc.so` | 缺 bionic 库或没设 LD_LIBRARY_PATH | 跑 `fetch-sandbox-libs.py`；调用前置 `LD_LIBRARY_PATH` |
| `can't execute: Permission denied` | 随包文件无执行位 | `chmod 755`（`ensureReady` 自愈） |
| `env: can't execute '/usr/bin/bash'` | rootfs 无 bash | `zh-setup` 第一步；或手动 `apk add bash` |
| 开关打开后 `$DSH_HOME` 找不到 | proot 重写绝对路径 | 路由器已 bind 宿主 files 目录到同路径 |
| `externally-managed-environment` | PEP 668 | 已写 `/etc/pip.conf` |
| 命令莫名进沙箱 | 关键词误命中（如路径含 `.apk`） | 命令里带上 `zhaohua-sandbox.state` 字样强制本机 |
| 改了脚本不生效 | 路由器模块引擎启动时加载一次 | 重启 App |
| 沙箱内读 `/proc/version` 被拒 | 宿主同样被拒（SELinux untrusted_app 策略） | 不是沙箱问题，忽略 |

## 已知限制

- 沙箱内 `uid=0` 是 proot 的**假 root**，不是真特权；`mount` 之类操作不可用
- `--link2symlink` 让沙箱内的硬链接变成符号链接（宿主机不支持硬链接的代价）
- proot 依赖 `ptrace`，个别 ROM 的 SELinux 策略会拦；此时可试 `PROOT_NO_SECCOMP=1`
- 沙箱 rootfs 约 700 MB（装完工具链后），位于应用私有目录——卸载 App 会一并删除
