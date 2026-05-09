'use client'

import { useState } from 'react'
import { GeneratedOffer } from '@/types'
import { useCart } from '@/context/CartContext'
import { useLang } from '@/context/LangContext'

type Props = { offer: GeneratedOffer }

export default function BundleCard({ offer }: Props) {
  const { addItem, hasItem } = useCart()
  const t = useLang()
  const [bouncing, setBouncing] = useState(false)
  const added   = hasItem(offer.offer_id)
  const savings = offer.original_price ? offer.original_price - offer.price : null

  function handleAdd() {
    if (added) return
    addItem({ offer_id: offer.offer_id, title: offer.title, price: offer.price, unit: offer.unit, quantity: 1 })
    setBouncing(true)
    setTimeout(() => setBouncing(false), 400)
  }

  return (
    <div
      className="overflow-hidden"
      style={{
        background: '#F0F4EC',
        borderLeft: '3px solid #B8963E',
        borderRadius: 12,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
      }}
    >
      {/* Top banner */}
      <div
        className="px-4 py-2 flex items-center justify-between"
        style={{ background: '#B8963E' }}
      >
        <span className="text-white text-xs font-semibold" style={{ letterSpacing: '0.12em' }}>
          {t.bundleLabel}
        </span>
        {savings && (
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
            ¥{savings.toLocaleString()} OFF
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <span className="text-xl shrink-0 mt-0.5">✨</span>
          <div>
            <h3 className="font-medium text-base" style={{ color: '#2C4A1E' }}>
              {offer.title}
            </h3>
            {/* description only */}
            {offer.description && (
              <p className="text-xs mt-1 leading-relaxed" style={{ color: '#7A8C70' }}>
                {offer.description}
              </p>
            )}
          </div>
        </div>

        {/* Includes */}
        {offer.includes && offer.includes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {offer.includes.map((inc) => (
              <span
                key={inc}
                className="text-xs px-2.5 py-1 font-medium"
                style={{
                  background: '#fff',
                  color: '#5B8A3C',
                  border: '1px solid rgba(91,138,60,0.2)',
                  borderRadius: 6,
                }}
              >
                ✓ {inc.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Price + CTA */}
        <div className="flex items-center justify-between gap-4">
          <div>
            {offer.original_price && (
              <p className="text-sm line-through" style={{ color: '#C0C0B0' }}>
                ¥{offer.original_price.toLocaleString()}
              </p>
            )}
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold" style={{ color: '#5B8A3C', fontSize: '1.6rem' }}>
                ¥{offer.price.toLocaleString()}
              </span>
              <span className="text-xs" style={{ color: '#888' }}>
                {t.units[offer.unit] ?? offer.unit}
              </span>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={added}
            className={`px-5 py-3 text-sm font-semibold rounded-lg transition-all ${bouncing ? 'bounce-click' : ''}`}
            style={{
              background: added ? '#e8e8e3' : '#5B8A3C',
              color: added ? '#888' : '#fff',
              border: 'none',
              cursor: added ? 'default' : 'pointer',
            }}
          >
            {added ? t.addedBtn : t.addBundleBtn}
          </button>
        </div>
      </div>
    </div>
  )
}
