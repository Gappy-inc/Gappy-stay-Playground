import { getRequestConfig } from 'next-intl/server'
import { cookies, headers } from 'next/headers'
import enMessages from './locales/en.json'
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  PROXY_URL_LANG_HEADER,
  type SupportedLocale,
  isSupportedLocale,
} from './config'
import { resolveLocale } from './resolve'
import { deepMerge, type AnyMessages } from './merge'

/**
 * Per-request locale resolution and message loading for `next-intl`.
 *
 * Resolution chain (proxy + page layer; final `booking.language` step is
 * applied page-side for booking-context routes, per ADR §3 DD-6):
 *
 *   1. `?lang=<code>` (forwarded from proxy via `x-gappy-url-lang`)
 *   2. {@link LOCALE_COOKIE} cookie
 *   3. `Accept-Language` request header
 *   4. {@link DEFAULT_LOCALE}
 *
 * Missing keys in the active locale silently fall back to the English
 * source (FR-7): every locale's messages are deep-merged with `en`
 * before being shipped to the page, so `t('foo.bar')` always returns
 * *something* renderable — either the target translation or the English
 * value — without showing raw key paths in production.
 *
 * Dev still gets visible feedback via the `onError` console.warn (key
 * + locale) so missing translations stay obvious during development.
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

  const targetMessages = await loadMessages(resolved)
  const messages =
    resolved === DEFAULT_LOCALE
      ? targetMessages
      : deepMerge(enMessages as AnyMessages, targetMessages)

  return {
    locale: resolved,
    messages,
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
    // Reached only when a key is missing in BOTH the target locale AND
    // English — i.e. a genuine build-time bug. Show the path as a last
    // resort.
    getMessageFallback({ key, namespace }) {
      return namespace ? `${namespace}.${key}` : key
    },
  }
})

async function loadMessages(locale: SupportedLocale): Promise<AnyMessages> {
  try {
    return (await import(`./locales/${locale}.json`)).default as AnyMessages
  } catch {
    return (await import(`./locales/${DEFAULT_LOCALE}.json`)).default as AnyMessages
  }
}

