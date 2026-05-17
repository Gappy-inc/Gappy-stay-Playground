import propertyData from '@/data/property.json'
import type { Booking } from '@/types'
import type { SupportedLocale } from '@/lib/i18n/config'
import { getEmailTranslations } from '@/lib/i18n/email'
import {
  buildPreArrivalHtml,
  buildPreArrivalText,
  type Property,
} from '@/lib/email-templates/pre-arrival'

// TODO: replace static property.json with per-hotel data once multi-hotel
// support lands (currently every email assumes the single demo property).
const property = propertyData as Property

export type PreArrivalEmailInput = {
  booking: Booking
  locale: SupportedLocale
  ctaUrl: string
}

export type PreArrivalEmailOutput = {
  html: string
  text: string
  subject: string
}

export async function renderPreArrivalEmail(
  input: PreArrivalEmailInput,
): Promise<PreArrivalEmailOutput> {
  const t = await getEmailTranslations(input.locale)
  const firstName = input.booking.guest_name.split(' ')[0]
  const checkInDate = formatDate(input.booking.check_in, input.locale)

  const templateInput = {
    t,
    property,
    booking: input.booking,
    ctaUrl: input.ctaUrl,
    firstName,
    checkInDate,
  }

  return {
    subject: t('email.preArrival.subject', {
      hotelName: property.hotel_name,
      checkInDate,
    }),
    html: buildPreArrivalHtml(templateInput),
    text: buildPreArrivalText(templateInput),
  }
}

function formatDate(iso: string, locale: SupportedLocale): string {
  try {
    return new Date(iso).toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
