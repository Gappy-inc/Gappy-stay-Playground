import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  isSupportedLocale,
} from './config'

/**
 * Resolution-chain source — which signal won.
 *
 * Emitted alongside the resolved locale so callers can decide whether to
 * apply a later, page-level override (booking.language) without
 * second-guessing.
 *
 * @see docs/adr/0001-i18n-architecture.md §3 DD-6
 */
export type LocaleSource =
  | 'url'
  | 'cookie'
  | 'accept-language'
  | 'booking'
  | 'default'

export type ResolveLocaleInput = {
  /** Raw value of `?lang=` from `URL.searchParams.get('lang')`. */
  urlLang?: string | null
  /** Raw value of the {@link LOCALE_COOKIE} cookie. */
  cookie?: string | null
  /** Raw value of the `Accept-Language` request header. */
  acceptLanguage?: string | null
  /**
   * Per-guest locale preference from `Booking.language`, when (and only
   * when) the calling route has a booking context.
   *
   * Per ADR §3 DD-6 (chain ordering finalized 2026-05-17), this slots
   * **between Accept-Language and the default**, so it acts only as a
   * fallback when the request has not signaled a supported locale via URL,
   * cookie, or browser preference. A Korean speaker booking through a
   * Japanese travel agent is not forced into Japanese UI.
   *
   * **Important runtime caveat**: the Next 16 proxy runs *before* route
   * params are available, so the proxy itself cannot read `bookingId` →
   * cannot resolve `booking.language`. The booking lookup happens at
   * page-level (`/offer/[bookingId]`, `/checkout`, `/complete`) and is
   * applied via a second `resolveLocale` call (or by passing an explicit
   * `locale` to `getTranslations({locale})`). Routes without booking
   * context simply omit this field.
   */
  bookingLanguage?: string | null
}

export type ResolveLocaleResult = {
  locale: SupportedLocale
  source: LocaleSource
}

/**
 * Resolve the active locale for a request.
 *
 * Pure function with no I/O — safe to call from proxy, server components,
 * and unit tests. The resolution chain is fixed at the value finalized in
 * docs/adr/0001-i18n-architecture.md §3 DD-6:
 *
 *   1. URL `?lang=<code>`                  (if supported)
 *   2. Cookie value                        (if supported)
 *   3. `Accept-Language` header            (q-value parsed, supported best match)
 *   4. `booking.language`                  (if supported and provided)
 *   5. {@link DEFAULT_LOCALE} (`'en'`)
 *
 * Unsupported values at any step are ignored; the chain falls through.
 * No step throws.
 *
 * @example
 * resolveLocale({ urlLang: 'ja' })
 *   // → { locale: 'ja', source: 'url' }
 *
 * @example
 * resolveLocale({ acceptLanguage: 'zh-Hant-TW,zh;q=0.9,en;q=0.8' })
 *   // → { locale: 'zh-TW', source: 'accept-language' }
 *
 * @example
 * resolveLocale({ acceptLanguage: 'fr', bookingLanguage: 'ja' })
 *   // → { locale: 'ja', source: 'booking' }
 */
export function resolveLocale(input: ResolveLocaleInput): ResolveLocaleResult {
  // 1. URL ?lang=
  if (isSupportedLocale(input.urlLang)) {
    return { locale: input.urlLang, source: 'url' }
  }

  // 2. Cookie
  if (isSupportedLocale(input.cookie)) {
    return { locale: input.cookie, source: 'cookie' }
  }

  // 3. Accept-Language header
  const fromAcceptLanguage = matchAcceptLanguage(input.acceptLanguage)
  if (fromAcceptLanguage) {
    return { locale: fromAcceptLanguage, source: 'accept-language' }
  }

  // 4. booking.language (page-level only; proxy never passes this)
  const fromBooking = matchBookingLanguage(input.bookingLanguage)
  if (fromBooking) {
    return { locale: fromBooking, source: 'booking' }
  }

  // 5. Default
  return { locale: DEFAULT_LOCALE, source: 'default' }
}

/**
 * Parse an `Accept-Language` header value and return the highest-q
 * supported match. Handles:
 *
 * - `zh-Hant*` and `*-Hant*` → `zh-TW` (Traditional)
 * - `zh-Hans*`, plain `zh`, `zh-CN`, `zh-SG`, `zh-MY` → `zh-CN`
 * - Region drops: `ko-KR` → `ko`, `ja-JP` → `ja`, `en-*` → `en`
 *
 * Returns `null` when nothing maps to a supported locale.
 */
function matchAcceptLanguage(header: string | null | undefined): SupportedLocale | null {
  if (!header) return null

  // Parse `a;q=0.9,b;q=0.8` into [{tag, q}], default q=1.0
  const entries = header
    .split(',')
    .map((raw) => {
      const [tag, ...params] = raw.trim().split(';').map((s) => s.trim())
      let q = 1.0
      for (const p of params) {
        const m = p.match(/^q=([0-9]*\.?[0-9]+)$/i)
        if (m) q = parseFloat(m[1])
      }
      return { tag: tag.toLowerCase(), q }
    })
    .filter((e) => e.tag && Number.isFinite(e.q) && e.q > 0)
    // Stable sort by q descending
    .sort((a, b) => b.q - a.q)

  for (const { tag } of entries) {
    const mapped = normalizeLanguageTag(tag)
    if (mapped) return mapped
  }
  return null
}

/**
 * Map a single BCP-47 language tag (lowercased) to a SupportedLocale.
 * Returns `null` if no supported match.
 *
 * Region-variant rules:
 * - Anything carrying `hant` (Traditional) → `zh-TW`
 * - Anything starting with `zh` (else) → `zh-CN`
 * - Otherwise, take the primary subtag (`ko-kr` → `ko`)
 */
function normalizeLanguageTag(tag: string): SupportedLocale | null {
  if (!tag) return null

  // Traditional Chinese signal (per ISO 15924 script subtag)
  if (tag.includes('hant')) return 'zh-TW'

  // Simplified Chinese signal (script tag, or region tags that imply it)
  if (tag.includes('hans')) return 'zh-CN'

  // Bare zh and other zh-* region tags. Industry convention:
  // - zh-TW, zh-HK, zh-MO → Traditional
  // - zh-CN, zh-SG, zh-MY, plain zh → Simplified
  if (tag === 'zh' || tag.startsWith('zh-')) {
    if (/^zh-(tw|hk|mo)\b/.test(tag)) return 'zh-TW'
    return 'zh-CN'
  }

  // Primary subtag fallback (e.g. ko-KR → ko, ja-JP → ja, en-US → en)
  const primary = tag.split('-')[0]
  if (isSupportedLocale(primary)) return primary

  // Exact full-tag match (handles a literal `zh-TW` we somehow missed)
  if (isSupportedLocale(tag)) return tag

  return null
}

/**
 * Map a stored `Booking.language` value to a SupportedLocale.
 *
 * Per ADR §3 DD-4 the legacy data value `'zh'` aliases to `'zh-CN'`.
 * Anything else flows through `isSupportedLocale`.
 */
function matchBookingLanguage(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null
  if (value === 'zh') return 'zh-CN'
  return isSupportedLocale(value) ? value : null
}

/**
 * Re-exported convenience: the typed list of supported locales.
 * Same as importing `SUPPORTED_LOCALES` directly; provided here so
 * call sites that already import `resolveLocale` don't need a second
 * import line for iteration.
 */
export { SUPPORTED_LOCALES, DEFAULT_LOCALE }
export type { SupportedLocale }
