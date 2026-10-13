# 第三方开源项目清单

本项目**不是从零实现**。它把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Android 封装与若干开源组件整合成一个发行版。本文档逐项列出所调用的开源项目、版本、许可证与使用方式。

> **许可证兼容性提示**：下表含 AGPL-3.0 与 CC-BY-NC-ND-4.0 组件。它们以**独立文件/独立文档**形式随包分发，未与 MIT 代码链接或混合编译。若你要再分发或商用，请先阅读对应许可证原文。

---

## 一、运行时核心（必需）

| 项目 | 版本 | 许可证 | 用途 | 分发形式 |
|---|---|---|---|---|
| [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | `0.2.0-rc.2` | MIT | agent 运行时本体：插件树、提示词注册表、工具接缝、会话持久化 | 原始 `payload.zip` 内的 `dshroot/`（未改动源码，仅追加插件与配置） |
| [woaiys3/deepseek-harness-android-app](https://github.com/woaiys3/deepseek-harness-android-app) | v1.19.6 基线 | MIT | APK 工程骨架：原生控制台、权限引导、无障碍助手、虚拟屏、AI 浏览器、Shizuku 通道 | 作为本项目的**上游基线**；`classes.dex` 与按键布局沿用其产物 |
| [termux/proot](https://github.com/termux/proot) | `5.1.107.92`（NDK r27d 构建） | GPL-2.0 | 用户态路径重写与 syscall 拦截，实现免 root 的 Linux 沙箱 | `bin/proot`（可执行文件，附带源码与许可证文本） |
| [termux/proot](https://github.com/termux/proot) 的静态 loader | 同版本 | GPL-2.0 | Android 上装载动态 PIE 的辅助 loader | `bin/proot-loader` |
| [Alpine Linux](https://alpinelinux.org/) | `3.20.3` (aarch64) | MIT 为主（各软件包各自许可） | 沙箱 rootfs 发行版 | `dshhome/zh-rootfs.tar.gz` |
| [Termux packages](https://github.com/termux/termux-packages) | `libtalloc 2.5.0` / `libandroid-shmem 0.7` | LGPL-3.0 / MIT | proot 的两个 bionic 依赖（Android 系统不提供） | `bin/libhosdlatalloc.so`（talloc 改名）、`bin/libandroidshmem.so` |

### DSH 插件的关键依赖（随内核分发）

| 包 | 版本 | 许可证 | 用途 |
|---|---|---|---|
| `@deepseek-ai/dsh-bash-local` | 0.2.0-rc.2 | MIT | 本机 bash 执行器基类（本项目的沙箱路由器继承它） |
| `@deepseek-ai/dsh-system-prompt` | 0.2.0-rc.2 | MIT | 提示词注册表：section / variable / 插值 |
| `@deepseek-ai/cordis` | ~4.0.4 | MIT | 插件框架与服务注入 |
| `@deepseek-ai/schemastery` | ~3.18.4 | MIT | 配置 schema 校验 |
| `@deepseek-ai/dsh-compaction-basic` | 0.2.0-rc.2 | MIT | 上下文自动压缩后端 |
| `react` | ^18.2.0 | MIT | 设置页 UI（browser 半） |

---

## 二、随包内置的第三方插件

| 项目 | 版本 | 许可证 | 用途 | 位置 |
|---|---|---|---|---|
| [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) | `2.1.0` | MIT | 免 API Key 的模型通道（DeepSeek V4.1 Flash / Kimi K3 等）；作为 DSH bundle 默认安装 | `dshhome/profiles/web/node_modules/dsh-our-free-model/` |

---

## 三、提示词设计参考

| 项目 | 许可证 | 借鉴内容 | 说明 |
|---|---|---|---|
| [yan-tianshi-shu/claude-code-](https://github.com/yan-tianshi-shu/claude-code-)（Claude ColdBrew） | ColdBrew Studio Community License v1.0（**source-available，非 OSI 开源**） | **仅参考组织方式**：路由先行、草稿自检重写、交付契约固定输出形状、激活词门控 | 未复制其任何文件、提示词文本、脚本或素材。`prompts/claude.txt` 为本项目独立撰写 |

---

## 四、安全分析技能库来源

`skills/sec-toolkit/` 内的技能文档与脚本来自下表项目（通过 [20 步流水线工具包] 汇总）。**均以文档/脚本形式内置**，不含需要 Docker/GPU 的平台运行体。

### 4.1 逆向 / 移动端 / API

| 项目 | 许可证 | 作者 | 内置内容 |
|---|---|---|---|
| [apk-reverse](https://github.com/) | MIT | apk-reverse contributors | APK 逆向脚本集（VMP 差分、重打包、so 常量patch、protobuf 解码） |
| [reverse-skill](https://github.com/) | MIT | zhaoxuya520 | 逆向方法论技能集 |
| [universal-modder](https://github.com/) | MIT | Rehan 等 | 通用模改技能 |
| [REx-skill](https://github.com/) | MIT | Norbert Tihanyi | 逆向技能 |
| [android-reverse-engineering-skill](https://github.com/) | Apache-2.0 | — | 安卓逆向技能 |
| [can-bus-reverse-engineering-skills](https://github.com/) | MIT | CSS Electronics | CAN 总线逆向 |
| [pentest-ai-agents](https://github.com/) | MIT | 0xSteph | 渗透 Agent 技能 |
| [ARTEX](https://github.com/) | **AGPL-3.0** | — | API 侦察 / 权限树 / 静态资源抓取 |
| [lamda](https://github.com/) | MIT | firerpa | 移动端协议分析客户端 |
| [anything-analyzer](https://github.com/) | Apache-2.0 | — | 任意协议分析 |
| [ghidra-mcp](https://github.com/) · [pyghidra-mcp](https://github.com/) | Apache-2.0 | — | Ghidra MCP 桥接 |
| [ida-pro-mcp](https://github.com/) | MIT | Duncan Ogilvie | IDA Pro MCP 桥接 |
| [jadx-ai-mcp](https://github.com/) | Apache-2.0 | — | jadx MCP 桥接 |
| [open-reverselab](https://github.com/) | **GPL-3.0** | — | 逆向实验台 |
| [rea](https://github.com/) | MIT | morluto | 逆向辅助 |
| [reverse-engineering-assistant](https://github.com/) | Apache-2.0 | — | 逆向助手 |

### 4.2 渗透 Agent 平台（文档/提示词部分）

| 项目 | 许可证 | 作者 | 内置内容 |
|---|---|---|---|
| [redamon](https://github.com/) | MIT | Devergo | README / 流程文档 |
| [pentagi](https://github.com/) | MIT | PentAGI 团队 | README / 架构文档 |
| [strix](https://github.com/usestrix) | Apache-2.0 | Strix | README / 文档 |
| [CyberStrike](https://cyberstrike.io/) | **AGPL-3.0** | Cyberstrike | 文档（不含其 CIS 基准数据） |
| [raptor](https://github.com/) | MIT | Gadi Evron 等 | README / 审计文档 |
| [Decepticon](https://github.com/PurpleAILAB/Decepticon) | Apache-2.0 | PurpleAILAB | README |
| [VulnClaw](https://github.com/) | MIT | UncleC | README（Kimi 开源） |
| [Pentest-Swarm-AI](https://github.com/) | **AGPL-3.0** | — | README / swarm 说明 |
| [reagent](https://github.com/) | MIT | Dryxio | README（Ghidra+LLM 逆向） |
| [mantis](https://github.com/) | Apache-2.0 | — | README |
| [cyber-harness](https://github.com/chainreactors/cyber-harness) | **AGPL-3.0** | chainreactors | README |
| [pentestagent](https://github.com/GH05TCREW/pentestagent) | MIT | Masic | README |

### 4.3 CTF / 漏洞挖掘 / 学习资料

| 项目 | 许可证 | 作者 | 内置内容 |
|---|---|---|---|
| [blitzstrike](https://github.com/) | MIT | shinthink | 手册 / 情报 / 源码（不含模板 payload） |
| [ctf-skills](https://github.com/) | MIT | Lukasz Jagiello | CTF 技能 |
| [hack-skills](https://github.com/) | MIT | VillanCh | 攻防技能 |
| [VulnHunter](https://github.com/) | Apache-2.0 | — | 漏洞挖掘 agent |
| [security-audit-skill](https://github.com/) | MIT | Cloudflare, Inc. | 安全审计技能 |
| [h4cker](https://github.com/) | MIT | Omar Santos | 攻防知识库（md/txt 部分） |
| [Reverse-Engineering](https://github.com/) | Apache-2.0 | — | 逆向学习路线（md/txt 部分） |
| [Scanners-Box](https://github.com/) | **CC-BY-NC-ND-4.0** | — | 扫描器索引 README |
| [Hacker-Roadmap](https://github.com/) | MIT | — | 学习路线 |
| [security-study-plan](https://github.com/) | MIT | — | 学习计划 |

---

## 五、方法论来源

| 来源 | 使用方式 |
|---|---|
| 20 步安全分析流水线（`shenli-unified-flow`） | `skills/sec-toolkit/SKILL.md`：阶段划分、证据分级（`[事实]`/`[静态推断]`/`[待验证]`/`[OK]`）、铁律条款 |
| 本机 proot 沙箱安装排障经验（社区整理） | `sandbox/zh-extract.py`、`docs/SANDBOX.md` 的 7 处环境适配（/sdcard 无 exec 与硬链接、toybox timeout 不吃 `VAR=` 前缀、bionic 库路径、权限位自愈、rootfs 缺 bash、宿主路径 bind、PEP 668 放开） |

---

## 六、再分发注意事项

1. **AGPL-3.0 组件**（ARTEX / CyberStrike / Pentest-Swarm-AI / cyber-harness）：以独立文档形式存在，不与本项目代码链接。若你修改这些文件并提供网络服务，需按 AGPL 开源你的修改。
2. **CC-BY-NC-ND-4.0**（Scanners-Box）：**禁止商用、禁止演绎**。商用发行前请移除该目录。
3. **GPL 组件**（proot / open-reverselab / Termux 的 talloc）：以独立可执行文件或独立文档形式分发，未静态链接进 MIT 代码。
4. **ColdBrew**：本项目仅借鉴组织思路，未复制其文件；如你另行引用其源码，请遵守其 source-available 许可证（禁止闭源再发布与商业销售）。
5. 商标：DeepSeek、Anthropic、Claude、Alpine、Termux 等名称与商标归各自权利人所有，本项目无隶属或背书关系。
