import { Booking } from '@/types'
import bookingsData from '@/data/bookings.json'
import { getRuntimeBookings } from '@/lib/runtime-store'

export function getAllBookings(): Booking[] {
  return [...(bookingsData as Booking[]), ...getRuntimeBookings()]
}

export function getBookingById(id: string): Booking | undefined {
  return getAllBookings().find((b) => b.booking_id === id)
}
