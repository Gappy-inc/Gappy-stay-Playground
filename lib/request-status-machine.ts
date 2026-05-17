import type { RequestStatus } from '@/types/request'

export type TransitionResult =
  | { ok: true; nextStatus: RequestStatus; changed: boolean }
  | { ok: false; code: 'illegal_transition'; from: RequestStatus; to: RequestStatus }

export function transition(from: RequestStatus, to: RequestStatus): TransitionResult {
  if (from === to) {
    return { ok: true, nextStatus: to, changed: false }
  }
  if (from === 'pending' && (to === 'approved' || to === 'rejected')) {
    return { ok: true, nextStatus: to, changed: true }
  }
  return { ok: false, code: 'illegal_transition', from, to }
}
