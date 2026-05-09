import { OfferTemplate } from '@/types'
import offersData from '@/data/offers.json'
import { getPausedOfferIds } from '@/lib/runtime-store'

export function getAllOffers(): OfferTemplate[] {
  const paused = getPausedOfferIds()
  if (paused.length === 0) return offersData as OfferTemplate[]
  return (offersData as OfferTemplate[]).filter(o => !paused.includes(o.offer_id))
}
