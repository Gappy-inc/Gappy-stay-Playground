'use client'

import { useState, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { GeneratedOffer } from '@/types'
import { useCart } from '@/context/CartContext'
import { unitLabel } from '@/lib/i18n/format'

const CATEGORY_ICON: Record<string, string> = {
  room:       '🛏️',
  dining:     '🍳',
  wellness:   '♨️',
  transport:  '🚗',
  experience: '🍶',
  bundle:     '✨',
}

function getBadgeStyle(badge: string) {
  if (badge.startsWith('Last')) return { bg: '#8B2020', color: '#fff' }
  if (badge === 'Most Popular')  return { bg: '#5B8A3C', color: '#fff' }
  if (badge === 'Best Deal')     return { bg: '#B8963E', color: '#fff' }
  return { bg: '#D4C5A9', color: '#2C4A1E' }
}

type Props = { offer: GeneratedOffer; index: number; fullWidth?: boolean }

export default function OfferCard({ offer, index, fullWidth = false }: Props) {
  const { addItem, hasItem } = useCart()
  const t = useTranslations('offerCard')
  const tUnits = useTranslations('units')
  const [bouncing, setBouncing] = useState(false)
  const [hovered, setHovered]   = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const added  = hasItem(offer.offer_id)

  function handleAdd() {
    if (added) return
    addItem({
      offer_id: offer.offer_id,
      title: offer.title,
      price: offer.price,
      unit: offer.unit,
      quantity: 1,
    })
    setBouncing(true)
    setTimeout(() => setBouncing(false), 400)
  }

  const badgeStyle = offer.badge ? getBadgeStyle(offer.badge) : null

  return (
    <div
      className={`fade-in-up ${fullWidth ? 'w-full' : 'shrink-0 w-72'} bg-white flex flex-col overflow-hidden`}
      style={{
        borderRadius: 12,
        borderLeft: `3px solid ${hovered ? '#A8C97F' : '#5B8A3C'}`,
        border: `1px solid ${hovered ? '#A8C97F' : '#e8e4dc'}`,
        borderLeftWidth: 3,
        borderLeftColor: hovered ? '#A8C97F' : '#5B8A3C',
        boxShadow: hovered
          ? '0 4px 16px rgba(91,138,60,0.12)'
          : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        animationDelay: `${index * 0.08}s`,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top gradient strip */}
      <div style={{ height: 4, background: 'linear-gradient(90deg, #A8C97F 0%, #5B8A3C 100%)' }} />

      {/* Badge */}
      {offer.badge && badgeStyle && (
        <div
          className="px-3 py-1.5 text-xs font-semibold text-center"
          style={{ background: badgeStyle.bg, color: badgeStyle.color, letterSpacing: '0.06em' }}
        >
          {offer.badge}
        </div>
      )}

      <div className="p-4 flex flex-col flex-1">
        {/* Icon + title */}
        <div className="flex items-start gap-3 mb-3">
          <span className="text-xl shrink-0 mt-0.5">{CATEGORY_ICON[offer.category] ?? '🎁'}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm leading-tight" style={{ color: '#2C4A1E' }}>
              {offer.title}
            </h3>
            {offer.availability <= 5 && !offer.badge?.startsWith('Last') && (
              <p className="text-xs mt-0.5 font-medium" style={{ color: '#8B2020' }}>
                {t('onlyLeft', { count: offer.availability })}
              </p>
            )}
          </div>
        </div>

        {/* Description only — no personalized_message */}
        {offer.description && (
          <p className="text-xs leading-relaxed mb-3 flex-1" style={{ color: '#7A8C70' }}>
            {offer.description}
          </p>
        )}

        {/* Includes (bundle) */}
        {offer.includes && offer.includes.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {offer.includes.map((inc) => (
              <span
                key={inc}
                className="text-xs px-2 py-0.5"
                style={{
                  background: '#F0F4EC',
                  color: '#5B8A3C',
                  border: '1px solid rgba(91,138,60,0.2)',
                  borderRadius: 4,
                }}
              >
                ✓ {inc.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        )}

        {/* Price + CTA */}
        <div
          className="flex items-center justify-between gap-2 mt-auto pt-3"
          style={{ borderTop: '1px solid #F0EBE0' }}
        >
          <div>
            {offer.original_price && (
              <p className="text-xs line-through" style={{ color: '#C0C0B0' }}>
                ¥{offer.original_price.toLocaleString()}
              </p>
            )}
            <span
              className="font-semibold"
              style={{ color: offer.original_price ? '#5B8A3C' : '#2C4A1E', fontSize: '1.15rem' }}
            >
              ¥{offer.price.toLocaleString()}
            </span>
            <p className="text-xs" style={{ color: '#B0B0A0' }}>{unitLabel(tUnits, offer.unit)}</p>
          </div>

          <button
            ref={btnRef}
            onClick={handleAdd}
            disabled={added}
            className={`shrink-0 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${bouncing ? 'bounce-click' : ''}`}
            style={{
              background: added ? '#E8E8E0' : '#5B8A3C',
              color: added ? '#888' : '#fff',
              border: 'none',
              cursor: added ? 'default' : 'pointer',
            }}
          >
            {added ? t('added') : t('add')}
          </button>
        </div>
      </div>
    </div>
  )
}
