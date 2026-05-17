import { NextRequest, NextResponse } from 'next/server'
import { getRuntimeOrders, addRuntimeOrder, setRuntimeOrders } from '@/lib/runtime-store'
import { backfillOrder } from '@/lib/order-backfill'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ orders: await getRuntimeOrders() })
}

export async function POST(req: NextRequest) {
  const raw = await req.json()
  await addRuntimeOrder(backfillOrder(raw))
  return NextResponse.json({ ok: true })
}

export async function DELETE() {
  await setRuntimeOrders([])
  return NextResponse.json({ ok: true })
}
