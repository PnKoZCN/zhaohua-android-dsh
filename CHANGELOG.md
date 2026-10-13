# 变更记录

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 结构，版本号对应发行 APK 的文件名后缀。

## [v18.1-lite9b] — 2026-10-13

### 新增
- **提示词切换加触发词自检**：三档各配一个触发词（`默认` / `朝花` / `专用`），发词回「已成功」，用于确认当前生效档位
- 三档触发词互斥（校验脚本断言不串扰）

### 修复
- **默认档不再返回空 persona**：此前 `default` 档 provider 返回空串，模式文件缺失时恰好落进该档，表现为「破甲完全不生效」。现在默认档加载中性提示词（`prompts/default.txt`）

---

## [v18.1-lite9] — 2026-10-13

### 新增
- **三档提示词切换插件** `@zhaohua/dsh-prompt-switch`：设置页卡片切换「默认 / 常规破甲 / Claude 专用」
- persona prefix 改为全局提示词变量 `{{zhaohua_prompt}}` 插值（4 处：3 个 agent preset + 1 个部署层）→ **热切换**，下一条消息生效，无需重启
- `prompts/claude.txt`：路由先行 + 输出自检 + 交付契约 + 激活词门控

### 变更
- 移除 `dshhome/skills/sandbox-manager/SKILL.md` 的 ZIP 重复条目

---

## [v18.1-lite8d] — 2026-10-13

### 新增
- **安全分析技能库内置**（`skills/sec-toolkit/`，6207 文件 / 93 MB）：
  - 20 步流水线方法论 + 铁律 + 证据分级
  - 12 个开源渗透 Agent 平台文档与提示词
  - APK 逆向 / 移动端协议 / API 侦察脚本集
  - CTF 技能与知识库
  - 学习路线知识文本（md/txt）

---

## [v18.1-lite8c] — 2026-10-13

### 修复
- **免费模型插件按官方 bundle 契约安装**：此前写成 `cordis.patch.yml` 的 insert 行（plugin 从未作为 bundle 装载，其自带 patch 不生效）→ 改为放进 profile 的 `node_modules` 并在 `dsh.profile.bundles` 注册

---

## [v18.1-lite8] — 2026-10-13

### 新增
- **dsh-our-free-model 2.1.0 默认安装**（免 API Key 模型通道）
- persona §13 **对话记录**：每轮对话后追加 `$DSH_HOME/notes/YYYY-MM-DD.md`
- persona §14 **上下文压缩**：阈值 `thresholdRatio 0.7` / `retainTokens 16384` / `headroomTokens 16384`（三个 preset 同步）

### 修复
- persona 插入行缩进修正（12 空格，此前 6 空格会跳出 YAML 块标量，导致 preset 插件列表解析出残行）

---

## [v18.1-lite7] — 2026-10-12

### 新增
- **沙箱管理 UI**（`@zhaohua/dsh-client-ui-settings-sandbox`）：设置页 React 卡片，含状态探测 / 开关 / 一键安装工具箱 / 沙箱测试 / Go·Rust 工具链
- host 半注册 `/api/zhbox` 控制路由（挂引擎的 connection 信任墙）
- 安装器脚本 base64 内嵌进 host 半（规避 `internal-patch` 不覆盖已存在文件的问题）

### 修复
- `TARGET` 路径定位：改用 `DSH_HOME` 的父目录（`import.meta.url` 推算层数在 pnpm 式布局下不可靠）
- 沙箱目录不再优先 `/sdcard`（FUSE 无 exec、无硬链接，残留半成品会遮蔽可用副本）

---

## [v18.1-lite6] — 2026-10-12

### 变更
- **沙箱从 SSH/VPS 改为完全本机 proot**：删除 SSH 客户端与凭据机制，命令进本机 Alpine rootfs
- 新增 `bin/proot`、`bin/proot-loader`、`dshhome/zh-rootfs.tar.gz`

---

## [v18.1-lite5] — 2026-10-12

### 新增
- 本机 proot 沙箱初版：Alpine minirootfs + 内置 Android proot
- `zh-setup` 工具箱安装器（分区幂等）

---

## [v18.1-lite4] — 2026-10-12

### 修复
- **插件装载失败根因**：包名未进 dsh 的 `package.json` dependencies → 运行时解析闭包找不到 → `failed to import`（fiber 从未建立）。加入依赖声明后 bash 工具正常注册

---

## [v18.1-lite3] — 2026-10-12

### 新增
- 插件加载诊断：给 `cordis-plugin-loader` 的 `_init` 加自报，把 import 异常落到 `/sdcard/DeepSeekHarness/zhaohua-import.log`

---

## [v18.1-lite] — 2026-10-12

### 新增
- 沙箱管理技能包 `sandbox-manager`
- 主界面底部 GitHub 行（mobile.js 注入）
- 放弃 dex 注入路线（smali 手写寄存器多次触发 VerifyError），改为纯 payload 层改造

---

## [v18] — 2026-10-12

### 新增
- 首个沙箱双轨版本：`@zhaohua/dsh-bash-router` 继承 `dsh-bash-local`，注册为 `ctx.shell`
- 路由表、开关文件、逃逸口（命令含 `zhaohua-sandbox.state` 强制本机）设计
