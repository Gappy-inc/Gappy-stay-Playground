#!/usr/bin/env tsx
/**
 * AI bootstrap for non-English locale files.
 *
 * Source: lib/i18n/locales/en.json (canonical key set).
 * Targets: ja, zh-TW, zh-CN, ko.
 * Output: each target locale's JSON, plus _meta.json marking every key as "ai".
 *
 * Strict translation rules baked into the prompt:
 *   - Preserve ICU placeholders verbatim ({firstName}, {count}, etc.).
 *   - Preserve ICU plural / select arms ({count, plural, one {…} other {…}}).
 *   - Do NOT translate brand wordmarks: "Gappy Stay", "Gappy Hotel Tokyo",
 *     "GAPPY HOTEL TOKYO". They appear verbatim in target output.
 *   - Preserve emoji and punctuation arrows (→ ←).
 *   - Use the target locale's native CLDR plural categories where they
 *     differ from English (Japanese, Chinese, Korean have only `other`).
 *
 * zh-TW policy (user Phase 4 direction): bootstrap directly from English,
 * not from zh-CN. Native review is post-PoC. Acceptable coverage now.
 *
 * Re-running keeps human-reviewed keys ("human" in _meta.json) untouched —
 * only "ai" or missing entries are regenerated.
 *
 * @see docs/adr/0001-i18n-architecture.md §3 DD-4
 */
import Anthropic from '@anthropic-ai/sdk'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = resolve(__dirname, '..', 'lib', 'i18n', 'locales')

const NON_EN_LOCALES = ['ja', 'zh-TW', 'zh-CN', 'ko'] as const
type NonEnLocale = (typeof NON_EN_LOCALES)[number]

const LOCALE_FULL_NAME: Record<NonEnLocale, string> = {
  ja: 'Japanese (日本語)',
  'zh-TW': 'Traditional Chinese (繁體中文, as written in Taiwan and Hong Kong)',
  'zh-CN': 'Simplified Chinese (简体中文, as written in Mainland China)',
  ko: 'Korean (한국어)',
}

type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json }
  | Json[]

type FlatMap = Map<string, string>

function flatten(obj: Json, prefix = ''): FlatMap {
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

function nest(flat: FlatMap): Record<string, Json> {
  const out: Record<string, Json> = {}
  for (const [path, value] of flat) {
    const parts = path.split('.')
    let cursor: Record<string, Json> = out
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]
      const existing = cursor[seg]
      if (
        existing === undefined ||
        typeof existing !== 'object' ||
        existing === null ||
        Array.isArray(existing)
      ) {
        cursor[seg] = {}
      }
      cursor = cursor[seg] as Record<string, Json>
    }
    cursor[parts[parts.length - 1]] = value
  }
  return out
}

function readJson(name: string): Json {
  return JSON.parse(readFileSync(resolve(LOCALES_DIR, `${name}.json`), 'utf8'))
}

function writeJson(name: string, value: Json) {
  writeFileSync(
    resolve(LOCALES_DIR, `${name}.json`),
    JSON.stringify(value, null, 2) + '\n'
  )
}

type MetaFile = {
  schema?: string
  doc?: string
  locales?: Record<string, Record<string, 'ai' | 'human'>>
}

function buildPrompt(localeName: string, batch: Record<string, string>): string {
  return `You translate UI strings for a luxury Japanese ryokan / boutique-hotel pre-arrival guest experience.

Target language: ${localeName}

STRICT RULES — read carefully:

1. Preserve every ICU placeholder verbatim. Examples:
   - {firstName}, {hotelName}, {count}, {amount}
   - Plural blocks: {count, plural, one {...} other {...}}
   - Select blocks: {gender, select, female {...} male {...} other {...}}
   The number, names, and structure of placeholders must match the input EXACTLY.

2. CLDR plural categories: if the input has {count, plural, one {X} other {Y}},
   the output MUST use the target language's correct CLDR categories.
   - Japanese, Chinese (both variants), Korean: only "other" (no "one" form).
   - Example input:  "{count, plural, one {Only # left} other {Only # left}}"
   - Japanese output: "{count, plural, other {残り#個}}"
   You may omit unused arms; you may NOT invent extra arms.

3. Brand wordmarks stay UNTRANSLATED — they appear verbatim in the output:
   - "Gappy Stay"
   - "Gappy Hotel Tokyo"
   - "GAPPY HOTEL TOKYO"
   If the English input contains any of these, the output contains them
   identically, in the same case.

4. Preserve emojis (🏨 ✓ ← → etc.) and punctuation arrows.

5. Tone: warm, professional, hospitality-grade. NOT casual or chatty.
   This is luxury hotel copy; match the register.

6. Output format: a single JSON object whose keys are the dotted paths
   given in the input and whose values are the translations. No commentary,
   no markdown fences, no extra keys. Just the JSON object.

Input (the keys-and-English-source object to translate):
${JSON.stringify(batch, null, 2)}

Return the JSON object now.`
}

