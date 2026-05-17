'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CartItem } from '@/types'
import { unitLabel } from '@/lib/i18n/format'

export default function CheckoutPage() {
  const router = useRouter()
  const t = useTranslations('cart')
  const tUnits = useTranslations('units')
  const [items, setItems]   = useState<CartItem[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('gappy-cart')
      if (saved) setItems(JSON.parse(saved))
    } catch {}
    setLoaded(true)
  }, [])

  function removeItem(offerId: string) {
    const updated = items.filter((i) => i.offer_id !== offerId)
    setItems(updated)
    localStorage.setItem('gappy-cart', JSON.stringify(updated))
  }

  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  if (!loaded) return null

  if (items.length === 0) {
    return (
      <div
        className="max-w-sm mx-auto min-h-screen flex flex-col items-center justify-center gap-6 px-8"
        style={{ background: 'linear-gradient(170deg, #F8F6F0 0%, #F0F4EC 100%)' }}
      >
        <p className="text-3xl">🛒</p>
        <p className="text-sm" style={{ color: '#999' }}>{t('empty')}</p>
        <button
          onClick={() => router.push('/')}
          className="text-sm px-6 py-3"
          style={{
            background: '#5B8A3C',
            color: '#fff',
            borderRadius: 10,
            border: 'none',
            letterSpacing: '0.06em',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          <BackLabel />
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto min-h-screen" style={{ background: '#F8F6F0' }}>

      {/* Header */}
      <div className="px-5 pt-7 pb-5" style={{ background: '#fff', borderBottom: '1px solid #F0EBE0' }}>
        <button
          onClick={() => router.back()}
          className="text-xs mb-5 block transition-colors"
          style={{ color: '#A8C97F', letterSpacing: '0.05em' }}
        >
          <BackLabel />
        </button>
        <h1 className="text-2xl font-medium" style={{ color: '#2C4A1E', letterSpacing: '0.02em' }}>
          {t('title')}
        </h1>
        <p className="text-xs mt-1" style={{ color: '#7A8C70', letterSpacing: '0.05em' }}>
          {t('reviewBefore')}
        </p>
      </div>

      {/* Items */}
      <div className="px-5 py-2" style={{ background: '#fff' }}>
        {items.map((item) => (
          <div
            key={item.offer_id}
            className="flex items-center justify-between gap-4 py-4"
            style={{ borderBottom: '1px solid #F0EBE0' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#2C4A1E' }}>
                {item.title}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#B0B0A0' }}>
                {unitLabel(tUnits, item.unit)}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm font-semibold" style={{ fontSize: '1rem', color: '#2C4A1E' }}>
                ¥{item.price.toLocaleString()}
              </span>
              <button
                onClick={() => removeItem(item.offer_id)}
                className="text-xs transition-colors w-5 h-5 flex items-center justify-center"
                style={{ color: '#D4C5A9' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#8B2020')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#D4C5A9')}
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Total + CTA */}
      <div className="px-5 py-6" style={{ background: '#fff' }}>
        <div
          className="flex items-center justify-between py-4 mb-1"
          style={{ borderTop: '2px solid #2C4A1E' }}
        >
          <span className="text-sm font-semibold" style={{ color: '#2C4A1E' }}>{t('total')}</span>
          <span className="font-semibold" style={{ fontSize: '1.75rem', color: '#5B8A3C' }}>
            ¥{total.toLocaleString()}
          </span>
        </div>
        <p className="text-xs mb-6" style={{ color: '#B0B0A0' }}>
          {t('roomBillNote')}
        </p>

        <button
          onClick={() => router.push('/complete')}
          className="w-full py-4 text-sm font-medium transition-all active:scale-95"
          style={{
            background: '#5B8A3C',
            color: '#fff',
            borderRadius: 12,
            border: 'none',
            letterSpacing: '0.06em',
            fontFamily: 'inherit',
            cursor: 'pointer',
          }}
        >
          {t('confirmPay')}
        </button>
      </div>
    </div>
  )
}

/** Tiny inline component for the common.back string — avoids a second hook call. */
function BackLabel() {
  const t = useTranslations('common')
  return <>{t('back')}</>
}
