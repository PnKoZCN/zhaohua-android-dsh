window.__ModuleLoader__.load({
	id: "@zhaohua/dsh-prompt-switch",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/PromptCard.tsx
		function PromptCard(props) {
			const t = props.t;
			const [status, setStatus] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)("");
			const refresh = (0, react.useCallback)(async () => {
				try {
					const res = await fetch("/api/zprompt/status");
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
			const setMode = async (mode) => {
				if (busy !== "") return;
				setBusy(mode);
				try {
					if ((await fetch(`/api/zprompt/set-mode?mode=${encodeURIComponent(mode)}`, { method: "POST" })).ok) await refresh();
				} catch {}
				setBusy("");
			};
			const mode = status?.mode ?? "default";
			const summary = mode === "claude" ? t("summaryClaude") : mode === "regular" ? t("summaryRegular") : t("summaryDefault");
			if (props.view === "summary") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(react_jsx_runtime.Fragment, { children: summary });
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: {
					display: "flex",
					flexDirection: "column",
					gap: 12,
					padding: "4px 0"
				},
				children: [[
					{
						key: "default",
						label: t("modeDefault"),
						desc: t("modeDefaultDesc")
					},
					{
						key: "regular",
						label: t("modeRegular"),
						desc: t("modeRegularDesc")
					},
					{
						key: "claude",
						label: t("modeClaude"),
						desc: t("modeClaudeDesc")
					}
				].map((r) => {
					const active = mode === r.key;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => {
							setMode(r.key);
						},
						disabled: busy !== "",
						style: {
							textAlign: "left",
							padding: "10px 14px",
							borderRadius: 8,
							fontSize: 13,
							border: active ? "1px solid var(--dsh-accent, #4c7dff)" : "1px solid var(--dsh-border, #8884)",
							background: active ? "color-mix(in srgb, var(--dsh-accent, #4c7dff) 8%, transparent)" : "transparent",
							color: "var(--dsh-ink, inherit)",
							cursor: busy === "" ? "pointer" : "not-allowed",
							opacity: busy === "" ? 1 : .6
						},
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: r.label }),
							active ? ` — ${t("active")}` : "",
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								style: {
									opacity: .65,
									marginTop: 4
								},
								children: r.desc
							})
						]
					}, r.key);
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					style: {
						fontSize: 12,
						color: "var(--dsh-sub, #888)"
					},
					children: t("note")
				})]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const en = {
			title: "Prompt",
			summaryDefault: "Prompt: default (neutral)",
			summaryRegular: "Prompt: regular persona",
			summaryClaude: "Prompt: Claude persona",
			modeDefault: "Default (neutral)",
			modeDefaultDesc: "No persona loaded — plain assistant.",
			modeRegular: "Regular",
			modeRegularDesc: "Current ZhaoHua persona (sections 1-15).",
			modeClaude: "Claude",
			modeClaudeDesc: "Claude-optimized: routing + self-check + delivery contract.",
			active: "active",
			note: "Takes effect on the next message — no restart needed."
		};
		const zh = {
			title: "提示词",
			summaryDefault: "提示词：默认（中性，不加载破甲提示词）",
			summaryRegular: "提示词：常规破甲",
			summaryClaude: "提示词：Claude 专用破甲",
			modeDefault: "默认",
			modeDefaultDesc: "不加载破甲提示词，普通助手行为。",
			modeRegular: "常规破甲",
			modeRegularDesc: "现行 ZhaoHua 完整人格（第 1-15 节）。",
			modeClaude: "Claude 破甲",
			modeClaudeDesc: "Claude 专用：路由 + 输出自检 + 交付契约 + 激活词门控。",
			active: "当前",
			note: "切换即时生效：下一条消息即用新提示词，无需重启。"
		};
		//#endregion
		//#region src/client/index.ts
		const NS = "zhbox-prompt";
		const inject = ["slots", "locale"];
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "zprompt: dictionaries");
			ctx.effect(() => ctx.slots.inject("plugins.item", () => ctx.slots.register({
				name: "plugins.item",
				id: "zprompt",
				order: 46,
				label: () => t("title"),
				locale: NS
			}, PromptCard)), "zprompt: page");
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map