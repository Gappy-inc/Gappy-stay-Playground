import fs from 'fs'
import path from 'path'
import type { Booking, Order } from '@/types'

const DATA_DIR = path.join(process.cwd(), 'data')

function readJSON<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf-8'))
  } catch {
    return fallback
  }
}

function writeJSON(file: string, data: unknown): void {
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2))
}

export function getRuntimeBookings(): Booking[] {
  return readJSON<Booking[]>('runtime-bookings.json', [])
}

export function setRuntimeBookings(bookings: Booking[]): void {
  writeJSON('runtime-bookings.json', bookings)
}

export function getRuntimeOrders(): Order[] {
  return readJSON<Order[]>('runtime-orders.json', [])
}

export function addRuntimeOrder(order: Order): void {
  const orders = getRuntimeOrders()
  if (!orders.find((o) => o.order_id === order.order_id)) {
    orders.push(order)
    writeJSON('runtime-orders.json', orders)
  }
}

export function getPausedOfferIds(): string[] {
  return readJSON<string[]>('runtime-paused-offers.json', [])
}

export function setPausedOfferIds(ids: string[]): void {
  writeJSON('runtime-paused-offers.json', ids)
}
