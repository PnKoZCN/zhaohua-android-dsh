export type PromptLocaleKey =
  | "title" | "summaryDefault" | "summaryRegular" | "summaryClaude"
  | "modeDefault" | "modeDefaultDesc"
  | "modeRegular" | "modeRegularDesc"
  | "modeClaude" | "modeClaudeDesc"
  | "active" | "note";

export const en: Record<PromptLocaleKey, string> = {
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
  note: "Takes effect on the next message — no restart needed.",
};

export const zh: Record<PromptLocaleKey, string> = {
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
  note: "切换即时生效：下一条消息即用新提示词，无需重启。",
};
