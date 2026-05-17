import { Redis } from '@upstash/redis'
import type { Booking, Order } from '@/types'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

const HOTEL_ID = 'default'
const KEY_BOOKINGS     = `hotel:${HOTEL_ID}:bookings`
const KEY_ORDERS       = `hotel:${HOTEL_ID}:orders`
const KEY_PAUSED_OFFERS = `hotel:${HOTEL_ID}:paused-offers`

export async function getRuntimeBookings(): Promise<Booking[]> {
  const data = await redis.get<Booking[]>(KEY_BOOKINGS)
  return data ?? []
}

export async function setRuntimeBookings(bookings: Booking[]): Promise<void> {
  await redis.set(KEY_BOOKINGS, bookings)
}

export async function getRuntimeOrders(): Promise<Order[]> {
  const data = await redis.get<Order[]>(KEY_ORDERS)
  return data ?? []
}

export async function setRuntimeOrders(orders: Order[]): Promise<void> {
  await redis.set(KEY_ORDERS, orders)
}

export async function addRuntimeOrder(order: Order): Promise<void> {
  const orders = await getRuntimeOrders()
  if (!orders.find((o) => o.order_id === order.order_id)) {
    await redis.set(KEY_ORDERS, [...orders, order])
  }
}

export async function getPausedOfferIds(): Promise<string[]> {
  const data = await redis.get<string[]>(KEY_PAUSED_OFFERS)
  return data ?? []
}

export async function setPausedOfferIds(ids: string[]): Promise<void> {
  await redis.set(KEY_PAUSED_OFFERS, ids)
}

export type EmailStatus = { sent: boolean; sentAt: string }

/**
 * Email kinds tracked independently for idempotency. A booking can have
 * both an `offer` email and a `prearrival` email — they must not share a
 * Redis key, otherwise sending one would mark the other as already-sent.
 */
export type EmailKind = 'offer' | 'prearrival'

function emailStatusKey(bookingId: string, kind: EmailKind): string {
  // Legacy 'offer' entries are stored at the unsuffixed key; preserve
  // that prefix so Redis state written before pre-arrival shipped still
  // resolves correctly.
  return kind === 'offer'
    ? `hotel:${HOTEL_ID}:email-status:${bookingId}`
    : `hotel:${HOTEL_ID}:email-status:${kind}:${bookingId}`
}

export async function getEmailStatus(bookingId: string, kind: EmailKind = 'offer'): Promise<EmailStatus | null> {
  return redis.get<EmailStatus>(emailStatusKey(bookingId, kind))
}

export async function setEmailStatus(bookingId: string, status: EmailStatus, kind: EmailKind = 'offer'): Promise<void> {
  await redis.set(emailStatusKey(bookingId, kind), status)
}

export async function getAllEmailStatuses(bookingIds: string[], kind: EmailKind = 'offer'): Promise<Record<string, EmailStatus>> {
  if (bookingIds.length === 0) return {}
  const results = await Promise.all(bookingIds.map(id => getEmailStatus(id, kind)))
  const map: Record<string, EmailStatus> = {}
  bookingIds.forEach((id, i) => { if (results[i]) map[id] = results[i]! })
  return map
}
