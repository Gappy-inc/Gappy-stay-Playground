'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useCart } from '@/context/CartContext'

export default function CartDrawer() {
  const { total, itemCount } = useCart()
  const router = useRouter()
  const t = useTranslations('cart')
  const [bouncing, setBouncing] = useState(false)
  const [prevCount, setPrevCount] = useState(itemCount)

  useEffect(() => {
    if (itemCount > prevCount) {
      setBouncing(true)
      setTimeout(() => setBouncing(false), 400)
    }
    setPrevCount(itemCount)
  }, [itemCount, prevCount])

  if (itemCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 w-full max-w-sm">
      <button
        onClick={() => router.push('/checkout')}
        className={`w-full flex items-center justify-between gap-3 px-5 py-4 font-medium text-sm transition-all ${bouncing ? 'cart-bounce' : ''}`}
        style={{
          background: '#5B8A3C',
          color: '#fff',
          borderRadius: 12,
          border: 'none',
          boxShadow: '0 4px 20px rgba(91,138,60,0.35)',
          letterSpacing: '0.04em',
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base">🛒</span>
          <span>
            {t('itemCount', { count: itemCount })} · ¥{total.toLocaleString()}
          </span>
        </div>
        <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '12px', letterSpacing: '0.08em' }}>
          {t('checkout')}
        </span>
      </button>
    </div>
  )
}
