import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  PROXY_URL_LANG_HEADER,
  type SupportedLocale,
  isSupportedLocale,
} from './config'
import { resolveLocale } from './resolve'

/**
 * Per-request locale resolution and message loading for `next-intl`.
 *
 * This is the function `next-intl` invokes for every request, on the
 * server, to determine which locale's messages to ship to the page.
 *
 * Resolution chain (proxy-and-page layer; the `booking.language` final
 * fallback is applied page-side for routes with a booking context, per
 * ADR §3 DD-6):
 *
 *   1. `?lang=<code>` (forwarded from proxy via `x-gappy-url-lang`)
 *   2. {@link LOCALE_COOKIE} cookie
 *   3. `Accept-Language` request header
 *   4. {@link DEFAULT_LOCALE}
 *
 * Pages with booking context can override by passing an explicit
 * `{ locale }` to `getTranslations({locale})` (server) or by wrapping
 * children in `<NextIntlClientProvider locale={x}>` (client subtree).
 *
 * @see docs/adr/0001-i18n-architecture.md §6 (sequence diagram)
 */
export default getRequestConfig(async ({ locale: explicitLocale }) => {
  let resolved: SupportedLocale = DEFAULT_LOCALE

  // 1. Explicit override (e.g. `getTranslations({locale: 'ja'})` from a
  //    booking-context page applying the final-fallback step 4).
  if (isSupportedLocale(explicitLocale)) {
    resolved = explicitLocale
  } else {
    const [cookieJar, headerBag] = await Promise.all([cookies(), headers()])
    const { locale } = resolveLocale({
      urlLang: headerBag.get(PROXY_URL_LANG_HEADER),
      cookie: cookieJar.get(LOCALE_COOKIE)?.value,
      acceptLanguage: headerBag.get('accept-language'),
      // bookingLanguage intentionally omitted — applied page-side.
    })
    resolved = locale
  }

  const messages = await loadMessages(resolved)

  return {
    locale: resolved,
    messages,
    // Dev: surface missing keys with route + locale context so the gap is
    // obvious. Prod: keep the user-facing fallback but emit a structured
    // log line so observability can pick it up (TODO T-15c: route to
    // Sentry/Datadog when wired).
    onError(error) {
      if (process.env.NODE_ENV === 'production') {
        if (error.code === 'MISSING_MESSAGE') {
          console.warn(
            JSON.stringify({
              event: 'i18n_missing_key',
              locale: resolved,
              message: error.message,
            })
          )
        }
        return
      }
      console.warn(`[i18n] ${error.code}: ${error.message} (locale: ${resolved})`)
    },
    getMessageFallback({ key, namespace }) {
      const path = namespace ? `${namespace}.${key}` : key
      if (process.env.NODE_ENV !== 'production') {
        return `⟪${path}⟫`
      }
      return path
    },
  }
})

/**
 * Load the messages JSON for a locale. Falls back to the default locale's
 * file if the target file is missing or fails to parse — every guest
 * request must produce *something* renderable.
 */
async function loadMessages(locale: SupportedLocale): Promise<Record<string, unknown>> {
  try {
    return (await import(`./locales/${locale}.json`)).default
  } catch {
    return (await import(`./locales/${DEFAULT_LOCALE}.json`)).default
  }
}

