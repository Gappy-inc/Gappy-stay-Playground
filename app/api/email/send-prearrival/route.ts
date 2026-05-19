import { NextRequest, NextResponse } from 'next/server'
import { sendPreArrivalEmail } from '@/lib/email-scheduler'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://gappy-stay.vercel.app'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    reservationId?: string
    bookingId?: string
  }
  // `reservationId` is the brief's name; `bookingId` is the codebase
  // canonical. Accept either.
  const bookingId = body.reservationId ?? body.bookingId
  if (!bookingId) {
    return NextResponse.json({ error: 'Missing reservationId' }, { status: 400 })
  }

  const result = await sendPreArrivalEmail({ bookingId, baseUrl: BASE_URL })

  switch (result.status) {
    case 'sent':
      return NextResponse.json({ ok: true, sentAt: result.sentAt })
    case 'already_sent':
      return NextResponse.json({ alreadySent: true, sentAt: result.sentAt })
    case 'skipped':
      if (result.reason === 'not_found') {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }
      return NextResponse.json({ error: 'No email address for this guest' }, { status: 400 })
    case 'error':
      return NextResponse.json({ error: result.error }, { status: 500 })
  }
}
