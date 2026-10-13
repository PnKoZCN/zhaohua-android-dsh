/** Locale bundles for the ZhaoHua sandbox settings page. */

/** Locale keys the page renders. */
export type SandboxLocaleKey =
  | 'title' | 'description'
  | 'status' | 'toggle' | 'install' | 'test'
  | 'toggleOn' | 'toggleOff'
  | 'rootfsReady' | 'rootfsMissing'
  | 'installing' | 'testing' | 'idle'
  | 'failed'
  | 'summaryOn' | 'summaryOff' | 'summaryNoRootfs'
  | 'gorust' | 'installingGo'

/** English copy. */
export const en: Record<SandboxLocaleKey, string> = {
  title: 'ZhaoHua Sandbox',
  description: 'Local proot sandbox (Alpine aarch64). Toolchain commands route here automatically; no external server involved.',
  status: 'Status',
  toggle: 'Toggle sandbox',
  install: 'Install / repair toolbox',
  test: 'Run sandbox test',
  toggleOn: 'on — all commands run in the sandbox',
  toggleOff: 'off — only toolchain commands route here',
  rootfsReady: 'rootfs ready',
  rootfsMissing: 'rootfs not extracted yet (installs on first use)',
  installing: 'Installing… this can take several minutes.',
  testing: 'Running…',
  idle: '',
  failed: 'Failed',
  summaryOn: 'Sandbox on — all commands run inside',
  summaryOff: 'Sandbox off — toolchain commands only',
  summaryNoRootfs: 'rootfs not extracted',
  gorust: 'Go / Rust toolchain',
  installingGo: 'Installing Go & Rust… (large download, several minutes)',
}

/** Simplified Chinese copy. */
export const zh: Record<SandboxLocaleKey, string> = {
  title: 'ZhaoHua 沙箱',
  description: '本机 proot 沙箱（Alpine aarch64）。工具链命令自动进入沙箱执行，不依赖任何外部服务器。',
  status: '状态',
  toggle: '切换沙箱开关',
  install: '安装 / 修复工具箱',
  test: '运行沙箱测试',
  toggleOn: '开 — 所有命令进沙箱',
  toggleOff: '关 — 仅工具链命令进沙箱',
  rootfsReady: 'rootfs 已就绪',
  rootfsMissing: 'rootfs 未解包（首次使用时自动安装）',
  installing: '安装中… 可能需要几分钟。',
  testing: '运行中…',
  idle: '',
  failed: '失败',
  summaryOn: '沙箱开 — 全部命令进沙箱',
  summaryOff: '沙箱关 — 仅工具链命令进沙箱',
  summaryNoRootfs: 'rootfs 未解包',
  gorust: 'Go / Rust 工具链',
  installingGo: '正在安装 Go 与 Rust…（下载较大，需要几分钟）',
}
