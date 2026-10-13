# reference/ —— 实际构建时用过的脚本（留档）

这些是**各版本实际构建时执行的脚本**，路径写死在当时的构建机上（`/workspace/v18/...`），
直接跑不起来。保留它们的目的是**可追溯**：想看某个版本具体怎么装的，读对应的文件。

日常构建请用上一层的通用脚本：

| 通用脚本 | 对应职责 | 本目录的原始脚本 |
|---|---|---|
| `../repack.py` | 重打包（注入插件/改配置/对齐） | `repack-asbuilt.py` |
| `../verify.py` | 成品解包校验 | `verify-asbuilt.py` |
| —（已并入 `../repack.py`） | 安全分析工具包精选打包 | `pack_security_toolkit.py` |

配套的 `.py` 与当时的版本对应关系见 [../../CHANGELOG.md](../../CHANGELOG.md)。
