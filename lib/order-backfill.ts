import type { Order } from '@/types'

type RawOrder = Omit<Order, 'status' | 'updated_at' | 'updated_by'> &
  Partial<Pick<Order, 'status' | 'updated_at' | 'updated_by'>>

export function backfillOrder(raw: RawOrder): Order {
  return {
    ...raw,
    status: raw.status ?? 'pending',
    updated_at: raw.updated_at ?? raw.created_at,
    updated_by: raw.updated_by ?? null,
  }
}

export function needsBackfill(raw: RawOrder): boolean {
  return (
    raw.status === undefined ||
    raw.updated_at === undefined ||
    raw.updated_by === undefined
  )
}
