import { Booking } from '@/types'
import bookingsData from '@/data/bookings.json'
import { getRuntimeBookings } from '@/lib/runtime-store'

export async function getAllBookings(): Promise<Booking[]> {
  const runtime = await getRuntimeBookings()
  return [...(bookingsData as Booking[]), ...runtime]
}

export async function getBookingById(id: string): Promise<Booking | undefined> {
  const all = await getAllBookings()
  return all.find((b) => b.booking_id === id)
}
