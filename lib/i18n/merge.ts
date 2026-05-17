/**
 * Shared deep-merge helper for translation message trees.
 *
 * The merge powers the FR-7 fallback: every non-English locale's
 * messages get deep-merged with `en.json` before being shipped to the
 * page, so a missing key in the target locale transparently resolves to
 * the English value at lookup time — without raw key paths leaking into
 * production HTML.
 *
 * Plain JSON only: nested plain objects merge recursively; primitive
 * values, arrays, and nulls in the overlay replace whatever is in the
 * base wholesale.
 */
export type AnyMessages = Record<string, unknown>

export function deepMerge(base: AnyMessages, overlay: AnyMessages): AnyMessages {
  const out: AnyMessages = { ...base }
  for (const [k, v] of Object.entries(overlay)) {
    const existing = out[k]
    if (
      v !== null &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      existing !== null &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      out[k] = deepMerge(existing as AnyMessages, v as AnyMessages)
    } else if (v !== undefined) {
      out[k] = v
    }
  }
  return out
}
