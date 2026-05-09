import { NextRequest, NextResponse } from 'next/server'
import { getRuntimeOrders, addRuntimeOrder } from '@/lib/runtime-store'
import { Order } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ orders: await getRuntimeOrders() })
}

export async function POST(req: NextRequest) {
  const order: Order = await req.json()
  await addRuntimeOrder(order)
  return NextResponse.json({ ok: true })
}
