# ZhaoHua Android DeepSeek Harness

> An Android distribution of [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) that adds an **on-device proot sandbox**, **two settings pages**, a **three-mode prompt switcher**, and a **security-analysis skill library**.

[中文](README.md) · [Architecture](docs/ARCHITECTURE.md) · [Build](docs/BUILD.md) · [Third-party](THIRD_PARTY.md) · [Changelog](CHANGELOG.md)

---

## What this is

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) is DeepSeek's agent runtime. This project starts from [woaiys3/deepseek-harness-android-app](https://github.com/woaiys3/deepseek-harness-android-app), which packages the DSH kernel (Node + plugin tree) into an Android APK with a native console, accessibility helper, virtual screen and AI browser.

**On top of that baseline, this project adds four things:**

| Capability | Description | Location |
|---|---|---|
| **On-device proot sandbox** | A full Linux environment with **no external server**: bundled Android proot + Alpine aarch64 rootfs. Toolchain commands (git/gcc/cmake/pip…) or `sandbox on` route into it; falls back to the host shell automatically | `plugins/dsh-bash-router/` · `sandbox/` |
| **Sandbox settings page** | Native React card inside DSH settings: status probe / toggle / one-click toolbox install / sandbox test, plus an on-demand Go+Rust installer | `plugins/dsh-client-ui-settings-sandbox/` |
| **Three-mode prompt switcher** | Switch persona from the settings page: Default (neutral) / Regular / Claude-optimized. **Hot swap** — effective on the next message, no restart | `plugins/dsh-prompt-switch/` · `prompts/` |
| **Security-analysis skill library** | 20-stage pipeline methodology, docs for 12 open-source pentest agent platforms, reverse-engineering / CTF / mobile skill sets, shipped as DSH Skills | `skills/` · `scripts/pack_security_toolkit.py` |

The technical base is unchanged: DSH kernel `0.2.0-rc.2`, native Java shell with a WebView.

---

## Quick start

### Use a release

