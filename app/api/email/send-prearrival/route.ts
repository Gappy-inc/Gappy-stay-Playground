import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getBookingById } from '@/lib/bookings'
import { getEmailStatus, setEmailStatus } from '@/lib/runtime-store'
import { normalizeBookingLocale } from '@/lib/i18n/resolve'
import { renderPreArrivalEmail } from '@/lib/email-render'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://gappy-stay.vercel.app'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
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

  const booking = await getBookingById(bookingId)
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!booking.email) {
    return NextResponse.json({ error: 'No email address for this guest' }, { status: 400 })
  }

  const existing = await getEmailStatus(bookingId, 'prearrival')
  if (existing?.sent) {
    return NextResponse.json({ alreadySent: true, sentAt: existing.sentAt })
  }

  const locale = normalizeBookingLocale(booking.language)
  const ctaUrl = `${BASE_URL}/offer/${bookingId}`

  const { html, text, subject } = await renderPreArrivalEmail({
    booking,
    locale,
    ctaUrl,
  })

  const { error } = await resend.emails.send({
    from: 'Gappy Stay <onboarding@resend.dev>',
    to: booking.email,
    subject,
    html,
    text,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sentAt = new Date().toISOString()
  await setEmailStatus(bookingId, { sent: true, sentAt }, 'prearrival')
  return NextResponse.json({ ok: true, sentAt })
}