async function translateBatch(
  client: Anthropic,
  locale: NonEnLocale,
  batch: Record<string, string>
): Promise<Record<string, string>> {
  const prompt = buildPrompt(LOCALE_FULL_NAME[locale], batch)
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })
  const block = message.content[0]
  if (block.type !== 'text') {
    throw new Error(`[${locale}] Non-text response from Claude`)
  }
  let raw = block.text.trim()
  // Strip markdown fences if Claude wrapped despite instructions
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) raw = fence[1].trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(
      `[${locale}] Claude returned non-JSON: ${raw.slice(0, 200)}…`
    )
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`[${locale}] Claude returned non-object JSON`)
  }
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof v !== 'string') {
      throw new Error(`[${locale}] Non-string value at key "${k}"`)
    }
    out[k] = v
  }
  return out
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('✗ ANTHROPIC_API_KEY is not set; cannot bootstrap.')
    process.exit(2)
  }

  const en = flatten(readJson('en'))
  if (en.size === 0) {
    console.error('✗ en.json is empty; nothing to bootstrap.')
    process.exit(2)
  }

  const meta = (function () {
    try {
      return readJson('_meta') as MetaFile
    } catch {
      return { schema: '1', locales: {} }
    }
  })()
  meta.locales ??= {}

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  console.log(`── i18n bootstrap ──────────────────────────────────────`)
  console.log(`Source: en.json (${en.size} keys)`)
  console.log(`Targets: ${NON_EN_LOCALES.join(', ')}\n`)

  for (const locale of NON_EN_LOCALES) {
    const existing = flatten(readJson(locale))
    const metaForLocale = meta.locales[locale] ?? {}

    // Pick keys to (re)generate: every en key whose existing meta is "ai"
    // or absent. "human"-marked keys are sacrosanct.
    const toGenerate: Record<string, string> = {}
    for (const [path, source] of en) {
      if (metaForLocale[path] === 'human') continue
      toGenerate[path] = source
    }

    if (Object.keys(toGenerate).length === 0) {
      console.log(`  ${locale}: all keys human-reviewed; skipping.`)
      continue
    }

    console.log(`  ${locale}: translating ${Object.keys(toGenerate).length} key(s)…`)
    const translated = await translateBatch(client, locale, toGenerate)

    // Validate placeholder parity before persisting
    for (const [path, source] of Object.entries(toGenerate)) {
      const out = translated[path]
      if (out === undefined) {
        throw new Error(`[${locale}] Missing translation for "${path}"`)
      }
      if (!placeholdersMatch(source, out)) {
        throw new Error(
          `[${locale}] ICU placeholder mismatch at "${path}". ` +
          `Source: ${source} | Translation: ${out}`
        )
      }
    }

    // Merge: start with existing file, overlay translated keys, prune
    // any orphan keys (not in en) so the file stays clean.
    const merged: FlatMap = new Map()
    for (const path of en.keys()) {
      if (translated[path] !== undefined) {
        merged.set(path, translated[path])
      } else if (existing.has(path)) {
        merged.set(path, existing.get(path)!)
      }
    }

    writeJson(locale, nest(merged))

    // Mark every (re)generated key as "ai"; leave "human" entries
    // untouched.
    const nextMeta: Record<string, 'ai' | 'human'> = { ...metaForLocale }
    for (const path of Object.keys(toGenerate)) {
      if (nextMeta[path] !== 'human') nextMeta[path] = 'ai'
    }
    meta.locales[locale] = nextMeta

    console.log(`  ${locale}: wrote ${merged.size} keys.`)
  }

  writeJson('_meta', meta as unknown as Json)
  console.log(`\n✓ Bootstrap complete. Updated _meta.json.\n`)
}

/** Compare ICU placeholder names between source and translation. */
function placeholdersMatch(a: string, b: string): boolean {
  const set = (s: string) => {
    const out = new Set<string>()
    for (const m of s.matchAll(/{\s*([a-zA-Z][a-zA-Z0-9_]*)/g)) out.add(m[1])
    return out
  }
  const sa = set(a)
  const sb = set(b)
  if (sa.size !== sb.size) return false
  for (const v of sa) if (!sb.has(v)) return false
  return true
}

await main()
