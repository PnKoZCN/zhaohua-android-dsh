# ZhaoHua Android DeepSeek Harness

> 把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 打包成 Android APK，并叠加**本机 proot 沙箱**、**双设置页 UI**、**三档提示词切换**与**安全分析流水线技能库**的改造发行版。

[English](README_EN.md) · [架构文档](docs/ARCHITECTURE.md) · [构建指南](docs/BUILD.md) · [第三方开源项目](THIRD_PARTY.md) · [变更记录](CHANGELOG.md)

---

## 这是什么

DeepSeek Harness（DSH）是 DeepSeek 官方的 agent 运行时。本项目的上游基线是 [woaiys3/deepseek-harness-android-app](https://github.com/woaiys3/deepseek-harness-android-app)——它把 DSH 内核（Node + 插件树）打进 Android APK，并提供原生控制台、无障碍助手、虚拟屏、AI 浏览器等设备侧能力。

**ZhaoHua 版在其之上做四件事**：

| 能力 | 说明 | 位置 |
|---|---|---|
| **本机 proot 沙箱** | 完全不依赖外部服务器的 Linux 环境：内置 Android proot + Alpine aarch64 rootfs。命中工具链命令（git/gcc/cmake/pip…）或开关打开时，命令进沙箱执行；沙箱不可用自动回落本机 | `plugins/dsh-bash-router/` · `sandbox/` |
| **沙箱管理 UI** | DSH 设置页内的原生 React 卡片：状态探测 / 开关 / 一键安装工具箱 / 跑测试；另有 Go/Rust 工具链按需安装按钮 | `plugins/dsh-client-ui-settings-sandbox/` |
| **三档提示词切换** | 设置页内切换人格：默认（中性）/ 常规破甲 / Claude 专用。**热切换**，下一条消息即生效，无需重启 | `plugins/dsh-prompt-switch/` · `prompts/` |
| **安全分析技能库** | 20 步流水线方法论 + 12 个开源渗透 Agent 平台文档 + 逆向/CTF/移动端技能集，作为 DSH Skill 内置 | `skills/` · `scripts/pack_security_toolkit.py` |

技术底座不变：DSH 内核 `0.2.0-rc.2`，Android 壳为原生 Java + WebView。

---

## 快速开始

### 使用发行版

1. 从 [Releases](../../releases) 下载 `DeepSeekHarness-ZhaoHua-v181lite9b.apk`（约 225 MB）
2. **卸载**旧版后安装（改过 `dshhome/` 下文件时覆盖安装不会更新，见 [docs/BUILD.md](docs/BUILD.md#安装注意事项)）
3. 首次启动后在会话里说「沙箱状态」，或直接进 **设置 → 插件 → ZhaoHua 沙箱** 点「安装 / 修复工具箱」

### 从源码构建

需要 Linux 环境（本机、容器或远程构建机均可）+ JDK + Android SDK build-tools。详见 [docs/BUILD.md](docs/BUILD.md)。

```bash
# 1. 一次性：生成签名证书（纯 Python，无需 JDK）
python3 scripts/make_keystore.py --cn "Your Name" --out build

# 2. 准备沙箱资产（约 5 MB，不入库；见 vendor/README.md）
sh sandbox/make-rootfs.sh vendor
python3 sandbox/fetch-sandbox-libs.py vendor/bin
#    并把 Android aarch64 的 proot / proot-loader 放进 vendor/bin/

# 3. 一键构建：重打包 → 签名 → 从成品校验
sh scripts/build.sh <上游APK> build/sign.key.pem build/sign.cert.der build/signed.apk
```

单步等价命令：`scripts/repack.py --base <上游APK>` → `scripts/sign_apk_v2.py` → `scripts/verify.py`。

---

## 三个插件

### `@zhaohua/dsh-bash-router` — 双轨 bash 执行器

挂在 `ctx.shell` 接缝上，继承官方 `dsh-bash-local`。路由顺序：

1. 命令含 `zhaohua-sandbox.state` → 强制本机（开关操作本身永远可达）
2. 开关文件为 `on` → 全部进沙箱
3. 命中工具链关键词（git/gcc/cmake/apt/pip/qemu…）→ 进沙箱
4. 否则本机执行

沙箱调用形态：

```sh
env LD_LIBRARY_PATH=<payload>/bin \
    PROOT_LOADER=<payload>/bin/proot-loader \
    PROOT_TMP_DIR=<sandbox>/tmp \
    <payload>/bin/proot -r <rootfs> -0 -w /root --link2symlink --kill-on-exit \
      -b /dev -b /proc -b /sys -b /sdcard -b <tmp>:/tmp \
      /usr/bin/env -i TERM=xterm HOME=/root PATH=... bash -c '<命令>'
```

### `@zhaohua/dsh-client-ui-settings-sandbox` — 沙箱设置页

- **host 半**：注册 `/api/zhbox` 控制路由（status / toggle / install / test / gorust），挂在引擎的 connection 信任墙后
- **browser 半**：React 卡片，注册进 `plugins.item` 插槽（与官方设置页同级）
- 安装器脚本以 base64 内嵌，避免「设备上旧文件不被覆盖」问题

### `@zhaohua/dsh-prompt-switch` — 三档提示词切换

- 注册全局提示词变量 `zhaohua_prompt`，persona prefix 全部改为 `{{zhaohua_prompt}}` 插值
- provider 每次装配读模式文件 `$DSH_HOME/zh-prompt.mode`，**改动下一条消息生效**
- 三档各带触发词便于自检：

| 档位 | 触发词（仅此二字） | 回复 |
|---|---|---|
| 默认 | `默认` | 已成功 |
| 常规破甲 | `朝花` | 已成功 |
| Claude 专用 | `专用` | 已成功 |

---

## 本机 proot 沙箱

不依赖任何外部服务器。核心事实：

| 项 | 值 |
|---|---|
| rootfs | Alpine 3.20 aarch64，首次使用时从 `dshhome/zh-rootfs.tar.gz` 解包到 `$DSH_HOME/zh-sandbox/rootfs` |
| proot | Android NDK 构建，需 `PROOT_LOADER` 指向静态 loader；两个 bionic 依赖 `libhosdlatalloc.so` / `libandroidshmem.so` 随包 |
| 沙箱内身份 | `uid=0`（proot `-0` 假 root） |
| 工具箱 | `zh-setup` 分区安装：base / build / python / node / binutils / net / re / efficiency / pyre /（可选）gorust |
| 解包器 | `zh-extract.py`——自行解析 tar，避开发硬链接（Android 的 `/data` f2fs 与 `/sdcard` FUSE 均拒绝 `link(2)`） |

细节与排障见 [docs/SANDBOX.md](docs/SANDBOX.md)。

---

## 提示词三档

提示词全文在 [`prompts/`](prompts/)：

- `default.txt` — 中性身份 + 环境说明，不含破甲条款
- `regular.txt` — 完整 ZhaoHua 人格（身份/激活词/环境/执行原则/台账进度/稳定性/输出纪律/硬拒绝场景/禁用话术/技能路由/静态脱壳方法论/反作弊检测面/对话记录/上下文压缩/任务定向）
- `claude.txt` — 面向 Claude 系列优化：路由先行 `[ROUTE]`、输出自检（识别免责句式即整段重写）、交付契约 `RESULT→CHANGED→VERIFY→NEXT`
- `capability.txt` — 能力清单，仅在激活时按需输出（常驻文本保持中性）

设计说明见 [docs/PROMPTS.md](docs/PROMPTS.md)。

---

## 仓库结构

```
.
├── plugins/                              三个自研 DSH 插件（源码 + 构建产物）
│   ├── dsh-bash-router/                  双轨 bash 执行器（proot 沙箱）
│   ├── dsh-client-ui-settings-sandbox/   沙箱设置页（host 路由 + React 卡片）
│   └── dsh-prompt-switch/                三档提示词切换
├── skills/
│   └── sandbox-manager/                  沙箱管理技能（含一键体检脚本）
├── sandbox/
│   ├── zh-setup                          沙箱内工具箱安装器（分区幂等）
│   ├── zh-extract.py                     硬链接容错 tar 解包器
│   ├── fetch-sandbox-libs.py             从 Termux 仓库取 proot 的 bionic 依赖
│   └── make-rootfs.sh                    构建 Alpine rootfs 归档
├── prompts/                              四份提示词全文
├── scripts/
│   ├── build.sh                          一键构建（资产 → 打包 → 签名 → 校验）
│   ├── repack.py                         重打包（注入插件/改配置/对齐）
│   ├── sign_apk_v2.py                    纯 Python APK v2 签名器
│   ├── make_keystore.py                  生成自签名证书（无需 JDK）
│   ├── verify.py                         成品解包校验
│   └── reference/                        各版本实际构建脚本（留档）
├── vendor/                               沙箱运行时资产（不入库，见其 README）
├── docs/                                 架构 / 构建 / 沙箱 / 提示词文档
└── requirements.txt                      Python 依赖（cryptography）
```

---

## 上游与第三方

本项目**不是从零实现**，而是站在若干开源项目之上。完整清单、版本与许可证见 **[THIRD_PARTY.md](THIRD_PARTY.md)**。要点：

- **DSH 内核**：[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)（MIT）——agent 运行时本体
- **Android 封装基线**：[woaiys3/deepseek-harness-android-app](https://github.com/woaiys3/deepseek-harness-android-app)——APK 壳、控制台、设备侧插件
- **PRoot**：[termux/proot](https://github.com/termux/proot)（GPL-2.0）——用户态路径重写与 syscall 拦截
- **Alpine Linux**——沙箱 rootfs
- **Termux 软件包**——proot 的 talloc / libandroid-shmem 依赖
- **免费模型插件**：[Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model)——内置的免 Key 模型通道
- **提示词设计参考**：[yan-tianshi-shu/claude-code-](https://github.com/yan-tianshi-shu/claude-code-)（ColdBrew）——路由/自检/交付契约的组织方式
- **安全分析技能库**：20 步流水线方法论与 12 个渗透 Agent 平台（redamon / pentagi / strix / CyberStrike / raptor / Decepticon / VulnClaw / Pentest-Swarm-AI / reagent / mantis / cyber-harness / pentestagent）等，详见 THIRD_PARTY.md

---

## 免责

- 本项目是**技术研究性质的改造发行版**，与 DeepSeek、Anthropic、Alpine、Termux 等组织无隶属或背书关系。
- 内置的提示词档位与技能库面向**授权范围内的安全研究**。使用者需自行确保对分析目标拥有合法权限；相关风险由使用者承担。
- 本项目不修改任何模型权重、服务端策略或第三方服务条款。

## 许可证

本项目自有代码以 **MIT** 发布，见 [LICENSE](LICENSE)。随包分发的第三方组件遵循其各自许可证（THIRD_PARTY.md 逐项标注）；GPL 组件（PRoot）以独立可执行文件形式附带，未与 MIT 代码静态链接。
