import { notFound } from 'next/navigation'
import { getBookingById } from '@/lib/bookings'
import { getAllOffers } from '@/lib/offers'
import OfferPageClient from './OfferPageClient'

type Props = {
  params: Promise<{ bookingId: string }>
}

export default async function OfferPage({ params }: Props) {
  const { bookingId } = await params
  const booking = getBookingById(bookingId)
  if (!booking) notFound()

  const offerTemplates = getAllOffers()

  return <OfferPageClient booking={booking} offerTemplates={offerTemplates} />
}
