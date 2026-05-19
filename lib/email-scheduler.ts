import { Resend } from 'resend'
import type { Booking } from '@/types'
import { getAllBookings, getBookingById } from '@/lib/bookings'
import {
  getEmailStatus,
  setEmailStatus,
  type EmailKind,
} from '@/lib/runtime-store'
import { normalizeBookingLocale } from '@/lib/i18n/resolve'
import { renderPreArrivalEmail } from '@/lib/email-render'

// ---------------------------------------------------------------------------
// Provider abstraction
// ---------------------------------------------------------------------------
// One narrow interface so the transport can swap (Resend → SES) without
// touching the scheduler or the route. NA-2 will decide which provider wins;
// the rest of the codebase only talks to `getEmailProvider()`.

export type EmailSendParams = {
  from: string
  to: string
  subject: string
  html: string
  text: string
}

export type EmailSendResult =
  | { ok: true }
  | { ok: false; error: string }

export interface EmailProvider {
  readonly name: 'resend' | 'ses'
  send(params: EmailSendParams): Promise<EmailSendResult>
}

class ResendProvider implements EmailProvider {
  readonly name = 'resend' as const
  private client: Resend
  constructor(apiKey: string | undefined) {
    this.client = new Resend(apiKey)
  }
  async send(params: EmailSendParams): Promise<EmailSendResult> {
    const { error } = await this.client.emails.send(params)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }
}

// SES provider stub — wire up `@aws-sdk/client-sesv2` here if NA-2 picks SES.
// Kept as a placeholder so the factory has a real second branch and the
// interface shape is exercised.
class SesProviderStub implements EmailProvider {
  readonly name = 'ses' as const
  async send(_params: EmailSendParams): Promise<EmailSendResult> {
    return { ok: false, error: 'SES provider not yet implemented' }
  }
}

let cachedProvider: EmailProvider | null = null

export function getEmailProvider(): EmailProvider {
  if (cachedProvider) return cachedProvider
  const choice = (process.env.EMAIL_PROVIDER ?? 'resend').toLowerCase()
  cachedProvider = choice === 'ses'
    ? new SesProviderStub()
    : new ResendProvider(process.env.RESEND_API_KEY)
  return cachedProvider
}

// Test seam — lets unit tests inject a fake without env juggling.
export function __setEmailProviderForTests(p: EmailProvider | null) {
  cachedProvider = p
}

// ---------------------------------------------------------------------------
// Schedule definition
// ---------------------------------------------------------------------------

export type ScheduleAnchor = 'confirmation' | 'check_in'

export type EmailSchedule = {
  kind: EmailKind
  anchor: ScheduleAnchor
  // Milliseconds added to the anchor. Positive = after anchor, negative =
  // before. Example: anchor='confirmation', offsetMs=+3d → send 3 days after
  // booking is confirmed.
  offsetMs: number
}

const DAY_MS = 24 * 60 * 60 * 1000

// Fixed schedule used for every guest in the MVP. Per product brief
// ("予約確定後〜チェックイン直前までの全期間"), we anchor on confirmation
// rather than on a fixed offset from check-in.
export const PRE_ARRIVAL_SCHEDULE: EmailSchedule = {
  kind: 'prearrival',
  anchor: 'confirmation',
  offsetMs: 3 * DAY_MS,
}

// ---------------------------------------------------------------------------
// Schedule evaluation
// ---------------------------------------------------------------------------

// Derive a confirmation timestamp when the booking lacks `confirmed_at`.
// Legacy fixtures don't carry it; assume confirmation happened a week before
// check-in so the skeleton can still exercise the full path against demo
// data. Real data will set `confirmed_at` explicitly.
const ASSUMED_CONFIRMATION_LEAD_MS = 7 * DAY_MS

function getAnchorDate(booking: Booking, schedule: EmailSchedule): Date | null {
  if (schedule.anchor === 'check_in') {
    const t = Date.parse(booking.check_in)
    return Number.isNaN(t) ? null : new Date(t)
  }
  if (booking.confirmed_at) {
    const t = Date.parse(booking.confirmed_at)
    if (!Number.isNaN(t)) return new Date(t)
  }
  const checkIn = Date.parse(booking.check_in)
  if (Number.isNaN(checkIn)) return null
  return new Date(checkIn - ASSUMED_CONFIRMATION_LEAD_MS)
}

