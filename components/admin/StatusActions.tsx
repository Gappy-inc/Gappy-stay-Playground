'use client'

import { useEffect, useRef, useState } from 'react'
import type {
  RequestStatus,
  UpdateRequestStatusResponse,
  UpdateRequestStatusError,
} from '@/types/request'

const REJECT_CONFIRM_TIMEOUT_MS = 3000

export type StatusActionsNotice = {
  kind: 'success' | 'info' | 'error'
  text: string
}

type Props = {
  requestId: string
  status: RequestStatus
  onChange: (next: RequestStatus) => void
  onRollback: (previous: RequestStatus) => void
  onNotice?: (n: StatusActionsNotice) => void
}

export function StatusActions({ requestId, status, onChange, onRollback, onNotice }: Props) {
  const [submitting, setSubmitting]     = useState<null | 'approve' | 'reject'>(null)
  const [pendingReject, setPendingReject] = useState(false)
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (rejectTimer.current) clearTimeout(rejectTimer.current) }, [])

  if (status !== 'pending') return null

  async function send(target: 'approved' | 'rejected') {
    const previous = status
    setSubmitting(target === 'approved' ? 'approve' : 'reject')
    onChange(target)
    try {
      const res = await fetch(`/api/admin/requests/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: target }),
      })
      const body = (await res.json()) as
        | UpdateRequestStatusResponse
        | UpdateRequestStatusError

      if (res.ok && 'changed' in body) {
        onNotice?.(
          body.changed
            ? { kind: 'success', text: target === 'approved' ? 'Approved' : 'Rejected' }
            : { kind: 'info', text: 'Already updated' },
        )
        return
      }
      onRollback(previous)
      if ('error' in body) {
        if (body.error === 'locked') {
          onNotice?.({
            kind: 'error',
            text: '他のスタッフが同時に操作中です。少し待ってからもう一度お試しください',
          })
        } else if (body.error === 'illegal_transition') {
          onNotice?.({ kind: 'error', text: '他の管理者により変更されました' })
        } else if (body.error === 'not_found') {
          onNotice?.({ kind: 'error', text: 'リクエストが見つかりません' })
        } else {
          onNotice?.({ kind: 'error', text: '更新に失敗しました' })
        }
      } else {
        onNotice?.({ kind: 'error', text: '更新に失敗しました' })
      }
    } catch {
      onRollback(previous)
      onNotice?.({ kind: 'error', text: 'ネットワークエラー' })
    } finally {
      setSubmitting(null)
      setPendingReject(false)
      if (rejectTimer.current) {
        clearTimeout(rejectTimer.current)
        rejectTimer.current = null
      }
    }
  }

  function onRejectClick() {
    if (!pendingReject) {
      setPendingReject(true)
      rejectTimer.current = setTimeout(() => {
        setPendingReject(false)
        rejectTimer.current = null
      }, REJECT_CONFIRM_TIMEOUT_MS)
      return
    }
    void send('rejected')
  }

  const busy = submitting !== null

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => void send('approved')}
        disabled={busy}
        aria-busy={submitting === 'approve'}
        className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting === 'approve' ? 'Approving…' : 'Approve'}
      </button>
      <button
        type="button"
        onClick={onRejectClick}
        disabled={busy && submitting !== 'reject'}
        aria-busy={submitting === 'reject'}
        aria-live="polite"
        className={`inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white disabled:opacity-50 disabled:cursor-not-allowed ${
          pendingReject
            ? 'bg-red-800 hover:bg-red-900 ring-2 ring-red-300'
            : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        {submitting === 'reject'
          ? 'Rejecting…'
          : pendingReject
            ? 'Confirm Reject'
            : 'Reject'}
      </button>
    </div>
  )
}
