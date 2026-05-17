/**
 * Migration 0001: backfill Order.status / updated_at / updated_by
 *
 * Forward:  add status='pending', updated_at=created_at, updated_by=null
 *           to every Order row that is missing any of the three fields.
 * Rollback: strip those three fields from every Order row that has them.
 *
 * Both modes are idempotent — re-running yields affected=0.
 *
 * Usage:
 *   tsx lib/migrations/0001-order-status-backfill.ts             # apply
 *   tsx lib/migrations/0001-order-status-backfill.ts --dry-run   # report only
 *   tsx lib/migrations/0001-order-status-backfill.ts --rollback  # remove fields
 */
import type { Redis } from '@upstash/redis'
import type { Order } from '@/types'
import { backfillOrder, needsBackfill } from '@/lib/order-backfill'

type RawOrder = Parameters<typeof backfillOrder>[0]
export type MigrationMode = 'apply' | 'dry-run' | 'rollback'
export type MigrationResult = {
  mode: MigrationMode
  total: number
  affected: number
  wrote: boolean
}

const KEY_ORDERS = 'hotel:default:orders'

export async function run(redis: Redis, mode: MigrationMode): Promise<MigrationResult> {
  if (mode === 'rollback') {
    const orders = (await redis.get<Order[]>(KEY_ORDERS)) ?? []
    const affected = orders.filter(
      (o) => 'status' in o || 'updated_at' in o || 'updated_by' in o,
    ).length
    if (affected === 0) {
      return { mode, total: orders.length, affected: 0, wrote: false }
    }
    const reverted = orders.map((o) => {
      const { status: _s, updated_at: _u, updated_by: _b, ...rest } = o
      void _s; void _u; void _b
      return rest as RawOrder
    })
    await redis.set(KEY_ORDERS, reverted)
    return { mode, total: orders.length, affected, wrote: true }
  }

  const orders = (await redis.get<RawOrder[]>(KEY_ORDERS)) ?? []
  const affected = orders.filter(needsBackfill).length
  if (affected === 0 || mode === 'dry-run') {
    return { mode, total: orders.length, affected, wrote: false }
  }
  await redis.set(KEY_ORDERS, orders.map(backfillOrder))
  return { mode, total: orders.length, affected, wrote: true }
}

function parseMode(argv: string[]): MigrationMode {
  if (argv.includes('--rollback')) return 'rollback'
  if (argv.includes('--dry-run')) return 'dry-run'
  return 'apply'
}

async function main() {
  const mode = parseMode(process.argv.slice(2))
  const { Redis } = await import('@upstash/redis')
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) {
    console.error(
      JSON.stringify({
        migration: '0001-order-status-backfill',
        error: 'KV_REST_API_URL / KV_REST_API_TOKEN must be set',
      }),
    )
    process.exit(1)
  }
  const redis = new Redis({ url, token })
  const result = await run(redis, mode)
  console.log(JSON.stringify({ migration: '0001-order-status-backfill', ...result }))
}

const invokedFromCli =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  process.argv[1].endsWith('0001-order-status-backfill.ts')

if (invokedFromCli) {
  main().catch((err) => {
    console.error(
      JSON.stringify({
        migration: '0001-order-status-backfill',
        error: err instanceof Error ? err.message : String(err),
      }),
    )
    process.exit(1)
  })
}
