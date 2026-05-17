import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeRedis } from '@/test/fake-redis'

const fakeRedis = createFakeRedis()

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn(() => fakeRedis),
}))

// Required by runtime-store module-load
process.env.KV_REST_API_URL = 'http://fake'
process.env.KV_REST_API_TOKEN = 'fake'

const KEY_ORDERS = 'hotel:default:orders'

function order(overrides: Partial<{ status: string; order_id: string }> = {}) {
  return {
    order_id: 'ORD-1',
    booking_id: 'BK-1',
    guest_name: 'Alice',
    room_type: 'Deluxe',
    check_in: '2026-06-01T15:00:00Z',
    items: [],
    total: 1000,
    created_at: '2026-05-01T10:00:00Z',
    status: 'pending',
    updated_at: '2026-05-01T10:00:00Z',
    updated_by: null,
    ...overrides,
  }
}

async function patch(id: string, body: unknown) {
  const { PATCH } = await import('./route')
  const req = new Request(`http://localhost/api/admin/requests/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const res = await PATCH(req as any, { params: Promise.resolve({ id }) })
  return { status: res.status, body: await res.json() }
}

beforeEach(async () => {
  fakeRedis.__store.clear()
  fakeRedis.__expiries.clear()
})

describe('PATCH /api/admin/requests/[id]/status', () => {
  it('200 pending → approved (changed:true)', async () => {
    await fakeRedis.set(KEY_ORDERS, [order()])
    const r = await patch('ORD-1', { status: 'approved' })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ id: 'ORD-1', status: 'approved', changed: true })
    const after = await fakeRedis.get<any[]>(KEY_ORDERS)
    expect(after?.[0].status).toBe('approved')
  })

  it('200 pending → rejected (changed:true)', async () => {
    await fakeRedis.set(KEY_ORDERS, [order()])
    const r = await patch('ORD-1', { status: 'rejected' })
    expect(r.status).toBe(200)
    expect(r.body.status).toBe('rejected')
    expect(r.body.changed).toBe(true)
  })

  it('200 idempotent (approved → approved, changed:false)', async () => {
    await fakeRedis.set(KEY_ORDERS, [order({ status: 'approved' })])
    const r = await patch('ORD-1', { status: 'approved' })
    expect(r.status).toBe(200)
    expect(r.body.changed).toBe(false)
  })

  it('400 invalid status value', async () => {
    await fakeRedis.set(KEY_ORDERS, [order()])
    const r = await patch('ORD-1', { status: 'pending' })
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('validation_error')
    expect(Array.isArray(r.body.issues)).toBe(true)
  })

  it('400 missing body', async () => {
    await fakeRedis.set(KEY_ORDERS, [order()])
    const r = await patch('ORD-1', {})
    expect(r.status).toBe(400)
    expect(r.body.error).toBe('validation_error')
  })

  it('404 not found', async () => {
    await fakeRedis.set(KEY_ORDERS, [order()])
    const r = await patch('ORD-NOPE', { status: 'approved' })
    expect(r.status).toBe(404)
    expect(r.body.error).toBe('not_found')
  })

  it('409 illegal transition (approved → rejected)', async () => {
    await fakeRedis.set(KEY_ORDERS, [order({ status: 'approved' })])
    const r = await patch('ORD-1', { status: 'rejected' })
    expect(r.status).toBe(409)
    expect(r.body).toEqual({
      error: 'illegal_transition',
      from: 'approved',
      to: 'rejected',
    })
  })

  it('409 locked when another operation holds the order lock', async () => {
    await fakeRedis.set(KEY_ORDERS, [order()])
    // Pre-acquire the lock
    await fakeRedis.set('hotel:default:order-lock:ORD-1', '1', { nx: true, ex: 5 })
    const r = await patch('ORD-1', { status: 'approved' })
    expect(r.status).toBe(409)
    expect(r.body.error).toBe('locked')
  })

  it('lock is released even after a successful update', async () => {
    await fakeRedis.set(KEY_ORDERS, [order()])
    await patch('ORD-1', { status: 'approved' })
    expect(fakeRedis.__store.has('hotel:default:order-lock:ORD-1')).toBe(false)
  })
})
