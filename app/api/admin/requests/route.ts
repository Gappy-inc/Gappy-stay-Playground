import { NextResponse } from 'next/server'
import { getRuntimeOrders } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const orders = await getRuntimeOrders()
  const sorted = [...orders].sort((a, b) => {
    const rank = { pending: 0, approved: 1, rejected: 2 } as const
    const r = rank[a.status] - rank[b.status]
    if (r !== 0) return r
    return b.updated_at.localeCompare(a.updated_at)
  })
  return NextResponse.json({ requests: sorted })
}
