/**
 * Map an offer's snake_case unit slug (`per_stay`, `per_person_per_day`)
 * to the camelCase key used in `lib/i18n/locales/en.json` under `units.*`
 * (`perStay`, `perPersonPerDay`).
 *
 * Offer data lives in `data/offers.json` and is shaped by external CSV
 * inputs that pre-date i18n — keeping the slugs snake_case avoids a
 * data migration; this helper bridges the naming.
 *
 * If the slug doesn't resolve to a known key, returns the raw slug so
 * the UI shows *something* (degraded, not broken).
 *
 * @example
 * unitLabel(t, 'per_night') // → t('perNight') → "per night"
 */
import type { useTranslations } from 'next-intl'

type UnitTranslator = ReturnType<typeof useTranslations<'units'>>

export function unitLabel(t: UnitTranslator, slug: string): string {
  if (!slug) return slug
  const key = slug.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  try {
    return t(key as Parameters<typeof t>[0])
  } catch {
    return slug
  }
}
