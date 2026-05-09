import { notFound } from 'next/navigation'
import { getBookingById } from '@/lib/bookings'
import { getAllOffers } from '@/lib/offers'
import OfferPageClient from './OfferPageClient'

type Props = {
  params: Promise<{ bookingId: string }>
}

export default async function OfferPage({ params }: Props) {
  const { bookingId } = await params
  const booking = await getBookingById(bookingId)
  if (!booking) notFound()

  const offerTemplates = await getAllOffers()

  return <OfferPageClient booking={booking} offerTemplates={offerTemplates} />
}
