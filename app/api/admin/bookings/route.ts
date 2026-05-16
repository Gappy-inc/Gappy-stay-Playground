import { NextRequest, NextResponse } from 'next/server'
import { getAllBookings } from '@/lib/bookings'
import { getRuntimeBookings, setRuntimeBookings, getAllEmailStatuses } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const [bookings, runtimeBookings] = await Promise.all([
    getAllBookings(),
    getRuntimeBookings(),
  ])
  const runtimeIds = runtimeBookings.map((b) => b.booking_id)
  const emailStatuses = await getAllEmailStatuses(bookings.map(b => b.booking_id))
  return NextResponse.json({ bookings, runtimeIds, emailStatuses })
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const updated = (await getRuntimeBookings()).filter((b) => b.booking_id !== id)
  await setRuntimeBookings(updated)
  return NextResponse.json({ ok: true })
}
