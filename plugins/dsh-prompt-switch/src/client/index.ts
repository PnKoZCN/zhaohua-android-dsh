import type {} from "@deepseek-ai/dsh-client-locale/client";
import type {} from "@deepseek-ai/dsh-client-ui-plugin-manager/client";
import type {} from "@deepseek-ai/dsh-client-ui-renderer/client";
import type {} from "@deepseek-ai/dsh-client-ui-settings/client";
import type { Context as ClientContext } from "@deepseek-ai/cordis";
import { PromptCard } from "./PromptCard.tsx";
import { en, zh, type PromptLocaleKey } from "./locales.ts";

export type { PromptCardProps } from "./PromptCard.tsx";
export type { PromptLocaleKey } from "./locales.ts";

declare module "@deepseek-ai/dsh-client-ui-slots" {
  interface LocaleNamespaceMap {
    /** ZhaoHua 提示词切换设置页文案。 */
    "zhbox-prompt": PromptLocaleKey;
  }
}

export const NS = "zhbox-prompt";
export const inject = ["slots", "locale"];

export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS);
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "zprompt: dictionaries");
  ctx.effect(() => ctx.slots.inject("plugins.item", () => ctx.slots.register({
    name: "plugins.item", id: "zprompt", order: 46, label: () => t("title"), locale: NS,
  }, PromptCard)), "zprompt: page");
}
