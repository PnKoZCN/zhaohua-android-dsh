# 插件

三个 DSH 插件，都挂在官方开放的接缝上（设计说明见 [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)）。

| 包 | 接缝 | 作用 |
|---|---|---|
| `@zhaohua/dsh-bash-router` | `ctx.shell` | 双轨 bash 执行器：默认本机，命中工具链路由或开关打开时进本机 proot 沙箱 |
| `@zhaohua/dsh-client-ui-settings-sandbox` | `plugins.item` + `webServer` | 沙箱设置页（React 卡片）+ `/api/zhbox` 控制路由 |
| `@zhaohua/dsh-prompt-switch` | `systemPrompt.variable` | 三档提示词切换（默认 / 常规 / Claude），热生效 |

## 目录约定

```
<pkg>/
├── package.json          含 dsh.client（browser 半声明）与 exports
├── lib/index.js          host 半（Node 侧）——可直接被引擎 import
├── lib/client.js         browser 半（tsdown 产物，模块加载器闭包工厂）
└── src/                  源码
```

`lib/` 是**构建产物但入库**：让 clone 后无需 DSH 仓库就能直接重打包。

## 修改流程

- 改 **host 半**逻辑（路由/执行/文件操作）：编辑 `lib/index.js`（或 `src/index.host.ts` 后 esbuild 重出）
- 改 **browser 半**（React 卡片）：编辑 `src/client/*.tsx`，按上面 tsdown 配置重新打包
- 改 **提示词**：直接编辑 `plugins/dsh-prompt-switch/prompts/*.txt`（这些是运行时读取的文本，无需打包）
