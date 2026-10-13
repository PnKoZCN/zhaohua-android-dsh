# 架构

## 全景

```
┌─────────────────────────────────────────────────────────────────┐
│  Android 壳（Java，沿用上游 woaiys3 的 APK 工程）                 │
│  MainActivity · 控制台 · 无障碍服务 · 虚拟屏桥 · WebView          │
│  ── classes.dex 未改动（本项目的改动全部在 payload 层）──          │
└────────────────────────────┬────────────────────────────────────┘
                             │ 解包 assets/payload.zip
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  DSH 引擎进程（Node v26，工作目录 files/payload/）                │
│                                                                  │
│  DSH_HOME = files/payload/dshhome ─┬─ cordis.patch.yml  补丁层    │
│                                    ├─ profiles/web/     profile  │
│                                    ├─ skills/          技能根     │
│                                    ├─ zh-prompt.mode   提示词档位 │
│                                    ├─ zh-sandbox/      沙箱实例   │
│                                    └─ notes/           会话笔记   │
│                                                                  │
│  插件树（cordis）                                                 │
│   ├─ 官方：dsh-base → dsh-web-app → 各 dsh-* 包                   │
│   ├─ 本项目：@zhaohua/dsh-bash-router          ← ctx.shell 替换   │
│   ├─ 本项目：@zhaohua/dsh-client-ui-settings-sandbox  ← 设置页   │
│   ├─ 本项目：@zhaohua/dsh-prompt-switch        ← persona 变量    │
│   └─ 第三方：dsh-our-free-model                ← 免费模型 bundle  │
└─────────────────────────────────────────────────────────────────┘
```

改动分层：**Android 壳零改动，全部落在 payload**。这让升级上游壳时冲突面最小，也是本项目能持续跟进上游的前提。

## 三个插件的接缝

### 1. `ctx.shell` —— bash 执行器接缝

DSH 用「能力接缝」（capability seam）组织工具：面向模型的 `bash` 工具不直接 spawn 进程，而是对接注册在 `ctx.shell` 上的**执行器**。官方在 POSIX 上挂 `@deepseek-ai/dsh-bash-local`，Windows 上挂 pwsh 版本。

本项目的路由器 **继承 `LocalBashExecutor`** 而非重写：

```js
class ZhaohuaBashRouter extends LocalBashExecutor {
  static inject = ['subprocess']          // 与父类一致
  get sandboxMode() { return 'workspace-write' }  // 满足 permission-presets 的构造检查

  async execute(spec) {
    const routed = await this.route(spec)
    if (!routed) return super.execute(spec)          // 本机：语义完全不变
    return super.execute({ ...spec, command: routed.command })
  }
}
```

好处：预算（超时/输出上限/spill）、取消、SIGTERM→SIGKILL 升级、进程回收全部复用父类机制，路由器只决定「拼哪条命令行」。

**路由判定**（顺序即优先级）：

```
命令含 zhaohua-sandbox.state  → 本机（开/关操作本身永远可达，否则会自锁）
开关文件内容为 on             → 沙箱（全局）
命中工具链关键词              → 沙箱（自动）
否则                          → 本机
```

### 2. `plugins.item` 插槽 —— 设置页接缝

DSH 前端的设置页是**插槽体系**：设置 shell 提供 `plugins.item` 列表插槽，每个插件包注册一项。官方 `ui-settings-shell` 等包就是这么做的。

本项目插件包结构（与官方同构）：

```
package.json          dsh.client.platform="web" + exports["./client"]
lib/index.js          host 半：注册 /api/zhbox 控制路由
lib/client.js          browser 半：tsdown 产物，window.__ModuleLoader__.load({id, factory})
```

**host 半**用引擎的 `ctx.webServer.register` 注册前缀路由，并复用同一条信任墙（`ctx.connection.requestRejection`）——未认证请求在跑任何命令前就被丢弃。

**安装器脚本内嵌**：`zh-setup` 的内容以 base64 编译进 host 半，运行时写出。原因：App 的 `internal-patch` 解包策略**只写不存在的文件**，设备上残留的旧脚本不会被覆盖安装更新——内嵌可彻底消灭这类「文件陈旧」问题。

### 3. `systemPrompt.variable` —— 提示词接缝

DSH 的提示词注册表支持 section 与 **variable**。variable 是一个 provider 函数，**每次会话装配时调用**，值用于替换 section 文本里的 `{{name}}`：

