import { NextRequest, NextResponse } from 'next/server'
import offersData from '@/data/offers.json'
import { getPausedOfferIds, setPausedOfferIds } from '@/lib/runtime-store'

export const dynamic = 'force-dynamic'

export function GET() {
  const pausedIds = getPausedOfferIds()
  return NextResponse.json({ offers: offersData, pausedIds })
}

export async function PATCH(req: NextRequest) {
  const { offer_id, active }: { offer_id: string; active: boolean } = await req.json()
  const paused = getPausedOfferIds()
  const updated = active
    ? paused.filter(id => id !== offer_id)
    : [...new Set([...paused, offer_id])]
  setPausedOfferIds(updated)
  return NextResponse.json({ ok: true, pausedIds: updated })
}
