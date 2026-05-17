# T-15 — Phase 1 i18n Discovery & Audit

Branch: `feature/multi-language-i18n`
Date: 2026-05-17
Auditor: Claude Code (Sonnet 4.6)

This audit is **read-only** — no source files were modified. It catalogues every
user-facing hardcoded string, existing locale handling, and risks that should
shape the Phase 2 ADR.

> **Important deviation from the brief.** The brief (§2 "What is NOT there")
> asserts that there is no i18n library, no translation files, no locale
> resolution, and no language switcher. **The first three are partially false.**
> A custom in-process i18n module exists (`lib/i18n.ts`) with 4 locales, a
> client-side React context (`context/LangContext.tsx`), and per-booking locale
> persistence on `Booking.language`. See §2 of this audit for details and §7 for
> the migration implications that the ADR must address.

---

## 1. Repo snapshot

- Stack confirmed: Next.js **16.2.3** (App Router), React **19.2.4**,
  TypeScript **^5**, Tailwind **^4**, Resend **^6.12.3**, Upstash Redis,
  `@anthropic-ai/sdk` **^0.88.0**.
- `node_modules` is **not** installed in the working tree. Phase 3 will need
  `npm install` before any library work, and `node_modules/next/dist/docs/`
  (AGENTS.md required reading) is therefore not yet available locally.
- No `middleware.ts` at the repo root.
- `next.config.ts` contains no i18n config (no `i18n` field — that field is
  pages-router-only anyway).
- `tsconfig.json` has `strict: true`, `moduleResolution: "bundler"`,
  `paths: { "@/*": ["./*"] }`. Good for typed messages and absolute imports.

Top-level layout (verified):

```
app/
  admin/{layout,dashboard/page,upload/page}.tsx       (admin — out of scope per brief §8)
  api/admin/{bookings,offers,orders,upload}/route.ts  (data routes, no UI strings)
  api/generate-offers/route.ts                        (Claude personalization, inline locale strings)
  api/send-offer-email/route.ts                       (Resend email, inline locale strings)
  checkout/page.tsx                                   (guest-facing, uses lib/i18n)
  complete/page.tsx                                   (guest-facing, uses lib/i18n)
  offer/[bookingId]/{page,OfferPageClient}.tsx        (guest-facing, primary surface)
  layout.tsx                                          (root layout — hardcoded <html lang="en">)
  page.tsx                                            (landing — hardcoded English, not yet localized)
components/{BundleCard,CartDrawer,OfferCard,WelcomeBanner}.tsx
context/{CartContext,LangContext}.tsx
lib/{bookings,channel,i18n,offers,runtime-store}.ts
types/index.ts
data/{bookings,offers,runtime-*}.json
```

Note: the brief references the guest route as `/offer/[token]`. In the actual
code it is `/offer/[bookingId]` and resolves bookings by ID, not opaque token.
Substantively the same for i18n purposes, but the ADR should use the actual
path.

---

## 2. Existing i18n infrastructure (must be migrated, not added)

### 2.1 `lib/i18n.ts`

- Exposes `type Lang = 'en' | 'ja' | 'ko' | 'zh'` — **4 locales**, with `zh`
  representing Simplified Chinese only. The brief requires **5 locales** and
  splits Chinese into `zh-TW` (Traditional) and `zh-CN` (Simplified). This is a
  type-level breaking change touched in §7.
- Exposes a single typed `Strings` interface (28 keys: `welcome`, `night`,
  `nights`, `back`, `backToHotel`, `noOffers`, `addBtn`, `addedBtn`,
  `addBundleBtn`, `bundleLabel`, `onlyLeft(n)`, `cartItems(n)`, `checkoutBtn`,
  `cartEmpty`, `yourAddons`, `reviewBefore`, `total`, `roomBillNote`,
  `confirmPay`, `bookingConfirmed`, `addonsReady`, `farewell`, plus nested
  `channel` and `units` maps, and `dateLocale`).
- Two of the keys are **functions** for pluralization: `onlyLeft(n)`,
  `cartItems(n)`. Migration must preserve plural semantics — ICU MessageFormat
  is a natural fit.
- Exports `getStrings(lang: string): Strings` with `?? STRINGS.en` fallback —
  this is the de facto "missing locale ⇒ English" behavior the FR-7 spec
  formalizes; it does not warn in dev today.
