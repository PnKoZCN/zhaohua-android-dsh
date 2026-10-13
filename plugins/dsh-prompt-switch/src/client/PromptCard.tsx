import { useCallback, useEffect, useState } from "react";
import type { PropsLocale, PropsRuntime } from "@deepseek-ai/dsh-client-ui-slots";
import type { PromptLocaleKey } from "./locales.ts";

export type PromptCardProps =
  PropsRuntime<"plugins.item">
  & PropsLocale<"zhbox-prompt">;

interface StatusShape {
  mode?: string;
  size?: number;
  firstLine?: string;
}

export function PromptCard(props: PromptCardProps) {
  const t = props.t as (key: PromptLocaleKey) => string;
  const [status, setStatus] = useState<StatusShape | null>(null);
  const [busy, setBusy] = useState("");

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch("/api/zprompt/status");
      const body = await res.json() as Record<string, unknown>;
      if (res.ok) setStatus(body as StatusShape);
    } catch {}
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onVis = (): void => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [refresh]);

  const setMode = async (mode: string): Promise<void> => {
    if (busy !== "") return;
    setBusy(mode);
    try {
      const res = await fetch(`/api/zprompt/set-mode?mode=${encodeURIComponent(mode)}`, { method: "POST" });
      if (res.ok) await refresh();
    } catch {}
    setBusy("");
  };

  const mode = status?.mode ?? "default";
  const summary = mode === "claude" ? t("summaryClaude")
    : mode === "regular" ? t("summaryRegular")
    : t("summaryDefault");
  if (props.view === "summary") return <>{summary}</>;

  const rows: Array<{ key: string; label: string; desc: string }> = [
    { key: "default", label: t("modeDefault"), desc: t("modeDefaultDesc") },
    { key: "regular", label: t("modeRegular"), desc: t("modeRegularDesc") },
    { key: "claude", label: t("modeClaude"), desc: t("modeClaudeDesc") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0" }}>
      {rows.map((r) => {
        const active = mode === r.key;
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => { void setMode(r.key); }}
            disabled={busy !== ""}
            style={{
              textAlign: "left",
              padding: "10px 14px",
              borderRadius: 8,
              fontSize: 13,
              border: active ? "1px solid var(--dsh-accent, #4c7dff)" : "1px solid var(--dsh-border, #8884)",
              background: active ? "color-mix(in srgb, var(--dsh-accent, #4c7dff) 8%, transparent)" : "transparent",
              color: "var(--dsh-ink, inherit)",
              cursor: busy === "" ? "pointer" : "not-allowed",
              opacity: busy === "" ? 1 : 0.6,
            }}
          >
            <strong>{r.label}</strong>
            {active ? ` — ${t("active")}` : ""}
            <div style={{ opacity: 0.65, marginTop: 4 }}>{r.desc}</div>
          </button>
        );
      })}
      <div style={{ fontSize: 12, color: "var(--dsh-sub, #888)" }}>{t("note")}</div>
    </div>
  );
}
