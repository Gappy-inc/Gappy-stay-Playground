import { OfferTemplate } from '@/types'
import offersData from '@/data/offers.json'
import { getPausedOfferIds } from '@/lib/runtime-store'

export async function getAllOffers(): Promise<OfferTemplate[]> {
  const paused = await getPausedOfferIds()
  if (paused.length === 0) return offersData as OfferTemplate[]
  return (offersData as OfferTemplate[]).filter(o => !paused.includes(o.offer_id))
}
