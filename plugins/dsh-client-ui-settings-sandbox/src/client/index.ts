/**
 * ZhaoHua sandbox settings page, browser half: registers into the Plugins
 * settings page while the Host serves the zhbox route. The card talks to
 * `/api/zhbox/*` served by this plugin's node half.
 */
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { SandboxCard } from './SandboxCard.tsx'
import { en, zh, type SandboxLocaleKey } from './locales.ts'

export type { SandboxCardProps } from './SandboxCard.tsx'
export type { SandboxLocaleKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** ZhaoHua sandbox settings page copy. */
    'zhbox': SandboxLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'zhbox'

/** Required services (cordis fiber inject). */
export const inject = ['slots', 'locale']

/**
 * Mount the sandbox settings page into the Plugins settings section.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-settings-sandbox: dictionaries')
  ctx.effect(() => ctx.slots.inject('plugins.item', () => ctx.slots.register({
    name: 'plugins.item', id: 'zhbox', order: 45, label: () => t('title'), locale: NS,
  }, SandboxCard)), 'ui-settings-sandbox: page')
}
