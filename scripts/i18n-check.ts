#!/usr/bin/env tsx
/**
 * i18n parity check (NFR-6).
 *
 * Validates:
 *   - All 5 locale JSONs parse.
 *   - Same key set across non-English files **vs** en.json — missing keys
 *     are warnings (we ship with incomplete translations during early
 *     PoC); extra keys are errors (orphaned keys waste reviewer time).
 *   - ICU placeholder parity per key — every `{name}` in en must appear
 *     in every translation, otherwise interpolation breaks at runtime.
 *   - `_meta.json` covers every key in every non-English locale, with no
 *     orphans, and reports the ai/human review split.
 *
 * Exit code: non-zero on any error (orphans, parse failure, placeholder
 * drift). Warnings (missing keys) do not fail.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = resolve(__dirname, '..', 'lib', 'i18n', 'locales')
const SUPPORTED = ['en', 'ja', 'zh-TW', 'zh-CN', 'ko'] as const
const NON_EN = SUPPORTED.filter((l) => l !== 'en')

type Json = string | number | boolean | null | { [k: string]: Json } | Json[]

function readJson(name: string): Json {
  const path = resolve(LOCALES_DIR, `${name}.json`)
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    throw new Error(`Failed to parse ${path}: ${(err as Error).message}`)
  }
}

/** Flatten a nested object to dotted keys. Arrays are not supported. */
function flatten(obj: Json, prefix = ''): Map<string, string> {
  const out = new Map<string, string>()
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    if (prefix) out.set(prefix, String(obj))
    return out
  }
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [p, s] of flatten(v, path)) out.set(p, s)
    } else {
      out.set(path, String(v))
    }
  }
  return out
}

/** Extract ICU placeholder names like {firstName} from a message string. */
function placeholders(s: string): Set<string> {
  const set = new Set<string>()
  // Match {name} and {name, ...} (plural / select)
  for (const m of s.matchAll(/{\s*([a-zA-Z][a-zA-Z0-9_]*)/g)) {
    set.add(m[1])
  }
  return set
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

const errors: string[] = []
const warnings: string[] = []

// 1. Parse all JSONs
let en: Map<string, string>
const others = new Map<string, Map<string, string>>()
try {
  en = flatten(readJson('en'))
  for (const loc of NON_EN) others.set(loc, flatten(readJson(loc)))
} catch (e) {
  console.error(`✗ ${(e as Error).message}`)
  process.exit(1)
}

// 2. Per-locale key + placeholder parity
for (const [loc, keys] of others) {
  const missing: string[] = []
  const extra: string[] = []
  const placeholderDrift: string[] = []

  for (const enKey of en.keys()) {
    if (!keys.has(enKey)) missing.push(enKey)
  }
  for (const k of keys.keys()) {
    if (!en.has(k)) extra.push(k)
  }
  for (const [k, enVal] of en) {
    const otherVal = keys.get(k)
    if (otherVal === undefined) continue
    if (!setsEqual(placeholders(enVal), placeholders(otherVal))) {
      placeholderDrift.push(k)
    }
  }

  if (missing.length) {
    warnings.push(
      `${loc}: ${missing.length} missing key(s) (will fall back to en at runtime): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`
    )
  }
  if (extra.length) {
    errors.push(
      `${loc}: ${extra.length} ORPHAN key(s) not in en.json: ${extra.join(', ')}`
    )
  }
  if (placeholderDrift.length) {
    errors.push(
      `${loc}: ICU placeholder mismatch in ${placeholderDrift.length} key(s): ${placeholderDrift.join(', ')}`
    )
  }
}

// 3. _meta.json sanity
type Meta = { schema?: string; locales?: Record<string, Record<string, string>> }
let meta: Meta
try {
  meta = readJson('_meta') as Meta
} catch (e) {
  errors.push((e as Error).message)
  meta = { locales: {} }
}

const metaSummary: Record<string, { ai: number; human: number; orphans: string[] }> = {}
for (const loc of NON_EN) {
  const entries = meta.locales?.[loc] ?? {}
  let ai = 0
  let human = 0
  const orphans: string[] = []
  for (const [key, status] of Object.entries(entries)) {
    if (!en.has(key)) orphans.push(key)
    if (status === 'ai') ai++
    else if (status === 'human') human++
  }
  metaSummary[loc] = { ai, human, orphans }
  if (orphans.length) {
    errors.push(
      `_meta.json[${loc}]: ${orphans.length} orphan entry(ies) not in en.json: ${orphans.join(', ')}`
    )
  }
}

// 4. Report
console.log(`\n── i18n parity report ─────────────────────────────────`)
console.log(`Source: en.json (${en.size} keys)\n`)

for (const loc of NON_EN) {
  const keys = others.get(loc)!
  const m = metaSummary[loc]
  const coverage = en.size === 0 ? 100 : Math.round((keys.size / en.size) * 100)
  console.log(
    `  ${loc.padEnd(6)} ${keys.size}/${en.size} keys (${coverage}%)  ai=${m.ai}  human=${m.human}`
  )
}

if (warnings.length) {
  console.log(`\nWarnings (${warnings.length}):`)
  for (const w of warnings) console.log(`  ⚠  ${w}`)
}
if (errors.length) {
  console.log(`\nErrors (${errors.length}):`)
  for (const e of errors) console.log(`  ✗  ${e}`)
  console.log(``)
  process.exit(1)
}

console.log(`\n✓ i18n parity check passed.\n`)
