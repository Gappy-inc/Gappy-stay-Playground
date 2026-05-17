/**
 * Supported locales for the guest-facing UI.
 *
 * Order is significant: it controls the order of options in the
 * {@link LanguageSwitcher} dropdown, and `[0]` is the default.
 *
 * Add or remove a locale here and the type system propagates the change
 * everywhere — `SupportedLocale` is the single source of truth.
 *
 * @see docs/adr/0001-i18n-architecture.md §3 DD-3
 */
export const SUPPORTED_LOCALES = ['en', 'ja', 'zh-TW', 'zh-CN', 'ko'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en'

/**
 * Header name used by `proxy.ts` to forward a validated `?lang=`
 * downstream to `getRequestConfig`. Defined here (not in `request.ts`)
 * so the proxy can import a single, side-effect-free module — and never
 * transitively pull in `next-intl/server` or `next/headers`.
 */
export const PROXY_URL_LANG_HEADER = 'x-gappy-url-lang'

/**
 * Cookie name for the persisted user locale choice.
 *
 * Namespaced (`gappy_*`) per NFR-4 to avoid collisions with other apps
 * sharing the same domain. Read by the proxy on every request and written
 * by both the proxy (on valid `?lang=`) and the client-side
 * `LanguageSwitcher` (on user selection).
 */
export const LOCALE_COOKIE = 'gappy_locale'

/**
 * Native (autoglottonym) display names for each supported locale.
 *
 * Used by `LanguageSwitcher`. Native rather than English per FR-2:
 * a Korean speaker reading "Korean" in a Japanese-defaulted UI still
 * has to read English; reading "한국어" needs no translation.
 */
export const LOCALE_LABEL: Record<SupportedLocale, string> = {
  en: 'English',
  ja: '日本語',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  ko: '한국어',
}

/**
 * Type guard for narrowing arbitrary strings to a SupportedLocale.
 *
 * @example
 * const raw = url.searchParams.get('lang')
 * if (raw && isSupportedLocale(raw)) {
 *   // raw is now SupportedLocale
 * }
 */
export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  )
}
