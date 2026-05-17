import { createTranslator } from 'next-intl'
import { DEFAULT_LOCALE, type SupportedLocale } from './config'
import enMessages from './locales/en.json'

type EnMessages = typeof enMessages

/**
 * Server-side helper for email routes (FR-6).
 *
 * Email-sending code in `app/api/email/*` has no request context — no
 * cookies, no Accept-Language, no proxy. Callers pass the target locale
 * explicitly (typically derived from `booking.language`, with the
 * legacy-`'zh'` alias already normalized by the caller).
 *
 * Returns a translator function with the same key-type surface as
 * `useTranslations` / `getTranslations` so call sites are uniform.
 *
 * @example
 * const t = await getEmailTranslations('ja')
 * const subject = t('email.subject', { firstName })
 *
 * @see docs/adr/0001-i18n-architecture.md §3 DD-6
 */
export async function getEmailTranslations(locale: SupportedLocale) {
  const messages = await loadMessages(locale)
  return createTranslator<EnMessages>({ locale, messages })
}

async function loadMessages(locale: SupportedLocale): Promise<EnMessages> {
  try {
    return (await import(`./locales/${locale}.json`)).default as EnMessages
  } catch {
    return (await import(`./locales/${DEFAULT_LOCALE}.json`)).default as EnMessages
  }
}