- All five locale-keyed sections (`en`, `ja`, `ko`, `zh`) are present and
  human-reviewed-quality. Reuse the existing translations during Phase 4 — do
  not regenerate via AI for these 28 keys.

### 2.2 `context/LangContext.tsx`

- Client-only React context (`'use client'`). Provider takes a `lang` prop and
  wraps children; `useLang()` returns the resolved `Strings` object.
- Locale is propagated by `OfferPageClient.tsx` from `booking.language` — i.e.
  it is **persisted on the booking record**, not resolved per-request.

### 2.3 `Booking.language` (in `types/index.ts:7`)

```ts
language: 'en' | 'ja' | 'ko' | 'zh'
```

Set by `detectLang(nationality)` in `app/admin/upload/page.tsx:44`. This
collides with the FR-1 request-level resolution chain: today, a Japanese guest
who clicks their link in Korea cannot override the language. Phase 2 must
decide how `booking.language` interacts with the chain (proposal: it becomes a
*per-guest default* slotted between Accept-Language and `'en'` fallback, but
the chain wins).

### 2.4 Duplicated locale tables inline

The following inline locale maps duplicate the role of `lib/i18n.ts` and must
be consolidated:

| File | Lines | Map | Purpose |
|---|---|---|---|
| `app/offer/[bookingId]/OfferPageClient.tsx` | 15–22 | `CATEGORY_LABELS` | Room/Dining/Wellness/Transport/Experience/Bundle per locale |
| `app/offer/[bookingId]/OfferPageClient.tsx` | 24–29 | `SECTION_INTRO` | "Curated especially for your stay" per locale |
| `app/api/send-offer-email/route.ts` | 10–15 | `GREETINGS` | Email greeting per locale |
| `app/api/send-offer-email/route.ts` | 17–22 | `INTROS` | Email intro paragraph per locale |
| `app/api/send-offer-email/route.ts` | 24–29 | `CTA_TEXT` | Email button label per locale |
| `app/api/send-offer-email/route.ts` | 31–36 | `OFFER_LABEL` | Email section header per locale |
| `app/api/send-offer-email/route.ts` | 160–165 | `subjectMap` | Email subject line per locale |
| `app/api/generate-offers/route.ts` | 48–55 | inline ternary | Fallback `personalized_message` per locale |

### 2.5 Locale-keyed *content* (offers data)

`data/offers.json` and `types/index.ts` `OfferTemplate` define `title` and
`description` as `Record<string, string>` with `en`/`ja`/`ko`/`zh` entries.
This is **content**, not chrome — out of scope for the JSON locale files at
`lib/i18n/locales/*.json` but in scope for the 4→5 locale split discussed in
§7. Phase 2 must decide whether to add `zh-TW` keys to offer content (yes,
recommended — the brief calls Traditional Chinese mandatory) and how to
back-fill `data/offers.json` (Phase 4, via Anthropic SDK or manual fan-out from
`zh`).

---

## 3. Existing dependencies

Direct `package.json` dependencies — no i18n libraries:

```
@anthropic-ai/sdk ^0.88.0
@upstash/redis    ^1.38.0
chart.js          ^4.5.1
next              16.2.3
react             19.2.4
react-chartjs-2   ^5.3.1
react-dom         19.2.4
resend            ^6.12.3
```

`package-lock.json` was grepped for `next-intl`, `react-intl`, `@lingui`,
`i18next`, `formatjs`, `@formatjs` — **none found**. No transitive surprises.

Note: `package.json` has **no `lint` script** today. The brief's verification
protocol calls `npm run lint`. Phase 3 must either add an `eslint` script or
the verification protocol will fail. (Next.js 16 ships ESLint config via
`next lint` but the script must be declared.) **Flag for the ADR.**

Also no test runner. Phase 3 must add Vitest (or equivalent) — see §7 of the
brief.

---

## 4. User-facing hardcoded strings — full inventory

