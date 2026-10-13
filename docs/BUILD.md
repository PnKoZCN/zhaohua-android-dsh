# 构建指南

## 环境需求

| 用途 | 需求 |
|---|---|
| 重打包 / 签名 / 校验 | **任意 Linux** + Python 3.10+，`cryptography`（纯 Python 部分） |
| 插件开发（可选） | Node 22+ 与 pnpm 11+；DSH 仓库用于 tsdown 客户端打包 |
| 反编译 / smali（可选） | JDK 8+、`baksmali`/`smali`、`apktool` |

**最低限度只需 Python**：本项目的 dex 层零改动，签名用自实现的纯 Python 签名器，所以完整构建链不需要 JDK 或 Android SDK。

## 构建流程

```
① 取上游基线 APK（woaiys3 的 v1.19.6 发行版）
        │  提取 assets/payload.zip 与 classes.dex
        ▼
② 装配 payload
   ├─ 追加三个插件包到 dshroot/.../node_modules/@zhaohua/
   ├─ 补 dsh 的 package.json dependencies（运行时解析闭包需要）
   ├─ 改 dshhome/cordis.patch.yml（插件挂载 + persona 插值 + 压缩阈值）
   ├─ 放 rootfs / proot / bionic 库 / zh-extract.py 到 payload
   └─ 更新 assets/kernel-manifest.tsv（内核自检清单）
        ▼
③ 重打包 APK（payload STORED、其余保持压缩；STORED 条目 4 字节对齐）
        ▼
④ 签名（APK Signature Scheme v2）
        ▼
⑤ 从最终成品解包逐项校验
```

对应脚本：

```bash
python3 scripts/repack.py        # ②③
python3 scripts/sign_apk_v2.py   # ④
python3 scripts/verify.py        # ⑤
```

### 插件改动的重新打包

三个插件的**源码**在 `plugins/*/src/` 与 `plugins/dsh-bash-router/lib/index.js`；**产物**是 `lib/index.js`（host 半）与 `lib/client.js`（browser 半）。

改 client 半（React 卡片）：

```bash
# 需要 DSH 仓库的 tsdown 链
cp plugins/dsh-prompt-switch/src/client/*.ts  <dsh-repo>/packages/client/prompt-switch/src/client/
cd <dsh-repo>/packages/client/prompt-switch && pnpm exec tsdown
```

改 host 半（路由/执行逻辑）：

```bash
pnpm exec esbuild src/index.host.ts --bundle --platform=node --format=esm \
  --outfile=lib/index.js --external:node:*
```

> ⚠ **顺序坑**：`tsdown` 会把 `lib/index.js`（host 半）覆盖成空桩——因为客户端打包也认这个入口。正确顺序是 **先 tsdown，后 esbuild**；或把 host 源码放独立路径（本项目用 `src/index.host.ts`）。

## 签名

`scripts/sign_apk_v2.py` 是 **APK Signature Scheme v2 的纯 Python 实现**（RSA-PKCS1-v1.5 + SHA-256，分块 digest）。要点：

- 签名块插在中央目录前，两处 `size` 字段必须相等（都含 8 字节尾部的 size 字段 + 16 字节 magic）
- 分块 digest 对**三块**内容计算：`0..CD起点`、`CD`、**CD-offset 被改写为签名块起点的 EOCD 副本**
- 最终 EOCD 里的 CD-offset 指向**真实 CD**（验证器从 CD 反向定位签名块）

验证通过 `apksigner verify` 或 `scripts/verify.py`（后者会重算 digest 并验 RSA 签名）。

## 校验

`scripts/verify.py` 从**最终成品**解包，逐项断言：

- 签名链：块框架、EOCD 指向真实 CD、digest 重算一致、RSA 验签通过
- `classes.dex` 与上游基线**逐字节相同**
- 三个插件包文件齐全，host/client 产物含预期符号
- persona 插值点数量、prompt 文本无嵌套变量
- `kernel-manifest.tsv` 每行 sha256 与实际文件匹配
- 内置 bundle（free-model）在 profile node_modules 且已注册
- 技能库、沙箱资产在位

## 安装注意事项

> ### ⚠ 改过 `dshhome/` 下文件时，**必须卸载重装**

Android 壳的解包有四种模式（读自 `MainActivity.smali`）：

| 模式 | 行为 |
|---|---|
| `internal` | 无 `.extracted` 标记时全量解 `dshhome/` |
| `internal-patch` | **只写「文件不存在」或「在 FORCE_OVERWRITE_PREFIXES 内」的条目** |
| `dshroot` / `dshroot-add` | dshroot 侧全量或增量 |

`FORCE_OVERWRITE_PREFIXES` 只覆盖 dshroot 内的插件包、客户端 JS、`bin/`、`pnpm/`——**不含 `dshhome/` 下的普通文件**。

后果：`dshhome/cordis.patch.yml`、`zh-rootfs.tar.gz`、`skills/`、`zh-setup` 改了之后，**覆盖安装不会更新设备上的旧文件**，跑的还是旧版。

**规则**：
- 只改 `dshroot/`、`bin/`、`assets/mobile.js` → 覆盖安装生效
- 改动涉及 `dshhome/` 任何文件 → **卸载后安装**
- 无法卸载时：把目标路径加进 `FORCE_OVERWRITE_PREFIXES`（需改 dex）

本项目为此做了防御：插件 UI 把安装器脚本 base64 **内嵌**在 host 半里，运行时写出——安装器版本永远与 APK 同步，不受解包策略影响。

## 已知构建坑

| 坑 | 现象 | 处理 |
|---|---|---|
| tsdown 覆盖 host 半 | `lib/index.js` 变成 11 字节空桩 | 先 tsdown 后 esbuild；host 源码独立路径 |
| `lib/types/index.js` 缺失 | tsdown 报 `UNRESOLVED_ENTRY` | 先建 `lib/types/index.js`（内容 `export {};`） |
| 签名产物陈旧 | unsigned 比 signed 新，交付的包还是旧 payload | 每次签名后核对 unsigned 的 payload md5 与新 payload 一致 |
| YAML anchor 双插 | preset 列表出现只有 `id` 没有 `name` 的残行 → `row N names no plugin` | 插值/插入用「逐段重建」而非 `join()`；落地后用真 YAML 解析器验证 |
| 块标量缩进 | persona 插入行缩进不足，跳出块标量 | prefix 体缩进 12 空格（键缩进 10）；插入行必须同缩进 |
| 运行时解析闭包 | 插件 `failed to import`（fiber 未建立） | 把包名加进 dsh 的 `package.json` dependencies，或在 profile node_modules 注册为 bundle |
| ZIP 重复条目 | 同一路径写两次 | 构建后检查重名，保留最后一份 |
