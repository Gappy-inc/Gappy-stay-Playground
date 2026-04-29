import { NextRequest, NextResponse } from 'next/server'
import { getRuntimeOrders, addRuntimeOrder } from '@/lib/runtime-store'
import { Order } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ orders: getRuntimeOrders() })
}

export async function POST(req: NextRequest) {
  const order: Order = await req.json()
  addRuntimeOrder(order)
  return NextResponse.json({ ok: true })
}
