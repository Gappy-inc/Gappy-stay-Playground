'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CartItem } from '@/types'

function LeafCheck() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="scale-in" aria-hidden="true">
      <circle cx="40" cy="40" r="36" stroke="#5B8A3C" strokeWidth="1.5" opacity="0.4" />
      <circle cx="40" cy="40" r="28" stroke="#5B8A3C" strokeWidth="1" opacity="0.25" />
      <ellipse cx="40" cy="36" rx="10" ry="5" fill="#A8C97F" opacity="0.6" transform="rotate(-30 40 36)" />
      <ellipse cx="44" cy="42" rx="9" ry="4.5" fill="#5B8A3C" opacity="0.5" transform="rotate(15 44 42)" />
      <ellipse cx="35" cy="42" rx="8" ry="4" fill="#A8C97F" opacity="0.45" transform="rotate(-50 35 42)" />
      <path d="M28 40 L36 48 L52 32" stroke="#2C4A1E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
    </svg>
  )
}

export default function CompletePage() {
  const router = useRouter()
  const t = useTranslations('complete')
  const tCart = useTranslations('cart')
  const [confirmedItems, setConfirmedItems] = useState<CartItem[]>([])

  useEffect(() => {
    try {
      const cartRaw    = localStorage.getItem('gappy-cart')
      const bookingRaw = localStorage.getItem('gappy-current-booking')

      if (bookingRaw) {
        const booking = JSON.parse(bookingRaw)

        if (cartRaw) {
          const items: CartItem[] = JSON.parse(cartRaw)
          setConfirmedItems(items)
          localStorage.removeItem('gappy-cart')

          if (items.length > 0) {
            const total = items.reduce((s, i) => s + i.price * i.quantity, 0)
            fetch('/api/admin/orders', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                order_id: `ORD-${Date.now()}`,
                booking_id: booking.booking_id,
                guest_name: booking.guest_name,
                room_type: booking.room_type,
                check_in: booking.check_in,
                items,
                total,
                created_at: new Date().toISOString(),
              }),
            }).catch(() => {})
          }
        }
      }
    } catch {}
  }, [])

  const total = confirmedItems.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <div
      className="max-w-sm mx-auto min-h-screen flex flex-col items-center px-8 py-16"
      style={{ background: 'linear-gradient(170deg, #F8F6F0 0%, #F0F4EC 100%)' }}
    >
      <div className="mb-8">
        <LeafCheck />
      </div>

      <h1
        className="text-3xl font-medium text-center mb-2 fade-in-up"
        style={{ color: '#2C4A1E', letterSpacing: '0.02em', animationDelay: '0.2s' }}
      >
        {t('heading')}
      </h1>

      <div
        className="mb-4 fade-in-up"
        style={{ width: 40, height: 1, background: 'rgba(91,138,60,0.35)', animationDelay: '0.3s' }}
      />

      <p
        className="text-xs text-center mb-2 fade-in-up"
        style={{ color: '#7A8C70', letterSpacing: '0.06em', animationDelay: '0.35s' }}
      >
        {t('addonsReady')}
      </p>
      <p
        className="text-xs text-center mb-10 fade-in-up"
        style={{ color: '#5B8A3C', letterSpacing: '0.12em', fontStyle: 'italic', animationDelay: '0.4s' }}
      >
        {t('farewell')}
      </p>

      {confirmedItems.length > 0 && (
        <div className="w-full mb-10 fade-in-up" style={{ animationDelay: '0.45s' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1" style={{ borderTop: '1px dashed #A8C97F' }} />
            <span style={{ color: '#7A8C70', fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              {t('yourAddons')}
            </span>
            <div className="flex-1" style={{ borderTop: '1px dashed #A8C97F' }} />
          </div>

          <div className="space-y-2">
            {confirmedItems.map((item) => (
              <div
                key={item.offer_id}
                className="flex items-center justify-between gap-3 px-4 py-3"
                style={{ background: '#fff', border: '1px solid #F0EBE0', borderLeft: '3px solid #5B8A3C', borderRadius: 8 }}
              >
                <span className="text-sm font-medium truncate" style={{ color: '#2C4A1E' }}>{item.title}</span>
                <span className="text-sm font-semibold shrink-0" style={{ color: '#5B8A3C' }}>¥{item.price.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div
            className="flex items-center justify-between px-4 pt-4"
            style={{ borderTop: '1px solid #D4C5A9', marginTop: '0.75rem' }}
          >
            <span className="text-xs font-semibold" style={{ color: '#7A8C70', letterSpacing: '0.08em' }}>
              {tCart('total')}
            </span>
            <span style={{ fontSize: '1.25rem', fontWeight: 600, color: '#2C4A1E' }}>
              ¥{total.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      <button
        onClick={() => router.push('/')}
        className="px-8 py-3 text-sm transition-all active:scale-95 fade-in-up"
        style={{
          background: '#5B8A3C',
          color: '#fff',
          borderRadius: 10,
          border: 'none',
          letterSpacing: '0.08em',
          fontFamily: 'inherit',
          cursor: 'pointer',
          animationDelay: '0.5s',
        }}
      >
        {t('backToHotel')}
      </button>
    </div>
  )
}
