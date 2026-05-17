'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import LanguageSwitcher from '@/components/LanguageSwitcher'

/* ── Leaf illustration ──────────────────────────────── */
function LeafIllustration() {
  return (
    <svg
      width="160"
      height="90"
      viewBox="0 0 160 90"
      fill="none"
      aria-hidden="true"
      className="leaf-sway"
    >
      {/* Main branch */}
      <path
        d="M15 82 C35 68 58 52 82 36 C102 23 130 12 148 6"
        stroke="#A8C97F"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Leaf 1 */}
      <ellipse cx="52" cy="57" rx="15" ry="7" fill="#A8C97F" opacity="0.85"
        transform="rotate(-38 52 57)" />
      <line x1="40" y1="63" x2="64" y2="51" stroke="#5B8A3C" strokeWidth="0.6" opacity="0.5" />
      {/* Leaf 2 */}
      <ellipse cx="75" cy="42" rx="17" ry="8" fill="#5B8A3C" opacity="0.75"
        transform="rotate(-28 75 42)" />
      <line x1="61" y1="48" x2="89" y2="36" stroke="#2C4A1E" strokeWidth="0.6" opacity="0.35" />
      {/* Leaf 3 */}
      <ellipse cx="100" cy="27" rx="14" ry="6" fill="#A8C97F" opacity="0.65"
        transform="rotate(-50 100 27)" />
      <line x1="89" y1="33" x2="111" y2="21" stroke="#5B8A3C" strokeWidth="0.5" opacity="0.4" />
      {/* Leaf 4 */}
      <ellipse cx="124" cy="15" rx="12" ry="5.5" fill="#5B8A3C" opacity="0.5"
        transform="rotate(-65 124 15)" />
    </svg>
  )
}

/* ── Page ───────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(false)
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bookings')
      const { bookings } = await res.json()
      const n = name.trim().toLowerCase()
      const booking = bookings.find((b: { guest_name: string; booking_id: string }) =>
        b.guest_name.toLowerCase() === n
      )
      if (booking) {
        router.push(`/offer/${booking.booking_id}`)
      } else {
        setError(true)
        setLoading(false)
      }
    } catch {
      setError(true)
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: 'linear-gradient(170deg, #F8F6F0 0%, #F0F4EC 100%)' }}
    >
      {/* Language switcher — FR-2: top-right of the landing page. T-1 will
          adjust visual treatment. */}
      <div style={{ position: 'absolute', top: 16, right: 16, color: '#5B8A3C' }}>
        <LanguageSwitcher />
      </div>

      {/* Logo */}
      <div className="mb-2 text-center fade-in-up">
        <p className="text-xs tracking-widest mb-3" style={{ color: '#A8C97F', letterSpacing: '0.25em' }}>
          GAPPY HOTEL TOKYO
        </p>
        <h1 className="text-3xl font-light tracking-wide" style={{ color: '#2C4A1E' }}>
          Gappy Stay
        </h1>
      </div>

      {/* Leaf illustration */}
      <div className="mb-8 fade-in-up" style={{ animationDelay: '0.05s' }}>
        <LeafIllustration />
      </div>

      {/* Card */}
      <div
        className="w-full max-w-xs fade-in-up"
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '2rem 1.75rem',
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          animationDelay: '0.1s',
        }}
      >
        <h2 className="text-base font-medium mb-1" style={{ color: '#2C4A1E' }}>
          Welcome to Gappy Hotel Tokyo
        </h2>
        <p className="text-xs mb-6 leading-relaxed" style={{ color: '#888' }}>
          Please enter your full name to access your personalized offers
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: '#5B8A3C', letterSpacing: '0.05em' }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setError(false) }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="e.g. James Mitchell"
              autoFocus
              autoComplete="off"
              style={{
                display: 'block',
                width: '100%',
                border: 'none',
                borderBottom: `2px solid ${error ? '#8B2020' : focused ? '#5B8A3C' : '#D4C5A9'}`,
                borderRadius: 0,
                background: 'transparent',
                outline: 'none',
                padding: '10px 0',
                fontSize: '15px',
                color: '#2C4A1E',
                fontFamily: 'inherit',
                transition: 'border-color 0.2s',
              }}
            />
            {error && (
              <p className="text-xs mt-2 leading-relaxed" style={{ color: '#8B2020' }}>
                We couldn&apos;t find a reservation under that name.
                Please check your full name and try again.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!name.trim() || loading}
            style={{
              display: 'block',
              width: '100%',
              background: name.trim() && !loading ? '#5B8A3C' : '#D4C5A9',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '14px',
              fontSize: '14px',
              fontWeight: 500,
              fontFamily: 'inherit',
              cursor: name.trim() && !loading ? 'pointer' : 'default',
              transition: 'background 0.2s',
              letterSpacing: '0.03em',
            }}
          >
            {loading ? 'Searching...' : 'Find My Reservation →'}
          </button>
        </form>
      </div>

      <p className="mt-8 text-xs fade-in-up" style={{ color: '#C0C0B0', animationDelay: '0.15s' }}>
        Powered by Gappy Stay AI
      </p>
    </div>
  )
}
