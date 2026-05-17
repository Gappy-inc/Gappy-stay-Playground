'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  LOCALE_COOKIE,
  LOCALE_LABEL,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '@/lib/i18n/config'

/**
 * Module-level helper so the React Compiler doesn't flag the
 * `document.cookie` write as a component-local mutation. The write
 * happens in a click handler (not a render path) — safe by construction.
 */
function writeLocaleCookie(locale: SupportedLocale) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie =
    `${LOCALE_COOKIE}=${encodeURIComponent(locale)}; ` +
    `path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`
}

/**
 * Language switcher (FR-2, NFR-3).
 *
 * Unstyled in Phase 3 — T-1 will integrate visually. Behavior is final:
 *
 * - Lists all {@link SUPPORTED_LOCALES} with native (autoglottonym) labels.
 * - Selecting a locale writes the {@link LOCALE_COOKIE} cookie and pushes
 *   `?lang=<code>` so back/forward navigation preserves the choice.
 * - Routing via `router.replace` triggers `getRequestConfig` to re-run,
 *   re-rendering the entire tree in the new locale without a full reload.
 * - Keyboard-navigable: Tab/Enter/Space to open, Arrow keys to move,
 *   Enter to select, Escape to close.
 * - `aria-live` region announces the change.
 *
 * Consumer-positioned per ADR §3 DD-7 — pages place it where their
 * layout calls for. Phase 3 wires it into `app/page.tsx` only.
 */
export default function LanguageSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const activeLocale = useLocale() as SupportedLocale
  const t = useTranslations('languageSwitcher')

  const [open, setOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(() =>
    SUPPORTED_LOCALES.indexOf(activeLocale)
  )
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDocumentClick(e: MouseEvent) {
      const t = e.target as Node
      if (
        listRef.current && !listRef.current.contains(t) &&
        buttonRef.current && !buttonRef.current.contains(t)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocumentClick)
    return () => document.removeEventListener('mousedown', onDocumentClick)
  }, [open])

  function selectLocale(locale: SupportedLocale) {
    // 1. Persist via cookie (so reload without ?lang= keeps the choice).
    //    Mirror proxy.ts settings — see NFR-4.
    writeLocaleCookie(locale)

    // 2. Update URL with ?lang= so back/forward + share-link work.
    const params = new URLSearchParams(searchParams?.toString() ?? '')
    params.set('lang', locale)
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)

    // 3. Announce. The label is read in the *new* locale so the SR
    //    confirms the change took effect.
    setAnnouncement(t('ariaChanged', { language: LOCALE_LABEL[locale] }))
    setOpen(false)
    // Return focus to the button after selection
    buttonRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLUListElement>) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      buttonRef.current?.focus()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((i) => (i + 1) % SUPPORTED_LOCALES.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex(
        (i) => (i - 1 + SUPPORTED_LOCALES.length) % SUPPORTED_LOCALES.length
      )
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      setFocusedIndex(0)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      setFocusedIndex(SUPPORTED_LOCALES.length - 1)
      return
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      selectLocale(SUPPORTED_LOCALES[focusedIndex])
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t('label')}
        onClick={() => {
          setOpen((o) => !o)
          setFocusedIndex(SUPPORTED_LOCALES.indexOf(activeLocale))
        }}
        style={{
          border: '1px solid currentColor',
          background: 'transparent',
          color: 'inherit',
          padding: '6px 12px',
          fontSize: 13,
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {LOCALE_LABEL[activeLocale]} <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={t('label')}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          onBlur={(e) => {
            if (!listRef.current?.contains(e.relatedTarget as Node)) {
              setOpen(false)
            }
          }}
          autoFocus
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            margin: 0,
            padding: '4px 0',
            background: '#fff',
            border: '1px solid #D4C5A9',
            borderRadius: 6,
            listStyle: 'none',
            minWidth: 140,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            zIndex: 60,
          }}
        >
          {SUPPORTED_LOCALES.map((locale, i) => {
            const isActive = locale === activeLocale
            const isFocused = i === focusedIndex
            return (
              <li
                key={locale}
                role="option"
                aria-selected={isActive}
                aria-current={isActive || undefined}
                tabIndex={isFocused ? 0 : -1}
                onClick={() => selectLocale(locale)}
                onMouseEnter={() => setFocusedIndex(i)}
                ref={(el) => {
                  if (isFocused && el) el.focus()
                }}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: isActive ? 600 : 400,
                  background: isFocused ? '#F0F4EC' : 'transparent',
                  outline: 'none',
                }}
              >
                {LOCALE_LABEL[locale]}
                {isActive && <span aria-hidden="true"> ✓</span>}
              </li>
            )
          })}
        </ul>
      )}

      {/* SR-only announcement. Polite to avoid interrupting other content. */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {announcement}
      </span>
    </div>
  )
}
