import { describe, expect, it } from 'vitest'
import { run } from './0001-order-status-backfill'
import { createFakeRedis } from '@/test/fake-redis'

const KEY = 'hotel:default:orders'

function legacyOrder(id: string) {
  return {
    order_id: id,
    booking_id: 'BK-1',
    guest_name: 'Alice',
    room_type: 'Deluxe',
    check_in: '2026-06-01T15:00:00Z',
    items: [],
    total: 1000,
    created_at: '2026-05-01T10:00:00Z',
  }
}

describe('migration 0001-order-status-backfill', () => {
  it('apply: backfills missing fields and writes', async () => {
    const redis = createFakeRedis()
    await redis.set(KEY, [legacyOrder('A'), legacyOrder('B')])
    const r = await run(redis, 'apply')
    expect(r).toEqual({ mode: 'apply', total: 2, affected: 2, wrote: true })
    const after = await redis.get<Array<Record<string, unknown>>>(KEY)
    expect(after?.[0]).toMatchObject({
      order_id: 'A',
      status: 'pending',
      updated_at: '2026-05-01T10:00:00Z',
      updated_by: null,
    })
  })

  it('apply re-run: idempotent no-op', async () => {
    const redis = createFakeRedis()
    await redis.set(KEY, [legacyOrder('A')])
    await run(redis, 'apply')
    const r2 = await run(redis, 'apply')
    expect(r2).toEqual({ mode: 'apply', total: 1, affected: 0, wrote: false })
  })

  it('dry-run: reports affected count without writing', async () => {
    const redis = createFakeRedis()
    const orders = [legacyOrder('A')]
    await redis.set(KEY, orders)
    const snapshot = JSON.stringify(orders)
    const r = await run(redis, 'dry-run')
    expect(r).toEqual({ mode: 'dry-run', total: 1, affected: 1, wrote: false })
    const after = await redis.get(KEY)
    expect(JSON.stringify(after)).toBe(snapshot)
  })

  it('rollback: strips fields and reports affected', async () => {
    const redis = createFakeRedis()
    await redis.set(KEY, [legacyOrder('A')])
    await run(redis, 'apply')
    const r = await run(redis, 'rollback')
    expect(r).toEqual({ mode: 'rollback', total: 1, affected: 1, wrote: true })
    const after = await redis.get<Array<Record<string, unknown>>>(KEY)
    expect(after?.[0]).not.toHaveProperty('status')
    expect(after?.[0]).not.toHaveProperty('updated_at')
    expect(after?.[0]).not.toHaveProperty('updated_by')
  })

  it('rollback re-run: idempotent no-op', async () => {
    const redis = createFakeRedis()
    await redis.set(KEY, [legacyOrder('A')])
    await run(redis, 'apply')
    await run(redis, 'rollback')
    const r2 = await run(redis, 'rollback')
    expect(r2).toEqual({ mode: 'rollback', total: 1, affected: 0, wrote: false })
  })

  it('apply on empty store: no-op', async () => {
    const redis = createFakeRedis()
    const r = await run(redis, 'apply')
    expect(r).toEqual({ mode: 'apply', total: 0, affected: 0, wrote: false })
  })
})
