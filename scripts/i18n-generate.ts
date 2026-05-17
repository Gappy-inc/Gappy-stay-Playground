#!/usr/bin/env tsx
/**
 * AI bootstrap for non-English locale files (Phase 4 workflow).
 *
 * Phase 3 ships this as a runnable skeleton — full prompt/output handling
 * is wired in Phase 4 when the en.json key set is finalized. The skeleton
 * exists now so the script entry exists in package.json and the file path
 * referenced in the ADR is stable.
 *
 * Workflow when full-fat:
 *   1. Read lib/i18n/locales/en.json (source).
 *   2. For each non-en locale: ask Claude to translate the leaf strings
 *      with strict rules (preserve ICU placeholders; do not translate
 *      brand wordmarks Gappy Stay / Gappy Hotel Tokyo; use CLDR plural
 *      categories per target locale).
 *   3. Write the result to lib/i18n/locales/<locale>.json.
 *   4. Mark every generated key as "ai" in lib/i18n/locales/_meta.json.
 *
 * Re-running keeps human-reviewed keys ("human" in _meta) untouched —
 * only "ai" or missing entries are regenerated.
 *
 * @see docs/adr/0001-i18n-architecture.md §3 DD-4
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const LOCALES_DIR = resolve(__dirname, '..', 'lib', 'i18n', 'locales')

const NON_EN_LOCALES = ['ja', 'zh-TW', 'zh-CN', 'ko'] as const

function main() {
  // Sanity: en.json exists and parses.
  const en = JSON.parse(readFileSync(resolve(LOCALES_DIR, 'en.json'), 'utf8'))
  const keyCount = countLeaves(en)

  console.log(`── i18n bootstrap (skeleton) ───────────────────────────`)
  console.log(`Source: en.json (${keyCount} leaf keys)`)
  console.log(`Targets: ${NON_EN_LOCALES.join(', ')}\n`)
  console.log(`This script is a Phase 3 skeleton. Full Anthropic-SDK`)
  console.log(`generation is implemented in Phase 4 (T-15 string`)
  console.log(`migration), when the en.json key set is finalized.\n`)
  console.log(`To unblock Phase 4, edit this file and:\n`)
  console.log(`  1. import Anthropic from '@anthropic-ai/sdk'`)
  console.log(`  2. For each target locale, batch-translate en.json with`)
  console.log(`     strict rules (preserve {placeholders}; preserve ICU`)
  console.log(`     plural arms; do not translate brand wordmarks).`)
  console.log(`  3. Merge into the existing locale file, leaving any keys`)
  console.log(`     marked "human" in _meta.json untouched.`)
  console.log(`  4. Update _meta.json to mark new/refreshed keys as "ai".`)
  console.log(``)
}

function countLeaves(obj: unknown): number {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return 1
  let n = 0
  for (const v of Object.values(obj as Record<string, unknown>)) {
    n += countLeaves(v)
  }
  return n
}

main()
