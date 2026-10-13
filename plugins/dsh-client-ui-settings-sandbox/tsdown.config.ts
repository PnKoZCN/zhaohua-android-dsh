// 客户端（browser 半）打包配置。依赖 DSH 仓库的 tsdown 链：
//   cp -r plugins/dsh-client-ui-settings-sandbox <dsh-repo>/packages/client/
//   cd <dsh-repo>/packages/client/dsh-client-ui-settings-sandbox && pnpm exec tsdown
// 产物为 lib/client.js（window.__ModuleLoader__.load 闭包工厂）。
// 注意：tsdown 会把 lib/index.js（host 半）覆盖成空桩，host 半必须在 tsdown
// **之后**用 esbuild 重新产出（见 docs/BUILD.md）。
import { clientBundle } from '../tsdown.client.ts'

export default clientBundle('@zhaohua/dsh-client-ui-settings-sandbox', ['lib/types/index.js'])
