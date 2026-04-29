import { OfferTemplate } from '@/types'
import offersData from '@/data/offers.json'

export function getAllOffers(): OfferTemplate[] {
  return offersData as OfferTemplate[]
}
