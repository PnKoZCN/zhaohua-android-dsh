---
name: sandbox-manager
description: ZhaoHua 本机 proot 沙箱管理。当用户提到 沙箱管理/沙箱状态/打开沙箱/关闭沙箱/安装沙箱工具箱/沙箱测试/工具链安装 时使用。本沙箱为完全本地的 proot + Alpine aarch64，安装与运行不依赖任何外部服务器。操作全部通过一键体检脚本 check-sandbox.sh 完成。
---

# ZhaoHua 本机 proot 沙箱

沙箱 = 本机 Alpine aarch64 rootfs + 内置 proot，全部文件在手机上，安装/运行/测试全程不需要 VPS 或 SSH。**不要为沙箱操作寻找凭据**——沙箱本体与凭据无关。若用户另有 VPS 用途（如把构建/重活转发到 VPS），按用户当次的指示处理，与本沙箱的管理流程分开。

## 唯一操作入口：一键体检脚本

所有状态检查、就绪验证、连通测试都用这一个脚本（它做：开关/rootfs/proot 依赖/硬链接能力/沙箱内实测 uname/结论 七步体检）：

```bash
bash /data/user/0/com.deepseek.harness/files/payload/dshhome/zh-sandbox/check-sandbox.sh
```

把输出原样读给用户即可。第 6 步 uname 为 `aarch64 Linux` 且 uid=0 → 沙箱工作正常；出现「已回落本地执行」→ DSH 进程未重启。

## 开关

```bash
# 开（全部命令进沙箱）
echo on > "$DSH_HOME/zhaohua-sandbox.state"
# 关（恢复默认：仅工具链命令进沙箱）
echo off > "$DSH_HOME/zhaohua-sandbox.state"
```

生效延迟 ≤5 秒。也可以引导用户走 UI：设置 → 插件 → ZhaoHua 沙箱 → 「切换沙箱开关」。

## 安装/修复工具箱

UI 按钮（设置 → 插件 → ZhaoHua 沙箱 → 安装/修复工具箱）是首选。会话内安装用：

```bash
bash "$DSH_HOME/zh-sandbox/zhbox.sh" sh /data/user/0/com.deepseek.harness/files/payload/dshhome/zh-setup-runtime.sh
```

（zh-setup-runtime.sh 由 UI 插件写入，含 base/build/python/node/binutils/net/re/efficiency/pyre 分区；Go/Rust 用 `--only=gorust`。）

## 关键事实

| 事实 | 值 |
|---|---|
| 路由优先级 | ① 命令含 `zhaohua-sandbox.state`/`zh-setup` → 强制本机；② 开关 `on` → 全部进沙箱；③ 命中工具链关键词（git/gcc/cmake/apt/pip 等）→ 进沙箱；④ 否则本机 |
| 沙箱目录 | `$DSH_HOME/zh-sandbox`（应用私有；**禁止放 /sdcard**——FUSE noexec + 无硬链接） |
| 沙箱内身份 | uid=0（proot -0），Alpine 3.20.3 aarch64 |
| 手动进沙箱 | `bash $DSH_HOME/zh-sandbox/zhbox.sh <命令>` |
| pip | 已放开 PEP 668，直接 `pip install` |

## 故障速查

| 现象 | 处置 |
|---|---|
| 「已回落本地执行」 | DSH 进程未重启（路由器不热更新），重启 App |
| tar link Permission denied | 必须用 zh-extract.py 解包（路由器已内置），手动解包别用 tar |
| CANNOT LINK ... libhosdlatalloc.so | 调 proot 前必须 `LD_LIBRARY_PATH=$PAYLOAD/bin`（zhbox.sh 已含） |
| proot can't execute | `chmod 755` proot/proot-loader |
| env: can't execute '...zh-setup' | 用 `sh <脚本>` 方式执行，绕过 exec 位 |

**验证要用真实代码路径**（跑 check-sandbox.sh 或让 UI 按钮发请求），不要手搓"等价命令"。
