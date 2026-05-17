import type { Redis } from '@upstash/redis'

/**
 * Minimal in-memory stand-in for the @upstash/redis client.
 * Only implements get/set/del + the {nx,ex} option used by acquireOrderLock.
 * Cast to Redis when handing it to code under test; mismatched extra surface
 * area is intentional — we want tests to fail loudly if production code
 * starts using an unsupported method.
 */
export function createFakeRedis() {
  const store = new Map<string, unknown>()
  const expiries = new Map<string, number>()

  function evictExpired(key: string) {
    const exp = expiries.get(key)
    if (exp !== undefined && exp <= Date.now()) {
      store.delete(key)
      expiries.delete(key)
    }
  }

  const fake = {
    async get<T = unknown>(key: string): Promise<T | null> {
      evictExpired(key)
      return (store.get(key) as T | undefined) ?? null
    },
    async set(
      key: string,
      value: unknown,
      opts?: { nx?: boolean; ex?: number },
    ): Promise<'OK' | null> {
      evictExpired(key)
      if (opts?.nx && store.has(key)) return null
      store.set(key, value)
      if (opts?.ex !== undefined) {
        expiries.set(key, Date.now() + opts.ex * 1000)
      } else {
        expiries.delete(key)
      }
      return 'OK'
    },
    async del(key: string): Promise<number> {
      const had = store.delete(key)
      expiries.delete(key)
      return had ? 1 : 0
    },
    // Expose for assertions; tests can poke at internal state if needed
    __store: store,
    __expiries: expiries,
  }
  return fake as typeof fake & Redis
}