1. Download `DeepSeekHarness-ZhaoHua-v181lite9b.apk` (~225 MB) from [Releases](https://github.com/PnKoZCN/zhaohua-android-dsh/releases) (sha256 in `SHA256SUMS.txt` on the same page)
2. **Uninstall** any previous version first (when `dshhome/` files changed, installing over the old one will not update them — see [docs/BUILD.md](docs/BUILD.md))
3. After first launch, say "沙箱状态" in a session, or open **Settings → Plugins → ZhaoHua Sandbox** and press "Install / repair toolbox"

### Build from source

Any Linux host works — no JDK or Android SDK needed for the repack/sign path (dex is untouched and the v2 signer is pure Python).

```bash
python3 scripts/make_keystore.py --cn "Your Name" --out build   # self-signed cert, no JDK
sh sandbox/make-rootfs.sh vendor                                # Alpine rootfs (~4 MB)
python3 sandbox/fetch-sandbox-libs.py vendor/bin                # talloc + shmem
sh scripts/build.sh <base.apk> build/sign.key.pem build/sign.cert.der build/signed.apk
```

Single steps: `scripts/repack.py --base <base.apk>` → `scripts/sign_apk_v2.py` → `scripts/verify.py`.

See [docs/BUILD.md](docs/BUILD.md).

---

## The three plugins

### `@zhaohua/dsh-bash-router` — dual-track bash executor

Registers on the `ctx.shell` seam, extending the official `@deepseek-ai/dsh-bash-local`. Routing order:

1. Command mentions `zhaohua-sandbox.state` → host (so toggling never locks you out)
2. Toggle file says `on` → sandbox (everything)
3. Command hits the toolchain keyword table → sandbox
4. Otherwise → host

Because it **extends** the official executor, all budgets (timeout, output cap, spill), cancellation and SIGTERM→SIGKILL escalation are inherited — the router only rewrites the command string.

### `@zhaohua/dsh-client-ui-settings-sandbox` — sandbox settings page

- **host half**: registers the `/api/zhbox` control route (status / toggle / install / test / gorust) behind the engine's connection trust fence
- **browser half**: React card registered into the `plugins.item` slot (same tier as official settings pages)
- The installer script is embedded as base64 in the host half, so a stale on-device copy can never win

### `@zhaohua/dsh-prompt-switch` — three-mode prompt switcher

- Registers the global prompt variable `zhaohua_prompt`; every persona prefix becomes `{{zhaohua_prompt}}`
- The provider reads `$DSH_HOME/zh-prompt.mode` on **every assembly** → hot swap
- Each mode ships a trigger word for self-verification:

| Mode | Trigger (exact) | Reply |
|---|---|---|
| Default | `默认` | 已成功 |
| Regular | `朝花` | 已成功 |
| Claude | `专用` | 已成功 |

---

## Sandbox

| Item | Value |
|---|---|
| rootfs | Alpine 3.20 aarch64, extracted on first use from `dshhome/zh-rootfs.tar.gz` |
| proot | Android NDK build; needs `PROOT_LOADER` and two bundled bionic libs (`libhosdlatalloc.so`, `libandroidshmem.so`) |
| Identity inside | `uid=0` (proot `-0`, fake root) |
| Toolbox | `zh-setup` partition install: base / build / python / node / binutils / net / re / efficiency / pyre / (opt) gorust |
| Extractor | `zh-extract.py` — parses tar itself; Android's `/data` (f2fs, inline_data) and `/sdcard` (FUSE) both reject `link(2)`, so GNU tar cannot lay down the busybox applets |

Details and 7 environment-adaptation pitfalls: [docs/SANDBOX.md](docs/SANDBOX.md).

---

## Prompts

Full text lives in [`prompts/`](prompts/):

- `default.txt` — neutral identity + environment, no guardrail clauses
- `regular.txt` — full ZhaoHua persona (identity, activation, environment, execution principles, ledger, stability, output discipline, hard-refusal scenarios, banned phrasings, skill routing, unpacking methodology, anti-cheat surfaces, notes, compaction, task routing)
- `claude.txt` — Claude-oriented: route-first `[ROUTE]`, output self-check (rewrite the whole draft if it reads like a refusal), delivery contract `RESULT→CHANGED→VERIFY→NEXT`
- `capability.txt` — the capability listing, emitted only when the trigger word matches

Design notes: [docs/PROMPTS.md](docs/PROMPTS.md).

---

## Upstream & third-party

This project is **not written from scratch**; it stands on several open-source projects. The full list with versions and licenses is in **[THIRD_PARTY.md](THIRD_PARTY.md)**. Highlights:

- **DSH kernel**: [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (MIT)
- **Android wrapper baseline**: [woaiys3/deepseek-harness-android-app](https://github.com/woaiys3/deepseek-harness-android-app) (MIT)
- **PRoot**: [termux/proot](https://github.com/termux/proot) (GPL-2.0)
- **Alpine Linux** — sandbox rootfs
- **Termux packages** — talloc / libandroid-shmem for proot
- **Free-model plugin**: [Ebony-Vinyl/dsh-our-free-model](https://github.com/Ebony-Vinyl/dsh-our-free-model) (MIT)
- **Prompt-design reference**: [yan-tianshi-shu/claude-code-](https://github.com/yan-tianshi-shu/claude-code-) (ColdBrew, source-available) — organizational ideas only, no files copied
- **Security skill library**: 20-stage pipeline methodology and 12 pentest agent platforms (redamon / pentagi / strix / CyberStrike / raptor / Decepticon / VulnClaw / Pentest-Swarm-AI / reagent / mantis / cyber-harness / pentestagent) — see THIRD_PARTY.md

---

## Disclaimer

- A technical research distribution. Not affiliated with or endorsed by DeepSeek, Anthropic, Alpine or Termux.
- The bundled prompt modes and skill library target **authorized** security research. You are responsible for ensuring you have permission for the targets you analyze.
- This project does not modify any model weights, server-side policies or third-party terms of service.

## License

Original code is **MIT** — see [LICENSE](LICENSE). Bundled third-party components keep their own licenses (annotated in THIRD_PARTY.md). GPL components (PRoot) ship as standalone executables, not statically linked with the MIT code.
