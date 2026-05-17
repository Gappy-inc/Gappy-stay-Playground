import { notFound } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getBookingById } from '@/lib/bookings'
import { getAllOffers } from '@/lib/offers'
import enMessages from '@/lib/i18n/locales/en.json'
import {
  LOCALE_COOKIE,
  PROXY_URL_LANG_HEADER,
  DEFAULT_LOCALE,
  type SupportedLocale,
} from '@/lib/i18n/config'
import { resolveLocale } from '@/lib/i18n/resolve'
import { deepMerge, type AnyMessages } from '@/lib/i18n/merge'
import OfferPageClient from './OfferPageClient'

type Props = {
  params: Promise<{ bookingId: string }>
}

/**
 * Server entry for the guest-facing offer page.
 *
 * Applies the booking.language final-fallback step of the resolution
 * chain (ADR §3 DD-6: URL → cookie → AL → booking.language → en). The
 * proxy already resolved URL/cookie/AL; here we re-run with
 * `bookingLanguage` so the chain produces the final locale for this
 * page only. The result is passed to OfferPageClient, which re-wraps
 * its subtree in a fresh NextIntlClientProvider — overriding the
 * layout-provided locale for this route.
 *
 * `<html lang>` set by the root layout reflects the *middleware* chain
 * (without booking.language) because the layout has no booking context.
 * In the rare case where AL is unsupported but booking.language is, the
 * page subtree will render in booking.language while `<html lang>`
 * stays at the middleware result — a known, documented trade-off.
 */
export default async function OfferPage({ params }: Props) {
  const { bookingId } = await params
  const booking = await getBookingById(bookingId)
  if (!booking) notFound()

  const [cookieJar, headerBag, offerTemplates] = await Promise.all([
    cookies(),
    headers(),
    getAllOffers(),
  ])

  const { locale } = resolveLocale({
    urlLang: headerBag.get(PROXY_URL_LANG_HEADER),
    cookie: cookieJar.get(LOCALE_COOKIE)?.value,
    acceptLanguage: headerBag.get('accept-language'),
    bookingLanguage: booking.language,
  })

  const messages = await loadMessages(locale)

  return (
    <OfferPageClient
      booking={booking}
      offerTemplates={offerTemplates}
      locale={locale}
      messages={messages}
    />
  )
}

async function loadMessages(locale: SupportedLocale): Promise<AnyMessages> {
  const target: AnyMessages = await (async () => {
    try {
      return (await import(`@/lib/i18n/locales/${locale}.json`)).default as AnyMessages
    } catch {
      return (await import(`@/lib/i18n/locales/${DEFAULT_LOCALE}.json`)).default as AnyMessages
    }
  })()
  // FR-7: deep-merge en under the target so missing keys silently resolve
  // to the English source rather than rendering raw key paths.
  if (locale === DEFAULT_LOCALE) return target
  return deepMerge(enMessages as AnyMessages, target)
}
