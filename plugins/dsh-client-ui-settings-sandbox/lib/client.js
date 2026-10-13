window.__ModuleLoader__.load({
	id: "@zhaohua/dsh-client-ui-settings-sandbox",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/SandboxCard.tsx
		/** The ZhaoHua sandbox settings card: summary row + full detail card. */
		/** Locale copy for the summary one-liner, computed from live state. */
		function summaryText(status, dict) {
			const toggle = status?.toggle === "on" ? dict.summaryOn : dict.summaryOff;
			return status?.rootfsReady === true ? toggle : `${toggle} · ${dict.summaryNoRootfs}`;
		}
		/**
		* Render the sandbox entry. The Plugins page asks for the one-liner
		* (`view === 'summary'`) and the full card separately; the summary reflects
		* the live toggle state so the list row reads at a glance.
		*/
		function SandboxCard(props) {
			const t = props.t;
			const [status, setStatus] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)("");
			const [output, setOutput] = (0, react.useState)("");
			const [error, setError] = (0, react.useState)("");
			const refresh = (0, react.useCallback)(async () => {
				try {
					const res = await fetch("/api/zhbox/status");
					const body = await res.json();
					if (res.ok) setStatus(body);
				} catch {}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
			}, [refresh]);
			(0, react.useEffect)(() => {
				const onVis = () => {
					if (document.visibilityState === "visible") refresh();
				};
				document.addEventListener("visibilitychange", onVis);
				return () => document.removeEventListener("visibilitychange", onVis);
			}, [refresh]);
			const post = async (action) => {
				setBusy(action);
				setError("");
				try {
					const res = await fetch(`/api/zhbox/${action}`, { method: "POST" });
					const body = await res.json();
					if (!res.ok) throw new Error(String(body.error ?? res.status));
					if (action === "toggle") setStatus((s) => ({
						...s ?? {},
						toggle: String(body.toggle ?? "off")
					}));
					else setOutput(String(body.output ?? ""));
					await refresh();
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				}
				setBusy("");
			};
			if (props.view === "summary") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: summaryText(status, props.lang === "en" ? {
				summaryOn: "Sandbox on — all commands run inside",
				summaryOff: "Sandbox off — toolchain commands only",
				summaryNoRootfs: "rootfs not extracted"
			} : {
				summaryOn: "沙箱开 — 全部命令进沙箱",
				summaryOff: "沙箱关 — 仅工具链命令进沙箱",
				summaryNoRootfs: "rootfs 未解包"
			}) });
			const postGorust = async () => {
				setBusy("gorust");
				setError("");
				setOutput(t("installingGo"));
				try {
					const res = await fetch("/api/zhbox/gorust", { method: "POST" });
					const body = await res.json();
					if (!res.ok) throw new Error(String(body.error ?? res.status));
					setOutput(String(body.output ?? ""));
					await refresh();
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
				}
				setBusy("");
			};
			const button = (label, action, onClick, primary = false) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				onClick,
				disabled: busy !== "",
				style: {
					padding: "8px 14px",
					borderRadius: 8,
					fontSize: 13,
					border: primary ? "none" : "1px solid var(--dsh-border, #8884)",
					background: primary ? "var(--dsh-accent, #4c7dff)" : "transparent",
					color: primary ? "#fff" : "var(--dsh-ink, inherit)",
					cursor: busy === "" ? "pointer" : "not-allowed",
					opacity: busy === "" ? 1 : .6
				},
				children: busy === action ? "…" : label
			}, label);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 12,
					padding: "4px 0"
				},
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							fontSize: 13,
							lineHeight: 1.7
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [
								t("status"),
								": ",
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: status?.toggle === "on" ? t("toggleOn") : t("toggleOff") })
							] }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { children: status?.rootfsReady === true ? `✓ ${t("rootfsReady")}` : t("rootfsMissing") }),
							error !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: { color: "var(--dsh-red, #d33)" },
								children: [
									t("failed"),
									": ",
									error
								]
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							gap: 10,
							flexWrap: "wrap"
						},
						children: [
							button(t("toggle"), "toggle", () => {
								post("toggle");
							}),
							button(t("install"), "install", () => {
								post("install");
							}, true),
							button(t("gorust"), "gorust", () => {
								postGorust();
							}),
							button(t("test"), "test", () => {
								post("test");
							})
						]
					}),
					output !== "" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
						style: {
							margin: 0,
							padding: 10,
							borderRadius: 8,
							fontSize: 12,
							background: "var(--dsh-bg-2, #8881)",
							maxHeight: 240,
							overflow: "auto",
							whiteSpace: "pre-wrap",
							wordBreak: "break-all"
						},
						children: output
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** English copy. */
		const en = {
			title: "ZhaoHua Sandbox",
			description: "Local proot sandbox (Alpine aarch64). Toolchain commands route here automatically; no external server involved.",
			status: "Status",
			toggle: "Toggle sandbox",
			install: "Install / repair toolbox",
			test: "Run sandbox test",
			toggleOn: "on — all commands run in the sandbox",
			toggleOff: "off — only toolchain commands route here",
			rootfsReady: "rootfs ready",
			rootfsMissing: "rootfs not extracted yet (installs on first use)",
			installing: "Installing… this can take several minutes.",
			testing: "Running…",
			idle: "",
			failed: "Failed",
			summaryOn: "Sandbox on — all commands run inside",
			summaryOff: "Sandbox off — toolchain commands only",
			summaryNoRootfs: "rootfs not extracted",
			gorust: "Go / Rust toolchain",
			installingGo: "Installing Go & Rust… (large download, several minutes)"
		};
		/** Simplified Chinese copy. */
		const zh = {
			title: "ZhaoHua 沙箱",
			description: "本机 proot 沙箱（Alpine aarch64）。工具链命令自动进入沙箱执行，不依赖任何外部服务器。",
			status: "状态",
			toggle: "切换沙箱开关",
			install: "安装 / 修复工具箱",
			test: "运行沙箱测试",
			toggleOn: "开 — 所有命令进沙箱",
			toggleOff: "关 — 仅工具链命令进沙箱",
			rootfsReady: "rootfs 已就绪",
			rootfsMissing: "rootfs 未解包（首次使用时自动安装）",
			installing: "安装中… 可能需要几分钟。",
			testing: "运行中…",
			idle: "",
			failed: "失败",
			summaryOn: "沙箱开 — 全部命令进沙箱",
			summaryOff: "沙箱关 — 仅工具链命令进沙箱",
			summaryNoRootfs: "rootfs 未解包",
			gorust: "Go / Rust 工具链",
			installingGo: "正在安装 Go 与 Rust…（下载较大，需要几分钟）"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "zhbox";
		/** Required services (cordis fiber inject). */
		const inject = ["slots", "locale"];
		/**
		* Mount the sandbox settings page into the Plugins settings section.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-settings-sandbox: dictionaries");
			ctx.effect(() => ctx.slots.inject("plugins.item", () => ctx.slots.register({
				name: "plugins.item",
				id: "zhbox",
				order: 45,
				label: () => t("title"),
				locale: NS
			}, SandboxCard)), "ui-settings-sandbox: page");
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map