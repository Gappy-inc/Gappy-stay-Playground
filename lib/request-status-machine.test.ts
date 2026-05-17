import { describe, expect, it } from 'vitest'
import { transition } from './request-status-machine'
import type { RequestStatus } from '@/types/request'

const STATUSES: RequestStatus[] = ['pending', 'approved', 'rejected']

describe('transition()', () => {
  it('legal: pending → approved', () => {
    expect(transition('pending', 'approved')).toEqual({
      ok: true, nextStatus: 'approved', changed: true,
    })
  })

  it('legal: pending → rejected', () => {
    expect(transition('pending', 'rejected')).toEqual({
      ok: true, nextStatus: 'rejected', changed: true,
    })
  })

  it.each(STATUSES)('idempotent: %s → %s is no-op', (s) => {
    expect(transition(s, s)).toEqual({ ok: true, nextStatus: s, changed: false })
  })

  it('illegal: approved → rejected', () => {
    expect(transition('approved', 'rejected')).toEqual({
      ok: false, code: 'illegal_transition', from: 'approved', to: 'rejected',
    })
  })

  it('illegal: approved → pending', () => {
    expect(transition('approved', 'pending')).toEqual({
      ok: false, code: 'illegal_transition', from: 'approved', to: 'pending',
    })
  })

  it('illegal: rejected → approved', () => {
    expect(transition('rejected', 'approved')).toEqual({
      ok: false, code: 'illegal_transition', from: 'rejected', to: 'approved',
    })
  })

  it('illegal: rejected → pending', () => {
    expect(transition('rejected', 'pending')).toEqual({
      ok: false, code: 'illegal_transition', from: 'rejected', to: 'pending',
    })
  })

  it('covers all 9 combinations of the 3x3 matrix', () => {
    const results = STATUSES.flatMap((from) =>
      STATUSES.map((to) => ({ from, to, result: transition(from, to) })),
    )
    expect(results).toHaveLength(9)
    const legal = results.filter((r) => r.result.ok).length
    const illegal = results.filter((r) => !r.result.ok).length
    // 3 self-loops + 2 from pending = 5 legal; 4 illegal (the 2x2 illegal corner)
    expect(legal).toBe(5)
    expect(illegal).toBe(4)
  })
})
