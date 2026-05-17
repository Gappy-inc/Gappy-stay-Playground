import next from 'eslint-config-next'

/**
 * Project ESLint config (flat).
 *
 * Two React Compiler-strictness rules from eslint-config-next@16 are
 * downgraded from "error" to "warn":
 *
 *   - react-hooks/set-state-in-effect
 *   - react-hooks/immutability
 *
 * Both flag legitimate event-handler patterns in pre-existing files
 * (`app/admin/dashboard/page.tsx`, `app/checkout/page.tsx`,
 * `app/complete/page.tsx`, `context/CartContext.tsx`,
 * `components/CartDrawer.tsx`, `app/offer/[bookingId]/OfferPageClient.tsx`).
 * The code works correctly at runtime; rewriting it to satisfy the new
 * React Compiler heuristics is its own refactor.
 *
 * TODO(T-15d): refactor these files to satisfy strict React-Compiler
 * mode, then restore both rules to "error".
 */
const config = [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'dist/**',
      'lib/i18n/locales/**',
    ],
  },
  ...next,
  {
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
]

export default config
