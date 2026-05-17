import { Redis } from '@upstash/redis'
import type { Booking, Order } from '@/types'
import { backfillOrder } from '@/lib/order-backfill'

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
  const data = await redis.get<Parameters<typeof backfillOrder>[0][]>(KEY_ORDERS)
  return (data ?? []).map(backfillOrder)
}

export async function setRuntimeOrders(orders: Order[]): Promise<void> {
  await redis.set(KEY_ORDERS, orders)
}

export async function addRuntimeOrder(order: Order): Promise<void> {
  const orders = await getRuntimeOrders()
  if (!orders.find((o) => o.order_id === order.order_id)) {
    await redis.set(KEY_ORDERS, [...orders, backfillOrder(order)])
  }
}

const ORDER_LOCK_TTL_SECONDS = 5

export async function acquireOrderLock(orderId: string): Promise<boolean> {
  const result = await redis.set(
    `hotel:${HOTEL_ID}:order-lock:${orderId}`,
    Date.now().toString(),
    { nx: true, ex: ORDER_LOCK_TTL_SECONDS },
  )
  return result === 'OK'
}

export async function releaseOrderLock(orderId: string): Promise<void> {
  await redis.del(`hotel:${HOTEL_ID}:order-lock:${orderId}`)
}

export async function getPausedOfferIds(): Promise<string[]> {
  const data = await redis.get<string[]>(KEY_PAUSED_OFFERS)
  return data ?? []
}

export async function setPausedOfferIds(ids: string[]): Promise<void> {
  await redis.set(KEY_PAUSED_OFFERS, ids)
}

export type EmailStatus = { sent: boolean; sentAt: string }

export async function getEmailStatus(bookingId: string): Promise<EmailStatus | null> {
  return redis.get<EmailStatus>(`hotel:${HOTEL_ID}:email-status:${bookingId}`)
}

export async function setEmailStatus(bookingId: string, status: EmailStatus): Promise<void> {
  await redis.set(`hotel:${HOTEL_ID}:email-status:${bookingId}`, status)
}

export async function getAllEmailStatuses(bookingIds: string[]): Promise<Record<string, EmailStatus>> {
  if (bookingIds.length === 0) return {}
  const results = await Promise.all(bookingIds.map(id => getEmailStatus(id)))
  const map: Record<string, EmailStatus> = {}
  bookingIds.forEach((id, i) => { if (results[i]) map[id] = results[i]! })
  return map
}
