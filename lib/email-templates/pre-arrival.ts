// Brief T-6 originally specified `emails/PreArrivalEmail.tsx` (React Email).
// React Email is not in the dependency tree, and the existing send-offer-email
// route uses raw HTML strings — staying consistent with that pattern avoids
// adding a build-affecting dependency for a single template. Moved here per
// DD-2 in the brief.

import type { getEmailTranslations } from '@/lib/i18n/email'
import type { Booking } from '@/types'

export type Property = {
  hotel_name: string
  logo_url: string
  hero_image_url: string
  address: string
  check_in_time: string
  check_out_time: string
}

type EmailTranslator = Awaited<ReturnType<typeof getEmailTranslations>>

export type PreArrivalTemplateInput = {
  t: EmailTranslator
  property: Property
  booking: Booking
  ctaUrl: string
  firstName: string
  checkInDate: string
}

const COLOR = {
  shinryoku: '#5B8A3C',
  sumi: '#2C4A1E',
  bg: '#F8F6F0',
  border: '#F0EBE0',
  subtext: '#7A8C70',
} as const

export function buildPreArrivalHtml(input: PreArrivalTemplateInput): string {
  const { t, property, booking, ctaUrl, firstName } = input

  const logoBlock = property.logo_url
    ? `<img src="${escapeAttr(property.logo_url)}" alt="${escapeAttr(property.hotel_name)}" style="max-height:48px;display:block;margin:0 auto;">`
    : `<div style="font-size:20px;font-weight:700;color:${COLOR.sumi};letter-spacing:0.06em;">${escapeHtml(property.hotel_name)}</div>`

  const heroBlock = property.hero_image_url
    ? `<img src="${escapeAttr(property.hero_image_url)}" alt="" style="width:100%;height:auto;display:block;">`
    : ''

  return `<!DOCTYPE html>
<html lang="${booking.language}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(property.hotel_name)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.bg};font-family:'DM Sans',Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">

    <div style="text-align:center;padding:28px 0 20px;">
      ${logoBlock}
    </div>

    <div style="background:#ffffff;border-radius:16px;border:1px solid ${COLOR.border};overflow:hidden;box-shadow:0 2px 12px rgba(44,74,30,0.06);">

      <div style="height:5px;background:linear-gradient(90deg,${COLOR.shinryoku},#A8C97F);"></div>

      ${heroBlock}

      <div style="padding:32px 32px 28px;">

        <p style="font-size:22px;font-weight:600;color:${COLOR.sumi};margin:0 0 16px;">${escapeHtml(t('email.preArrival.greeting', { firstName }))}</p>

        <p style="font-size:14px;color:${COLOR.subtext};line-height:1.65;margin:0 0 24px;">${escapeHtml(t('email.preArrival.intro', { hotelName: property.hotel_name, checkInDate: input.checkInDate }))}</p>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 24px;font-size:14px;color:${COLOR.sumi};">
          <tr>
            <td style="padding:6px 0;color:${COLOR.subtext};width:110px;">${escapeHtml(t('email.preArrival.checkIn'))}</td>
            <td style="padding:6px 0;">${escapeHtml(property.check_in_time)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${COLOR.subtext};">${escapeHtml(t('email.preArrival.checkOut'))}</td>
            <td style="padding:6px 0;">${escapeHtml(property.check_out_time)}</td>
          </tr>
          <tr>
            <td style="padding:6px 0;color:${COLOR.subtext};">${escapeHtml(t('email.preArrival.address'))}</td>
            <td style="padding:6px 0;">${escapeHtml(property.address)}</td>
          </tr>
        </table>

        <p style="font-size:14px;color:${COLOR.subtext};line-height:1.65;margin:0 0 28px;">${escapeHtml(t('email.preArrival.body'))}</p>

        <div style="text-align:center;">
          <a href="${escapeAttr(ctaUrl)}"
            style="display:inline-block;background:${COLOR.shinryoku};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 36px;border-radius:10px;letter-spacing:0.03em;">
            ${escapeHtml(t('email.preArrival.cta'))}
          </a>
        </div>

      </div>
    </div>

    <div style="text-align:center;padding:22px 0 8px;">
      <p style="font-size:11px;color:#B0B0A0;margin:0;line-height:1.8;">
        Powered by Gappy Stay<br>
        <span style="font-size:10px;">${escapeHtml(t('email.preArrival.footer'))}</span>
      </p>
    </div>

  </div>
</body>
</html>`
}

export function buildPreArrivalText(input: PreArrivalTemplateInput): string {
  const { t, property, ctaUrl, firstName } = input
  return [
    t('email.preArrival.greeting', { firstName }),
    '',
    t('email.preArrival.intro', { hotelName: property.hotel_name, checkInDate: input.checkInDate }),
    '',
    `${t('email.preArrival.checkIn')}: ${property.check_in_time}`,
    `${t('email.preArrival.checkOut')}: ${property.check_out_time}`,
    `${t('email.preArrival.address')}: ${property.address}`,
    '',
    t('email.preArrival.body'),
    '',
    `${t('email.preArrival.cta')} ${ctaUrl}`,
    '',
    '---',
    'Powered by Gappy Stay',
    t('email.preArrival.footer'),
  ].join('\n')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, '&quot;')
}
