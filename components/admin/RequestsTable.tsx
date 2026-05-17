'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Order } from '@/types'
import type { RequestStatus } from '@/types/request'
import { StatusBadge } from './StatusBadge'
import { StatusActions, type StatusActionsNotice } from './StatusActions'

const NOTICE_AUTO_DISMISS_MS = 3000

const NOTICE_COLOR: Record<StatusActionsNotice['kind'], string> = {
  success: 'bg-green-600',
  info:    'bg-slate-700',
  error:   'bg-red-600',
}

export function RequestsTable() {
  const [orders, setOrders]   = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [notice, setNotice]   = useState<StatusActionsNotice | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/admin/requests')
      const json = (await res.json()) as { requests: Order[] }
      setOrders(json.requests ?? [])
    } catch {
      setNotice({ kind: 'error', text: 'リクエストの読み込みに失敗しました' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), NOTICE_AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [notice])

  function applyOptimistic(orderId: string, nextStatus: RequestStatus) {
    setOrders((prev) =>
      prev.map((o) =>
        o.order_id === orderId
          ? { ...o, status: nextStatus, updated_at: new Date().toISOString() }
          : o,
      ),
    )
  }

  function rollback(orderId: string, previousStatus: RequestStatus) {
    setOrders((prev) =>
      prev.map((o) => (o.order_id === orderId ? { ...o, status: previousStatus } : o)),
    )
  }

  if (loading) {
    return <div className="py-8 text-center text-sm text-gray-500">Loading…</div>
  }

  if (orders.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-gray-500">
        No requests yet — guests haven&apos;t completed checkout
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="py-2 pr-4 font-medium">Order</th>
              <th className="py-2 pr-4 font-medium">Guest</th>
              <th className="py-2 pr-4 font-medium">Items</th>
              <th className="py-2 pr-4 font-medium text-right">Total</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Updated</th>
              <th className="py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.order_id} className="border-b border-gray-100">
                <td className="py-3 pr-4 font-mono text-xs text-gray-700">{o.order_id}</td>
                <td className="py-3 pr-4">
                  <div className="font-medium text-gray-900">{o.guest_name}</div>
                  <div className="text-xs text-gray-500">{o.room_type}</div>
                </td>
                <td className="py-3 pr-4 text-gray-700">{o.items.length}</td>
                <td className="py-3 pr-4 text-right font-semibold text-gray-900">
                  ¥{o.total.toLocaleString()}
                </td>
                <td className="py-3 pr-4"><StatusBadge status={o.status} /></td>
                <td className="py-3 pr-4 text-xs text-gray-500">
                  {new Date(o.updated_at).toLocaleString('ja-JP')}
                </td>
                <td className="py-3 text-right">
                  <StatusActions
                    requestId={o.order_id}
                    status={o.status}
                    onChange={(next) => applyOptimistic(o.order_id, next)}
                    onRollback={(prev) => rollback(o.order_id, prev)}
                    onNotice={setNotice}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-md text-sm text-white shadow-lg ${NOTICE_COLOR[notice.kind]}`}
        >
          {notice.text}
        </div>
      )}
    </>
  )
}
