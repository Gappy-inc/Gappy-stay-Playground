import { NextResponse } from 'next/server'
import { getAllBookings } from '@/lib/bookings'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ bookings: getAllBookings() })
}
