import { NextRequest, NextResponse } from 'next/server'
import { getRuntimeBookings, setRuntimeBookings } from '@/lib/runtime-store'
import { Booking } from '@/types'

export async function POST(req: NextRequest) {
  const { bookings }: { bookings: Booking[] } = await req.json()
  if (!Array.isArray(bookings)) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }
  const existing = await getRuntimeBookings()
  const existingIds = new Set(existing.map((b) => b.booking_id))
  const newBookings = bookings.filter((b) => b.guest_name && !existingIds.has(b.booking_id))
  await setRuntimeBookings([...existing, ...newBookings])
  return NextResponse.json({ added: newBookings.length, total: existing.length + newBookings.length })
}

export async function DELETE() {
  await setRuntimeBookings([])
  return NextResponse.json({ ok: true })
}