Strings are grouped by file with **line numbers**. Each entry notes the source
locale (today's behavior) and whether it is already going through `lib/i18n.ts`
(i.e. is *parameterized by* `booking.language`) versus truly hardcoded.

Status legend:
- **HARDCODED** — single-locale literal in JSX. Must be migrated.
- **ROUTED** — already uses `lib/i18n.ts` / `useLang()` / locale maps. Re-key
  during migration; copy survives.
- **GENERATED** — string is content from `data/offers.json` or Claude API
  output; not a translation-key concern for `lib/i18n/locales/*.json`.

### 4.1 `app/layout.tsx` — root layout

| Line | String | Status |
|---|---|---|
| 20 | `'Gappy Stay — Personalized Hotel Upsell'` (metadata.title) | HARDCODED |
| 21 | `'Customize your stay with curated add-ons tailored just for you.'` (metadata.description) | HARDCODED |
| 26 | `<html lang="en">` | HARDCODED — **violates FR-8** |

### 4.2 `app/page.tsx` — landing/lookup page (entirely English today)

| Line | String | Status |
|---|---|---|
| 83 | `'GAPPY HOTEL TOKYO'` (eyebrow) | HARDCODED |
| 86 | `'Gappy Stay'` (brand wordmark — keep untranslated) | HARDCODED — DO NOT TRANSLATE (brand) |
| 107 | `'Welcome to Gappy Hotel Tokyo'` | HARDCODED |
| 110 | `'Please enter your full name to access your personalized offers'` | HARDCODED |
| 116 | `'Full Name'` (label) | HARDCODED |
| 124 | `'e.g. James Mitchell'` (placeholder) | HARDCODED |
| 144–145 | `"We couldn't find a reservation under that name. Please check your full name and try again."` | HARDCODED |
| 169 | `'Searching...'` | HARDCODED |
| 169 | `'Find My Reservation →'` | HARDCODED |
| 175 | `'Powered by Gappy Stay AI'` | HARDCODED |

Note: the landing page must derive its locale from the request (cookie /
`?lang=` / Accept-Language) — there is no booking record yet at this point.

### 4.3 `app/offer/[bookingId]/OfferPageClient.tsx`

| Line | String | Status |
|---|---|---|
| 15–22 | `CATEGORY_LABELS` map (6 categories × 4 locales = 24 strings) | ROUTED via inline map; needs consolidation |
| 24–29 | `SECTION_INTRO` map (4 strings) | ROUTED via inline map; needs consolidation |
| 207 | `{t.back}` rendering | ROUTED via `lib/i18n.ts` (`back`) |
| 210 | `'▶ Gappy Stay'` (brand wordmark) | HARDCODED — DO NOT TRANSLATE (brand) |
| 282 | `{t.noOffers}` | ROUTED via `lib/i18n.ts` |

### 4.4 `app/checkout/page.tsx`

All translations already routed through `getStrings(lang)` from
`lib/i18n.ts`. Strings: `t.cartEmpty`, `t.back`, `t.yourAddons`,
`t.reviewBefore`, `t.units[unit]`, `t.total`, `t.roomBillNote`, `t.confirmPay`.

| Line | String | Status |
|---|---|---|
| 42, 56, 72, 75, 78, 95, 122, 128, 144 | various `t.*` | ROUTED |

No hardcoded user-facing strings detected.

### 4.5 `app/complete/page.tsx`

| Line | String | Status |
|---|---|---|
| 78, 90, 96, 104, 127, 150 | `t.bookingConfirmed`, `t.addonsReady`, `t.farewell`, `t.yourAddons`, `t.total`, `t.backToHotel` | ROUTED |

No hardcoded user-facing strings detected.

### 4.6 `components/WelcomeBanner.tsx`

| Line | String | Status |
|---|---|---|
| 84 | `${nights} ${nights>1?nights:night}` (pluralization) | ROUTED; must become ICU plural |
| 118 | `'GAPPY HOTEL TOKYO'` (eyebrow) | HARDCODED |
| 122 | `{t.welcome} {firstName}` | ROUTED — but greeting should accept `{firstName}` as ICU interpolation |
| 129 | `formatStay(check_in, check_out, t.dateLocale)` — uses `Date.toLocaleDateString` | ROUTED via `dateLocale` |
| 131 | `{booking.room_type}` (e.g. "Deluxe Twin") | **GENERATED**, see §5 |
| 145 | `{t.channel[channel]}` | ROUTED |

### 4.7 `components/OfferCard.tsx`

| Line | String | Status |
|---|---|---|
| 76 | `{offer.badge}` (e.g. "Most Popular", "Best Deal", "Last 2 spots") | GENERATED by Claude in `generate-offers/route.ts`; English-only today regardless of `booking.language` |
| 89 | `{t.onlyLeft(offer.availability)}` | ROUTED |
| 99 | `{offer.description}` | GENERATED |
| 117 | `✓ {inc.replace(/_/g, ' ')}` — `inc` is from `offer.includes`, an array of snake_case slugs like `kaiseki_dinner` | **GENERATED but raw slugs** — see §5 |
| 140 | `{t.units[offer.unit] ?? offer.unit}` | ROUTED |
| 155 | `{added ? t.addedBtn : t.addBtn}` | ROUTED |

### 4.8 `components/BundleCard.tsx`

| Line | String | Status |
|---|---|---|
| 40 | `{t.bundleLabel}` | ROUTED |
| 45 | `¥{savings.toLocaleString()} OFF` — `OFF` is hardcoded English | HARDCODED (missed by current i18n; add as `bundle.savingsLabel`) |
| 79 | `✓ {inc.replace(/_/g, ' ')}` | GENERATED (see §5) |
| 99 | `{t.units[offer.unit] ?? offer.unit}` | ROUTED |
| 114 | `{added ? t.addedBtn : t.addBundleBtn}` | ROUTED |

### 4.9 `components/CartDrawer.tsx`

| Line | String | Status |
|---|---|---|
| 42 | `{t.cartItems(itemCount)}` | ROUTED |
| 46 | `{t.checkoutBtn}` | ROUTED |

### 4.10 `app/api/send-offer-email/route.ts`

Already keyed by `lang` for `GREETINGS`, `INTROS`, `CTA_TEXT`, `OFFER_LABEL`,
`subjectMap`. Hardcoded:

| Line | String | Status |
|---|---|---|
| 72 | `new Date(d).toLocaleDateString('en-US', ...)` — date formatter forced to en-US | HARDCODED — should respect `lang` |
| 81 | `<title>Your Special Offers | Gappy Stay</title>` | HARDCODED |
| 88 | `'▶ Gappy Stay'` (brand wordmark) | HARDCODED — DO NOT TRANSLATE |
| 129 | `'Gappy Stay · Hotel Upsell Platform'` (footer) | HARDCODED |
| 130 | `'This offer link is personal to your booking and expires at check-out.'` (footer) | HARDCODED |

### 4.11 `app/api/generate-offers/route.ts`

| Line | String | Status |
|---|---|---|
| 9–31 | `SYSTEM_PROMPT` — Claude system prompt | NOT user-facing; do **not** translate |
| 48–55 | `personalized_message` fallback per locale | ROUTED via inline ternary; consolidate |
| 68–73, 75–79, 81–88 | `PURPOSE_LABEL`, `MORNING_LABEL`, `INTEREST_LABEL` — English-only labels sent to Claude in the user message | NOT user-facing (consumed only by the LLM); do **not** translate |

---

## 5. Strings that look user-facing but are NOT (flag — do not translate)

These deserve explicit attention because a naïve sweep would mistakenly key
them:

1. **Claude-generated `offer.title`, `offer.description`, `offer.badge`,
   `offer.personalized_message`** — emitted dynamically per request. They are
   already locale-aware (Claude prompt: "Language: Match the guest's language
   field."). The `OfferCard` badge style heuristic (`badge.startsWith('Last')`)
   *will* break for non-English badges. Note for downstream tickets; **outside
   T-15 scope** but flag in ADR.
2. **`offer.includes` snake_case slugs** (e.g. `kaiseki_dinner`) — rendered as
   `inc.replace(/_/g, ' ')` and shown to guests. These are **content slugs**,
   not UI chrome. Should ultimately be mapped via offer content rather than
   `lib/i18n/locales/*.json`. Flag as **deferred** — not part of T-15 unless
   the ADR decides otherwise.
3. **`booking.room_type`** (e.g. "Deluxe Twin") — hotel inventory taxonomy
   stored in `data/bookings.json`. Hotel-managed, not translation system.
4. **`booking.booking_source`** (e.g. "Booking.com", "楽天トラベル") — OTA
   brand names, do not translate.
5. **Brand wordmarks** — `"Gappy Stay"`, `"▶ Gappy Stay"`, `"Gappy Hotel
   Tokyo"`, `"GAPPY HOTEL TOKYO"`. The hotel name *could* be translated to
   `ガッピーホテル東京` etc. but that is a brand decision; recommend keeping in
   English/romaji for international consistency. Flag for ADR DD-3.
6. **`SYSTEM_PROMPT`, `PURPOSE_LABEL`, `MORNING_LABEL`, `INTEREST_LABEL`** in
   `generate-offers/route.ts` — LLM-input metadata, not rendered to the guest.
7. **Console / error log strings** (e.g. `'Resend error:'`,
   `'[generate-offers] Claude API error:'`) — operational logs only.
8. **Admin UI** (`app/admin/*`) — explicitly out of scope per brief §8.
9. **Currency unit `¥`** — hard-coded JPY symbol. The brief §8 declares "no FX
   / no currency conversion", so this stays.

---

## 6. Gaps versus T-15 Definition of Done

| DoD § | Requirement | Current state | Gap |
|---|---|---|---|
| 1 | `/offer/[id]?lang=ja` renders Japanese | `?lang=` not honored anywhere | **MISSING** |
| 2 | Cookie-persisted choice | No cookie handling | **MISSING** |
| 3 | Accept-Language detection on first visit | None | **MISSING** |
| 4 | Unsupported `?lang=` graceful fall-through | N/A (param not honored) | **MISSING** |
| 5 | Dev console warning for missing key | Silent `?? STRINGS.en` fallback | **MISSING** |
| 6 | Prod silent fallback + structured log | Silent fallback only; no log | **PARTIAL** |
| 7 | `<html lang>` matches active locale | Hardcoded `"en"` | **BROKEN** |
| 8 | 5 locale JSONs, same keys, `npm run build` passes | 0 JSON files; 4 locales in TS | **MISSING** |
| 9 | Adding a key is one edit + types | Edit single TS file (close, but not type-safe at call site — keys are flat string properties) | **PARTIAL** |
| 10 | ADR documented | None | **MISSING** |
| 11 | README "Internationalization" section | None | **MISSING** |

Additional misses against §4 / §5 requirements:
- **FR-2 Language Switcher**: does not exist. Must be added.
- **FR-4 Type-safe keys**: `t.foo` already type-checks against the `Strings`
  interface (good), but `getStrings('xx')` accepts any string with cast — could
  be tightened. With JSON-loaded keys, `next-intl` provides typed messages via
  `Messages` interface, so this requirement is improved post-migration.
- **FR-6 Email helper `getEmailTranslations(locale)`**: not centralized.
- **NFR-1 Bundle size per locale**: today all locales ship together in
  `lib/i18n.ts`. Migration to JSON + lazy-load on the server is a clear win.
- **NFR-6 i18n parity script**: none.

---

## 7. Risks and decisions to escalate into Phase 2 (ADR)

These are the load-bearing decisions Phase 2 must resolve. They cannot be made
silently mid-implementation.

1. **`zh` → `zh-TW` + `zh-CN` split.** The existing `Lang` union and
   `Booking.language` field encode `'zh'` only (de facto Simplified). The brief
   mandates both Traditional and Simplified. Options:
   - (a) Migrate `Lang` to the 5-locale set; treat legacy `'zh'` as alias for
     `'zh-CN'`; back-fill `zh-TW` content (offers + UI strings) via AI bootstrap.
   - (b) Keep `Booking.language` narrower than the request-resolved locale,
     using it only as a default. Add a new `SupportedLocale` type for the
     request layer.
   Recommend (b): cleaner separation of "guest preference at booking time" vs
   "active session locale". Document in ADR DD-1 / DD-6.

2. **`booking.language` precedence in the resolution chain.** FR-1's chain is
   URL → cookie → Accept-Language → `en`. Where does `booking.language` go?
   Proposal: slot it between Accept-Language and `'en'` for routes that have a
   booking context (`/offer/[bookingId]`, `/checkout`, `/complete`). For the
   landing page (no booking yet), the chain stops at Accept-Language → `en`.
   Document explicitly in ADR.

3. **Email locale resolution.** Emails have no request context. Per FR-6, take
   `locale` as an explicit param. Internally `send-offer-email/route.ts` already
   reads `booking.language` — keep that as the default but allow override.

4. **AI-generated content (`offer.title`, `offer.badge`, etc.) in
   non-`zh-CN` Chinese variants.** Current `generate-offers/route.ts` prompts
   Claude with the guest's `booking.language` value. If the active locale
   becomes `zh-TW`, Claude must produce Traditional Chinese output. Plumbing the
   active-session locale through to the offer-generation request is a small but
   real change — flag in ADR as a downstream dependency for T-3/T-4.

5. **Next.js 16 + next-intl compatibility.** `node_modules` is absent; we have
   not verified `next-intl@latest` claims Next 16 support. The brief §7 says
   "verify on the day you start". Phase 3 first action: `npm install next-intl`
   and check version metadata + the package's `peerDependencies`. If broken,
   ADR fallback per brief §13 is `react-intl`.

6. **No `lint` script, no test runner.** The verification protocol (§11)
   assumes both. Phase 3 must add:
   - `"lint": "next lint"` in `package.json` (and `eslint`, `eslint-config-next`
     devDeps).
   - A test runner — Vitest is the lightest fit for Next 16 + React 19.

7. **Plural and date formatting.** ICU `{count, plural, one {…} other {…}}` via
   `next-intl` covers `onlyLeft(n)` and `cartItems(n)` cleanly. Date formatting
   should move from `t.dateLocale` to `next-intl`'s `useFormatter()` /
   `getFormatter()`. Both rationales go in ADR DD-5.

8. **Translation key naming policy.** Existing `lib/i18n.ts` uses flat
   `camelCase`. The brief §7 recommends nested `camelCase` segments scoped by
   feature (`landing.hero.greeting`). Migration requires re-keying every
   call-site. Bundle into Phase 4. Document mapping in ADR DD-3.

9. **Brand wordmark policy.** Decide once (recommend: keep "Gappy Stay" and
   "Gappy Hotel Tokyo" untranslated in all locales). Memorialize in ADR DD-3 so
   linters/reviewers don't relitigate.

10. **Missing-key observability.** Today's silent `?? STRINGS.en` fallback
    satisfies prod-safety but fails dev warning (FR-7) and prod logging (NFR-5).
    `next-intl` supports `onError`/`getMessageFallback` hooks — wire them.

---

## 8. Approximate migration size

- ~28 existing translation keys in `lib/i18n.ts` (incl. nested `channel`,
  `units`) covering offer/checkout/complete flows.
- ~12 new keys for the landing page (`app/page.tsx`) — currently English-only.
- ~6 inline maps to consolidate (§2.4 table).
- ~6 email keys to consolidate from `send-offer-email/route.ts`.
- Plus pluralization re-expression for 2 keys (`onlyLeft`, `cartItems`).

**Total ≈ 50 unique keys** — well under the 200-key threshold the brief calls
out in §13. Migration is mechanically tractable in Phase 4.

---

## 9. Verification protocol pre-checks

Before Phase 5 verification can succeed:

| Command in brief §11 | Current readiness | Required Phase 3 action |
|---|---|---|
| `npx tsc --noEmit` | works (no `tsc` script needed) | — |
| `npm run lint` | **fails — no `lint` script** | Add `next lint` script + eslint deps |
| `npm run build` | works | — |
| `npm run i18n:check` | **fails — script missing** | Add `scripts/i18n-check.ts` |
| `npm test -- i18n` | **fails — no test runner** | Add Vitest + first test file |
| `curl ... /offer/SAMPLE_TOKEN` | path is `/offer/[bookingId]`; sample IDs in `data/bookings.json` like `BK-2025-001` | Use `BK-2025-001` etc.; brief's `SAMPLE_TOKEN` is illustrative |

---

## 10. Open questions for the user (before Phase 2)

1. **`zh` migration**: Acceptable to treat the existing `'zh'` value on
   bookings as `'zh-CN'` (alias) and back-fill `zh-TW` content via AI
   bootstrap, with native-speaker review deferred to pre-launch? (Proposed.)
2. **Brand wordmarks**: Confirm "Gappy Stay" / "Gappy Hotel Tokyo" stay
   untranslated everywhere (incl. Japanese). (Proposed.)
3. **`booking.language` precedence**: confirm it slots *between*
   Accept-Language and `'en'` fallback only when a booking context exists.
   (Proposed.)
4. **Adding lint + test infrastructure in Phase 3**: confirm we may add
   `next lint`/eslint and `vitest` as devDeps (one-line justification will be
   in the ADR).
5. **Out-of-scope content (`offer.includes` slugs, AI badge translations)**:
   confirm deferred to a follow-up ticket. Audit will note as known gap.

---

**End of audit. Stopping per brief §0 Phase 1. Awaiting review before drafting
the ADR.**
