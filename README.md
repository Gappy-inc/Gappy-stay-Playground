This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Internationalization

The guest-facing UI is fully internationalized via [`next-intl`](https://next-intl.dev). The
foundation, design rationale, and per-decision tradeoffs are documented in
[`docs/adr/0001-i18n-architecture.md`](./docs/adr/0001-i18n-architecture.md); the original
audit lives in [`docs/i18n-audit.md`](./docs/i18n-audit.md).

### Supported locales

In priority order for translation quality (English is the canonical source of truth):

| Code | Native label | Notes |
|---|---|---|
| `en` | English | Default fallback and source language for `en.json` |
| `ja` | 日本語 | Domestic guests and hotel staff |
| `zh-TW` | 繁體中文 | Taiwan, Hong Kong |
| `zh-CN` | 简体中文 | Mainland China; legacy `Booking.language === 'zh'` aliases here |
| `ko` | 한국어 | Korean inbound travel |

The single source of truth for the locale list is `lib/i18n/config.ts`. Add or remove a
locale there and the type system propagates the change everywhere
(`SupportedLocale`, the `LanguageSwitcher`, the parity script, etc.).

### Locale resolution chain

Every request resolves to exactly one locale via this precedence:

1. **URL** `?lang=<code>` — validated against the supported set; invalid values fall through, never error.
2. **Cookie** `gappy_locale` — same validation.
3. **`Accept-Language`** header — q-value parsed; `zh-Hant*` → `zh-TW`, plain `zh*` → `zh-CN`, primary-subtag fallback (`ko-KR` → `ko`).
4. **`booking.language`** — only on routes with a booking context (`/offer/[bookingId]`, `/checkout`, `/complete`). Acts as a fallback when AL didn't match a supported locale.
5. **`en`** default.

The resolver lives in `lib/i18n/resolve.ts` as a pure, side-effect-free function with
22 unit tests in `tests/i18n/resolve.test.ts`. Middleware (`proxy.ts`, the Next 16 rename
of `middleware.ts`) handles steps 1–3; step 4 is applied page-side in
`app/offer/[bookingId]/page.tsx` because the proxy runs before route params are known.

### Adding a new translation key

The English file is the schema. Add to `en.json` first; everything else flows from it.

```bash
# 1. Edit lib/i18n/locales/en.json — add your key in the appropriate namespace.
#    Use camelCase, scope by feature (offerCard.add, not OfferCard_add or addBtn).
#    For interpolation: "Welcome, {firstName}"
#    For plurals:      "{count, plural, one {# night} other {# nights}}"

# 2. Reference it from a component:
#    Server: const t = await getTranslations('offerCard'); t('add')
#    Client: const t = useTranslations('offerCard'); t('add')
#    Email:  const t = await getEmailTranslations(locale); t('email.subject', { firstName })

# 3. Validate parity. Missing keys in non-en files are warnings, not errors —
#    they fall back to en at runtime. Extra keys (orphans) ARE errors.
npm run i18n:check

# 4. Populate other locales — either by hand (recommended for short, critical
#    strings) or via the AI bootstrap (below).
```

The `Messages` interface is auto-augmented from `en.json` via `messages.d.ts`, so
TypeScript will flag any `t('typo.path')` as a compile error.

#### Brand wordmarks

The strings `"Gappy Stay"`, `"Gappy Hotel Tokyo"`, and `"GAPPY HOTEL TOKYO"` are
proper nouns. They stay **untranslated** in every locale and are rendered as JSX
literals — they are not keys in `en.json`. Don't add them.

### AI bootstrap for non-English locales

The `i18n:generate` script uses the Anthropic SDK (`@anthropic-ai/sdk`, already in
`package.json`) to first-pass translate every `en.json` leaf into `ja`, `zh-TW`,
`zh-CN`, and `ko`. The prompt enforces:

- ICU placeholders preserved verbatim.
- CLDR plural categories adapted per target (Japanese, Chinese, Korean → only `other`).
- Brand wordmarks untranslated.
- Emoji and arrow punctuation preserved.

```bash
export ANTHROPIC_API_KEY=sk-ant-...

npm run i18n:generate
```

Output of every regenerated key is marked `"ai"` in `lib/i18n/locales/_meta.json`. As
native-speaker reviewers approve a translation, they flip the entry to `"human"` —
subsequent `npm run i18n:generate` runs leave `"human"` entries untouched.

> Current status: All non-English files are empty `{}` placeholders. Native
> review will author the JSONs directly. If you prefer AI bootstrap, run the
> script above; it is fully wired and ready.

### Server vs. client component patterns

```tsx
// Server component (default in app/)
import { getTranslations } from 'next-intl/server'

export default async function Page() {
  const t = await getTranslations('landing')
  return <h1>{t('welcome.heading')}</h1>
}
```

```tsx
// Client component
'use client'
import { useTranslations } from 'next-intl'

export default function Form() {
  const t = useTranslations('landing.form')
  return <button>{t('submit')}</button>
}
```

Date and number formatting uses `next-intl`'s `useFormatter()` / `getFormatter()`:

```tsx
const fmt = useFormatter()
fmt.dateTime(new Date(), { month: 'short', day: 'numeric' })
```

### Email translations

Emails have no request context (no proxy, no cookies, no `Accept-Language`). Routes
under `app/api/email/*` pass the target locale explicitly:

```ts
import { getEmailTranslations } from '@/lib/i18n/email'

const locale = normalizeBookingLocale(booking.language)
const t = await getEmailTranslations(locale)
const subject = t('email.subject', { firstName })
```

### Observability for missing keys

- **Dev** (`NODE_ENV !== 'production'`): every missing key emits a `console.warn`
  with the key, locale, and a `⟪namespace.key⟫` placeholder in the rendered UI.
- **Prod**: the placeholder is the bare key path (no markers in the visible UI),
  and a structured JSON line is emitted via `console.warn` for future routing to
  Sentry / Datadog (tracked under **T-15c**).

### Dev-environment requirements

- **`KV_REST_API_URL` / `KV_REST_API_TOKEN`** — required for any route that
  touches `lib/runtime-store.ts` (Upstash Redis). In practice that means
  `/offer/[bookingId]` and the admin CSV upload flow. Without these vars set,
  those routes return 500 in `npm run dev`. The landing (`/`), checkout, and
  complete pages run without them.
- **`ANTHROPIC_API_KEY`** — required only for `npm run i18n:generate`. Not
  needed for `npm run dev`, `npm run build`, or any other script.
- **No `next lint` in Next 16** — the subcommand was removed. Use
  `npm run lint` (which calls `eslint .` directly using the flat config in
  `eslint.config.mjs`).

### Known limitations

- **`<html lang>` mismatch on the booking.language final fallback.** Root layout
  resolves locale from the *middleware* chain (URL / cookie / Accept-Language /
  en) before any route params are available, so `<html lang>` reflects that
  layer only. The `booking.language` step is applied page-side in
  `app/offer/[bookingId]/page.tsx` and overrides the in-page translations via a
  nested `NextIntlClientProvider`. In the rare case where `Accept-Language`
  doesn't include any supported locale but `booking.language` is supported, the
  page subtree will render in `booking.language` while `<html lang>` stays at
  the middleware result (typically `en`). Screen readers using `<html lang>`
  for pronunciation can mispronounce in that case.

  **Workaround**: ensure `Accept-Language` is set correctly on the device.
  Modern browsers respect OS-level language settings; if a guest's device is
  configured for Japanese, the chain stops at step 3 and `<html lang>` matches.
  A proper fix requires booking lookup at root-layout time and is tracked
  under **T-15e**.

- **AI-generated content fields** (`offer.title`, `offer.description`,
  `offer.badge`, `offer.personalized_message`, `offer.includes` slugs) are
  produced by `/api/generate-offers` and are out of scope for translation
  files. They're prompted in the guest's locale but parity with UI chrome is
  best-effort. Tracked under **T-15b**.

### File layout reference

```
proxy.ts                      Next 16 file convention (renamed from middleware.ts)
next.config.ts                Wraps NextConfig with createNextIntlPlugin
messages.d.ts                 Augments next-intl's Messages from en.json
eslint.config.mjs             Flat config; downgrades React Compiler strict rules
vitest.config.ts              Vitest config with @/* alias

lib/i18n/
  config.ts                   SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE,
                              LOCALE_LABEL, PROXY_URL_LANG_HEADER, isSupportedLocale
  resolve.ts                  Pure resolveLocale() — the chain in §"Locale resolution"
  request.ts                  next-intl getRequestConfig — read cookies/headers
  email.ts                    getEmailTranslations(locale) for FR-6
  format.ts                   unitLabel(t, slug) snake_case → camelCase bridge
  locales/
    en.json                   Source of truth (61 keys)
    ja.json                   {} — awaiting native review or AI bootstrap
    zh-TW.json                {} — awaiting native review or AI bootstrap
    zh-CN.json                {} — awaiting native review or AI bootstrap
    ko.json                   {} — awaiting native review or AI bootstrap
    _meta.json                Per-locale, per-key {"ai" | "human"} review status

components/
  LanguageSwitcher.tsx        Consumer-positioned dropdown — keyboard-navigable,
                              aria-live, native labels

scripts/
  i18n-check.ts               Parity + ICU-placeholder + orphan validation
  i18n-generate.ts            AI bootstrap via @anthropic-ai/sdk

tests/i18n/
  resolve.test.ts             22 cases covering NFR-7 + chain edge cases
```

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack); needs KV vars for `/offer/[bookingId]` |
| `npm run build` | Production build; no env vars required for foundation |
| `npm run start` | Run production build |
| `npm run lint` | ESLint flat config (`eslint .`) |
| `npm run test` | Vitest (single run) — runs the locale-resolver unit tests |
| `npm run i18n:check` | Validate locale-file parity + ICU placeholders + orphans |
| `npm run i18n:generate` | AI-bootstrap non-en locales from `en.json` (needs `ANTHROPIC_API_KEY`) |
