import { NextResponse, type NextRequest } from 'next/server'
import {
  LOCALE_COOKIE,
  PROXY_URL_LANG_HEADER,
  isSupportedLocale,
} from '@/lib/i18n/config'

/**
 * Next 16 proxy file (renamed from `middleware.ts` in v16.0.0 — see
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`).
 *
 * Two jobs:
 *
 *   1. If the request has a valid `?lang=<code>` query param, persist
 *      the choice in the {@link LOCALE_COOKIE} cookie so it survives the
 *      next visit (DoD §2). Invalid `?lang=` values are ignored — the
 *      proxy does *not* error; the next link in the resolution chain
 *      takes over inside `lib/i18n/request.ts` (FR-1 §4 of the brief).
 *
 *   2. Forward the validated URL signal downstream via
 *      {@link PROXY_URL_LANG_HEADER} so `getRequestConfig` can include it
 *      in its resolution chain (server components don't have direct
 *      access to the request URL).
 *
 * `booking.language` is *not* applied here — at proxy time the route
 * params are unknown, so we cannot look up a booking by id. Routes that
 * carry booking context apply that final fallback page-side.
 *
 * @see docs/adr/0001-i18n-architecture.md §3 DD-6 and §9 (Edge runtime
 *      risk note — moot in Next 16 since proxy defaults to Node.js).
 */
export function proxy(request: NextRequest) {
  const rawLang = request.nextUrl.searchParams.get('lang')
  const validatedLang = isSupportedLocale(rawLang) ? rawLang : null

  // Forward the URL signal (if valid) to getRequestConfig via a request
  // header. Using NextResponse.next({ request: { headers } }) — NOT
  // response.headers — so the value is upstream-visible, not exposed to
  // the client. See proxy.md "Setting Headers" §.
  const requestHeaders = new Headers(request.headers)
  if (validatedLang) {
    requestHeaders.set(PROXY_URL_LANG_HEADER, validatedLang)
  } else {
    // Defensive: scrub any spoofed header from upstream callers — only
    // values produced by this proxy should ever be honored downstream.
    requestHeaders.delete(PROXY_URL_LANG_HEADER)
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Pin the cookie so the choice survives without ?lang= on next visit.
  if (validatedLang) {
    response.cookies.set({
      name: LOCALE_COOKIE,
      value: validatedLang,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      // No httpOnly: the LanguageSwitcher reads it client-side (NFR-4).
    })
  }

  return response
}

export const config = {
  // Run on every guest-facing path. Exclude API routes (they have their
  // own locale handling — emails take an explicit `locale` per FR-6),
  // static assets, Next internals, and image optimization.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
}
