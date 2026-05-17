/**
 * Typed messages global for `next-intl`.
 *
 * The `Messages` interface is consulted by `next-intl`'s
 * `useTranslations`/`getTranslations` to validate key paths at the type
 * level. Augmenting from `en.json` makes the English file the single
 * source of truth for the key schema; the other locales may have missing
 * keys (warned by `npm run i18n:check`) without breaking the type system.
 *
 * @see docs/adr/0001-i18n-architecture.md §3 DD-3
 */
import type messages from './lib/i18n/locales/en.json'

type EnMessages = typeof messages

declare module 'next-intl' {
  interface AppConfig {
    Messages: EnMessages
    Locale: 'en' | 'ja' | 'zh-TW' | 'zh-CN' | 'ko'
  }
}
