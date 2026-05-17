import { createTranslator } from 'next-intl'
import { DEFAULT_LOCALE, type SupportedLocale } from './config'
import enMessages from './locales/en.json'
import { deepMerge, type AnyMessages } from './merge'

type EnMessages = typeof enMessages

/**
 * Server-side helper for email routes (FR-6).
 *
 * Email-sending code in `app/api/email/*` has no request context — no
 * cookies, no Accept-Language, no proxy. Callers pass the target locale
 * explicitly (typically derived from `booking.language`, with the
 * legacy-`'zh'` alias already normalized by the caller).
 *
 * Missing keys in the target locale silently fall back to the English
 * source (FR-7) so the email body never contains raw key paths.
 *
 * @example
 * const t = await getEmailTranslations('ja')
 * const subject = t('email.subject', { firstName })
 *
 * @see docs/adr/0001-i18n-architecture.md §3 DD-6
 */
export async function getEmailTranslations(locale: SupportedLocale) {
  const target = await loadMessages(locale)
  // Deep-merge en under target so the translator's own lookup transparently
  // resolves any missing target key from English without a separate hook.
  const merged = deepMerge(enMessages as AnyMessages, target as AnyMessages) as EnMessages
  return createTranslator<EnMessages>({ locale, messages: merged })
}

async function loadMessages(locale: SupportedLocale): Promise<AnyMessages> {
  try {
    return (await import(`./locales/${locale}.json`)).default as AnyMessages
  } catch {
    return (await import(`./locales/${DEFAULT_LOCALE}.json`)).default as AnyMessages
  }
}

