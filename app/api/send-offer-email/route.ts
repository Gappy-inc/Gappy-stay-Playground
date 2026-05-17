import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getBookingById } from '@/lib/bookings'
import { getEmailStatus, setEmailStatus } from '@/lib/runtime-store'
import offersData from '@/data/offers.json'
import type { OfferTemplate } from '@/types'
import type { SupportedLocale } from '@/lib/i18n/config'
import { getEmailTranslations } from '@/lib/i18n/email'
import { normalizeBookingLocale } from '@/lib/i18n/resolve'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://gappy-stay.vercel.app'

async function buildEmail(
  guestName: string,
  locale: SupportedLocale,
  offerUrl: string,
  checkIn: string,
  checkOut: string,
  roomType: string,
  topOffers: OfferTemplate[]
): Promise<string> {
  const firstName = guestName.split(' ')[0]
  const t = await getEmailTranslations(locale)

  const SHINRYOKU = '#5B8A3C'
  const SUMI      = '#2C4A1E'
  const BG        = '#F8F6F0'
  const BORDER    = '#F0EBE0'
  const SUBTEXT   = '#7A8C70'

  const offerBlocks = topOffers.map(o => {
    const title = o.title[locale] || o.title['en']
    const disc  = o.original_price
      ? `<span style="text-decoration:line-through;color:#B0B0A0;font-size:12px;margin-right:6px;">¥${o.original_price.toLocaleString()}</span>`
      : ''
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid ${BORDER};">
        <span style="font-size:14px;color:${SUMI};font-weight:500;">${title}</span>
        <span style="white-space:nowrap;">${disc}<strong style="color:${SHINRYOKU};font-size:15px;">¥${o.price.toLocaleString()}</strong></span>
      </div>`
  }).join('')

  // Date formatting uses Intl directly: the email runs server-side with
  // no request context, and we want a date format that the recipient's
  // locale will render naturally.
  const formatDate = (d: string) => {
    try { return new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' }) }
    catch { return d }
  }

  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${t('email.pageTitle')}</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:'DM Sans',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">

    <!-- Header — brand wordmark untranslated per ADR §3 DD-3 -->
    <div style="text-align:center;padding:28px 0 20px;">
      <div style="font-size:20px;font-weight:700;color:${SUMI};letter-spacing:0.06em;">▶ Gappy Stay</div>
    </div>

    <!-- Main card -->
    <div style="background:#ffffff;border-radius:16px;border:1px solid ${BORDER};overflow:hidden;box-shadow:0 2px 12px rgba(44,74,30,0.06);">

      <!-- Green top bar -->
      <div style="height:5px;background:linear-gradient(90deg,${SHINRYOKU},#A8C97F);"></div>

      <div style="padding:32px 32px 28px;">

        <!-- Greeting -->
        <p style="font-size:22px;font-weight:600;color:${SUMI};margin:0 0 6px;">${t('email.greeting', { firstName })}</p>

        <!-- Stay summary -->
        <div style="display:inline-flex;align-items:center;gap:8px;background:#F0F4EC;border:1px solid ${BORDER};border-radius:8px;padding:7px 12px;margin:0 0 16px;">
          <span style="font-size:12px;color:${SUBTEXT};">🏨 ${roomType}</span>
          <span style="color:${BORDER};font-size:12px;">·</span>
          <span style="font-size:12px;color:${SUBTEXT};">${formatDate(checkIn)} – ${formatDate(checkOut)}</span>
        </div>

        <p style="font-size:14px;color:${SUBTEXT};line-height:1.65;margin:0 0 28px;">${t('email.intro')}</p>

        <!-- Offers preview -->
        <div style="font-size:10px;font-weight:600;color:#A8C97F;text-transform:uppercase;letter-spacing:0.18em;margin-bottom:4px;">${t('email.offerLabel')}</div>
        <div style="margin-bottom:24px;">${offerBlocks}</div>

        <!-- CTA button -->
        <div style="text-align:center;">
          <a href="${offerUrl}"
            style="display:inline-block;background:${SHINRYOKU};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:10px;letter-spacing:0.03em;">
            ${t('email.cta')}
          </a>
        </div>

      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding:22px 0 8px;">
      <p style="font-size:11px;color:#B0B0A0;margin:0;line-height:1.8;">
        ${t('email.footer.line1')}<br>
        <span style="font-size:10px;">${t('email.footer.line2')}</span>
      </p>
    </div>

  </div>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'Missing bookingId' }, { status: 400 })

  const booking = await getBookingById(bookingId)
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (!booking.email) return NextResponse.json({ error: 'No email address for this guest' }, { status: 400 })

  const existing = await getEmailStatus(bookingId)
  if (existing?.sent) return NextResponse.json({ alreadySent: true, sentAt: existing.sentAt })

  const topOffers = (offersData as OfferTemplate[])
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 3)

  const offerUrl  = `${BASE_URL}/offer/${bookingId}`
  const locale    = normalizeBookingLocale(booking.language)
  const firstName = booking.guest_name.split(' ')[0]
  const htmlBody  = await buildEmail(booking.guest_name, locale, offerUrl, booking.check_in, booking.check_out, booking.room_type, topOffers)

  const t = await getEmailTranslations(locale)

  const { error } = await resend.emails.send({
    from: 'Gappy Stay <onboarding@resend.dev>',
    to:   booking.email,
    subject: t('email.subject', { firstName }),
    html: htmlBody,
  })

  if (error) {
    console.error('Resend error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const sentAt = new Date().toISOString()
  await setEmailStatus(bookingId, { sent: true, sentAt })
  return NextResponse.json({ ok: true, sentAt })
}