```js
ctx.systemPrompt.variable('zhaohua_prompt', () => readPrompt(MODES[readMode()]))
```

于是把 persona prefix 写成一行插值：

```yaml
prefix: '{{zhaohua_prompt}}'
```

provider 每次读模式文件 → **改文件即下一条消息生效**，无需重启引擎。这是「热切换」的实现基础。

插值语义要点（读自 `dsh-system-prompt` 源码）：
- 插值结果**不再二次扫描**（安全，提示词里可以自由写 `{`）
- 引用未注册变量会**抛错**（严格模式）
- 变量名须匹配 `[a-z][a-z0-9_]*`；provider 须**同步**返回值

## 沙箱运行时

```
$DSH_HOME/zh-sandbox/
├── rootfs/                 Alpine 3.20 aarch64（首用从 dshhome/zh-rootfs.tar.gz 解出）
├── tmp/                    挂进沙箱作 /tmp（PROOT_TMP_DIR）
└── zhbox.sh                host 侧手动进沙箱的包装脚本（插件自动生成）
```

调用链：

```
路由器 route()
  └─ ensureReady()   ← 解包 rootfs（用 zh-extract.py）、补权限位、写 resolv.conf
  └─ 拼 argv：proot -r <rootfs> -0 -w /root --link2symlink --kill-on-exit
                    -b /dev -b /proc -b /sys -b /sdcard -b <tmp>:/tmp
  └─ 前置 env LD_LIBRARY_PATH=<payload>/bin PROOT_LOADER=<loader>
  └─ super.execute()  →  ctx.subprocess  →  spawn
```

**为什么每个参数都必须**：见 [SANDBOX.md](SANDBOX.md) 的「环境适配」。

## 提示词装配链

```
system-prompt 注册表
 ├─ harness:identity              （本部署 includeHarnessIdentity: false 关闭）
 ├─ deployment:persona-prefix     ← system-prompt config.personaPrefix
 ├─ agent preset 的 dsh-persona   ← 每个 preset 各一份，**会顶掉**同名 section
 │    └─ prefix: '{{zhaohua_prompt}}'
 └─ 工具指令 / 运行时上下文
```

⚠ **关键**：preset 里的 `dsh-persona` 与部署层的 `personaPrefix` 注册**同名 section**（`PERSONA_PREFIX_SECTION`）。preset 作用域生效时，部署层那份被整段替换。因此本项目在**四处**都写了插值：3 个 preset + 1 个部署层——漏任何一处，对应模式的提示词就会失真。

## 数据流：一次沙箱命令

```
模型调用 bash 工具
  → dsh-tool-bash 构造 request
  → ctx.shell.resolve()          父类：填超时/工作目录/输出上限
  → 路由器 execute()
      → route()：读开关 + 匹配关键词 + syncExists 检查
      → ensureReady()：解包态检查（一次成功后缓存 Promise）
      → 命中：command 改写为 proot 包装串
  → 父类 execute() → ctx.subprocess.spawn(argv)
  → 沙箱内 bash 执行 → stdout/stderr 回传
  → 输出上限溢出时 spill 到临时文件（父类机制）
```

回落路径：`ensureReady()` 抛错（缺 proot / rootfs 损坏）→ 路由器在本机命令前插一行 stderr 提示后原样本机执行，**不阻塞用户任务**。

## 目录约定（部署后设备侧）

| 路径 | 内容 |
|---|---|
| `files/payload/dshroot/` | DSH 内核 + 官方插件 + 本项目三个插件 |
| `files/payload/dshhome/cordis.patch.yml` | home 级补丁层（persona 插值、插件挂载、压缩阈值） |
| `files/payload/dshhome/profiles/web/` | profile：manifest（bundle 列表）+ node_modules（第三方 bundle） |
| `files/payload/dshhome/skills/` | 技能根（DSH 自动发现，遍历深度 2） |
| `files/payload/bin/` | proot、proot-loader、两个 bionic 库、zh-extract.py |
| `files/payload/dshhome/zh-rootfs.tar.gz` | Alpine rootfs 归档（首用解包） |
| `files/payload/dshhome/zh-sandbox/` | 解包后的沙箱实例（运行时生成） |
| `files/payload/dshhome/zh-prompt.mode` | 提示词档位（运行时生成） |
| `files/payload/dshhome/notes/` | 会话笔记（运行时生成） |
