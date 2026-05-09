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
