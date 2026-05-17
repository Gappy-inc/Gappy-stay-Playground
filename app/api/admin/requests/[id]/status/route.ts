// "requests" in the URL maps to the Order entity in storage — see
// docs/designs/T-8-approval-workflow.md §0 for the rationale.
import { NextRequest, NextResponse } from 'next/server'
import {
  acquireOrderLock,
  getRuntimeOrders,
  releaseOrderLock,
  setRuntimeOrders,
} from '@/lib/runtime-store'
import { transition } from '@/lib/request-status-machine'
import {
  updateRequestStatusInputSchema,
  type RequestStatus,
  type UpdateRequestStatusError,
  type UpdateRequestStatusResponse,
} from '@/types/request'

export const dynamic = 'force-dynamic'

type LogFields = {
  event: string
  request_id: string
  from_status: RequestStatus | null
  to_status: RequestStatus | null
  changed: boolean
  latency_ms: number
  error?: { code: string; message: string }
}

function log(fields: LogFields) {
  console.log(JSON.stringify(fields))
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const t0 = Date.now()
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = updateRequestStatusInputSchema.safeParse(body)
  if (!parsed.success) {
    const payload: UpdateRequestStatusError = {
      error: 'validation_error',
      issues: parsed.error.issues,
    }
    log({
      event: 'request.status.validation_failed',
      request_id: id,
      from_status: null,
      to_status: null,
      changed: false,
      latency_ms: Date.now() - t0,
      error: { code: 'validation_error', message: parsed.error.message },
    })
    return NextResponse.json(payload, { status: 400 })
  }
  const toStatus = parsed.data.status

  const locked = await acquireOrderLock(id)
  if (!locked) {
    const payload: UpdateRequestStatusError = { error: 'locked' }
    log({
      event: 'request.status.locked',
      request_id: id,
      from_status: null,
      to_status: toStatus,
      changed: false,
      latency_ms: Date.now() - t0,
      error: { code: 'locked', message: 'another operation is in progress' },
    })
    return NextResponse.json(payload, { status: 409 })
  }

  try {
    const orders = await getRuntimeOrders()
    const idx = orders.findIndex((o) => o.order_id === id)
    if (idx === -1) {
      const payload: UpdateRequestStatusError = { error: 'not_found' }
      log({
        event: 'request.status.not_found',
        request_id: id,
        from_status: null,
        to_status: toStatus,
        changed: false,
        latency_ms: Date.now() - t0,
        error: { code: 'not_found', message: `order ${id} not found` },
      })
      return NextResponse.json(payload, { status: 404 })
    }

    const current = orders[idx]
    const result = transition(current.status, toStatus)
    if (!result.ok) {
      const payload: UpdateRequestStatusError = {
        error: 'illegal_transition',
        from: result.from,
        to: result.to,
      }
      log({
        event: 'request.status.illegal',
        request_id: id,
        from_status: current.status,
        to_status: toStatus,
        changed: false,
        latency_ms: Date.now() - t0,
        error: {
          code: 'illegal_transition',
          message: `cannot transition ${result.from} -> ${result.to}`,
        },
      })
      return NextResponse.json(payload, { status: 409 })
    }

    if (!result.changed) {
      const payload: UpdateRequestStatusResponse = {
        id,
        status: current.status,
        updated_at: current.updated_at,
        changed: false,
      }
      log({
        event: 'request.status.noop',
        request_id: id,
        from_status: current.status,
        to_status: toStatus,
        changed: false,
        latency_ms: Date.now() - t0,
      })
      return NextResponse.json(payload)
    }

    const updated_at = new Date().toISOString()
    const next = [...orders]
    next[idx] = {
      ...current,
      status: result.nextStatus,
      updated_at,
      updated_by: null,
    }
    await setRuntimeOrders(next)
    const payload: UpdateRequestStatusResponse = {
      id,
      status: result.nextStatus,
      updated_at,
      changed: true,
    }
    log({
      event: 'request.status.updated',
      request_id: id,
      from_status: current.status,
      to_status: result.nextStatus,
      changed: true,
      latency_ms: Date.now() - t0,
    })
    return NextResponse.json(payload)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const payload: UpdateRequestStatusError = { error: 'internal_error' }
    log({
      event: 'request.status.internal_error',
      request_id: id,
      from_status: null,
      to_status: toStatus,
      changed: false,
      latency_ms: Date.now() - t0,
      error: { code: 'internal_error', message },
    })
    return NextResponse.json(payload, { status: 500 })
  } finally {
    await releaseOrderLock(id)
  }
}
