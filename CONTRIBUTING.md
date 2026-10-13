# 贡献指南

## 项目定位

本项目是 **DSH 的 Android 改造发行版**：Android 壳零改动，所有改动落在 payload 层（三个插件 + 配置 + 技能 + 沙箱资产）。

决定要不要提交前，先看改动落在哪一层：

| 改动位置 | 影响 | 安装方式 |
|---|---|---|
| `plugins/*/src/` 源码 | 需重新构建插件 | 视产物位置 |
| `plugins/*/lib/` 产物 | 直接生效 | `dshroot/` 下 → 覆盖安装；`dshhome/` 下 → 卸载重装 |
| `prompts/` | 提示词文本 | 卸载重装（`dshhome/skills` 或插件内） |
| `sandbox/` | 沙箱脚本 | 卸载重装 |
| `scripts/` | 构建工具 | 无 |

> ⚠ **卸载重装的硬规则**：改到 `dshhome/` 下任何文件时，覆盖安装**不会**更新设备上的旧文件（原因见 [BUILD.md](docs/BUILD.md#安装注意事项)）。提交 PR 时请在描述里标明属于哪一类。

## 开发流程

1. Fork 并按需改源码
2. 本地构建：`python3 scripts/repack.py && python3 scripts/sign_apk_v2.py`
3. **必须跑校验**：`python3 scripts/verify.py` 全绿才算通过
4. 装机验证至少覆盖：启动 → 新建会话 → 设置页两个卡片 → 一次沙箱命令 → 三档提示词各发一次触发词
5. 提 PR，描述里写：改了什么、属于哪一层、验证结果

## 代码约定

### 插件（JS/TS）

- 与 DSH 的插件契约保持一致：host 半用 `export const name` / `export const inject` / `export function apply`
- 面向模型的输出**必须是产物**，不做「只解释不执行」
- 涉及文件写入时**原子写**（先写临时文件再 rename）
- 路由一律挂 `ctx.connection.requestRejection` 信任墙，未认证请求在动作前丢弃
- 注释写「为什么」，不写「做了什么」——尤其是环境适配类代码，把踩坑原因留在注释里

### 提示词（prompts/）

- **不要**在提示词里写 `{{变量}}`：插值结果不二次扫描，写了不会报错但也不会替换
- 修改 persona 时四处同步（3 个 preset + 1 个部署层）——本项目用插值规避了这个重复，但新增结构时要注意
- 三档的触发词必须互斥，改完跑一次校验

### Python（scripts/）

- 构建脚本要保持**幂等**：重复跑不产生副作用
- 校验脚本要**从最终成品解包核验**，不信任中间产物
- 不引入非标准库依赖（除非在 requirements 里显式声明）

## 报告问题

请附：

- 机型 / Android 版本 / 应用版本（APK 文件名后缀）
- 复现步骤
- 日志：`/sdcard/DeepSeekHarness/dsh-web.log`（引擎日志）、`zhaohua-import.log`（插件加载诊断，若存在）
- 若涉及沙箱：在会话里说「沙箱状态」并附上体检输出

## 许可证

提交即表示同意以 MIT 发布你的贡献。若引入新的第三方组件，请**同时更新 [THIRD_PARTY.md](THIRD_PARTY.md)**（项目名、版本、许可证、用途、分发形式），并确认许可证与本项目兼容。