export function getScheduledSendTime(
  booking: Booking,
  schedule: EmailSchedule = PRE_ARRIVAL_SCHEDULE,
): Date | null {
  const anchor = getAnchorDate(booking, schedule)
  if (!anchor) return null
  const scheduled = new Date(anchor.getTime() + schedule.offsetMs)
  // Clamp: never schedule after check-in. Product rule — pre-arrival means
  // before arrival.
  const checkIn = Date.parse(booking.check_in)
  if (!Number.isNaN(checkIn) && scheduled.getTime() > checkIn) {
    return new Date(checkIn)
  }
  return scheduled
}

export function isDue(
  booking: Booking,
  schedule: EmailSchedule,
  now: Date = new Date(),
): boolean {
  const send = getScheduledSendTime(booking, schedule)
  if (!send) return false
  if (now.getTime() < send.getTime()) return false
  // Don't fire if check-in has already passed.
  const checkIn = Date.parse(booking.check_in)
  if (!Number.isNaN(checkIn) && now.getTime() > checkIn) return false
  return true
}

export function getDueBookings(
  bookings: Booking[],
  schedule: EmailSchedule,
  now: Date = new Date(),
): Booking[] {
  return bookings.filter((b) => !!b.email && isDue(b, schedule, now))
}

// ---------------------------------------------------------------------------
// Send core — shared by the API route and the scheduler tick
// ---------------------------------------------------------------------------

export type SendPreArrivalResult =
  | { status: 'sent'; sentAt: string }
  | { status: 'already_sent'; sentAt: string }
  | { status: 'skipped'; reason: 'no_email' | 'not_found' }
  | { status: 'error'; error: string }

export type SendPreArrivalOptions = {
  bookingId: string
  baseUrl: string
  from?: string
  provider?: EmailProvider
}

const DEFAULT_FROM = 'Gappy Stay <onboarding@resend.dev>'

export async function sendPreArrivalEmail(
  opts: SendPreArrivalOptions,
): Promise<SendPreArrivalResult> {
  const booking = await getBookingById(opts.bookingId)
  if (!booking) return { status: 'skipped', reason: 'not_found' }
  if (!booking.email) return { status: 'skipped', reason: 'no_email' }

  const existing = await getEmailStatus(opts.bookingId, 'prearrival')
  if (existing?.sent) {
    return { status: 'already_sent', sentAt: existing.sentAt }
  }

  const locale = normalizeBookingLocale(booking.language)
  const ctaUrl = `${opts.baseUrl}/offer/${opts.bookingId}`
  const { html, text, subject } = await renderPreArrivalEmail({
    booking,
    locale,
    ctaUrl,
  })

  const provider = opts.provider ?? getEmailProvider()
  const result = await provider.send({
    from: opts.from ?? DEFAULT_FROM,
    to: booking.email,
    subject,
    html,
    text,
  })

  if (!result.ok) {
    console.error(`[${provider.name}] send error:`, result.error)
    return { status: 'error', error: result.error }
  }

  const sentAt = new Date().toISOString()
  await setEmailStatus(opts.bookingId, { sent: true, sentAt }, 'prearrival')
  return { status: 'sent', sentAt }
}

// ---------------------------------------------------------------------------
// Tick — the cron-style entry point
// ---------------------------------------------------------------------------
// Skeleton: enumerates all bookings, finds those due, and sends. The actual
// scheduler trigger (Vercel Cron, QStash, etc.) wires up later and just
// calls this. Kept idempotent via the existing `email-status` Redis key, so
// firing the tick more often than needed is safe.

export type TickResult = {
  evaluated: number
  due: number
  sent: number
  alreadySent: number
  errors: { bookingId: string; error: string }[]
}

export type RunPreArrivalTickOptions = {
  baseUrl: string
  now?: Date
  schedule?: EmailSchedule
  provider?: EmailProvider
}

export async function runPreArrivalTick(
  opts: RunPreArrivalTickOptions,
): Promise<TickResult> {
  const now = opts.now ?? new Date()
  const schedule = opts.schedule ?? PRE_ARRIVAL_SCHEDULE
  const bookings = await getAllBookings()
  const due = getDueBookings(bookings, schedule, now)

  const result: TickResult = {
    evaluated: bookings.length,
    due: due.length,
    sent: 0,
    alreadySent: 0,
    errors: [],
  }

  for (const booking of due) {
    const r = await sendPreArrivalEmail({
      bookingId: booking.booking_id,
      baseUrl: opts.baseUrl,
      provider: opts.provider,
    })
    if (r.status === 'sent') result.sent += 1
    else if (r.status === 'already_sent') result.alreadySent += 1
    else if (r.status === 'error') {
      result.errors.push({ bookingId: booking.booking_id, error: r.error })
    }
  }
  return result
}
