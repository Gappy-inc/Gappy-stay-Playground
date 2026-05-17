'use client'

import { useEffect, useRef, useState } from 'react'
import { NextIntlClientProvider, useTranslations } from 'next-intl'
import { Booking, OfferTemplate, GeneratedOffer } from '@/types'
import { detectChannel } from '@/lib/channel'
import { CartProvider } from '@/context/CartContext'
import type { SupportedLocale } from '@/lib/i18n/config'
import WelcomeBanner from '@/components/WelcomeBanner'
import OfferCard from '@/components/OfferCard'
import BundleCard from '@/components/BundleCard'
import CartDrawer from '@/components/CartDrawer'

const CATEGORY_ORDER = ['room', 'dining', 'wellness', 'transport', 'experience'] as const
type CategoryKey = (typeof CATEGORY_ORDER)[number] | 'bundle'

// ── Leaf SVG for dividers ────────────────────────────────────────────────────
function LeafIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <ellipse cx="7" cy="7" rx="5.5" ry="3" fill="#A8C97F" opacity="0.8"
        transform="rotate(-35 7 7)" />
      <line x1="3" y1="10" x2="11" y2="4" stroke="#5B8A3C" strokeWidth="0.6" opacity="0.5" />
    </svg>
  )
}

// ── Section divider ──────────────────────────────────────────────────────────
function Divider({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="flex-1" style={{ borderTop: '1px dashed #A8C97F' }} />
      <LeafIcon />
      <span
        style={{
          color: '#5B8A3C',
          fontSize: '10px',
          letterSpacing: '0.16em',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
      <LeafIcon />
      <div className="flex-1" style={{ borderTop: '1px dashed #A8C97F' }} />
    </div>
  )
}

// ── Snap-scroll section ──────────────────────────────────────────────────────
function CategorySection({
  title,
  offers,
  bg,
}: {
  title: string
  offers: GeneratedOffer[]
  bg: string
}) {
  const [activeIndex, setActiveIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleScroll() {
    if (!scrollRef.current) return
    const { scrollLeft, clientWidth } = scrollRef.current
    if (clientWidth === 0) return
    setActiveIndex(Math.round(scrollLeft / clientWidth))
  }

  if (offers.length === 0) return null

  return (
    <section style={{ background: bg, borderRadius: 12, padding: '1rem 0 0.75rem' }}>
      <div className="px-4">
        <Divider title={title} />
      </div>

      <div className="overflow-hidden" style={{ marginLeft: '-0px', marginRight: '-0px' }}>
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex scrollbar-hide"
          style={{ overflowX: 'auto', scrollSnapType: 'x mandatory', scrollBehavior: 'smooth' }}
        >
          {offers.map((offer, i) => (
            <div
              key={offer.offer_id}
              style={{
                flexShrink: 0,
                width: '100%',
                scrollSnapAlign: 'start',
                paddingLeft: '1rem',
                paddingRight: '1rem',
                paddingBottom: '0.5rem',
              }}
            >
              <OfferCard offer={offer} index={i} fullWidth />
            </div>
          ))}
        </div>
      </div>

      {offers.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3 pb-1">
          {offers.map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === activeIndex ? 16 : 5,
                height: 5,
                background: i === activeIndex ? '#5B8A3C' : '#D4C5A9',
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

// ── Inner content — runs under the page's NextIntlClientProvider ────────────
function OfferPageInner({ booking, offerTemplates }: { booking: Booking; offerTemplates: OfferTemplate[] }) {
  const t = useTranslations('offer')
  const tCategory = useTranslations('offer.category')

  const [offers, setOffers] = useState<GeneratedOffer[]>([])
  const [loading, setLoading] = useState(true)
  const channel = detectChannel(booking.phone)

  useEffect(() => {
    localStorage.setItem('gappy-current-booking', JSON.stringify(booking))
  }, [booking])

  useEffect(() => {
    async function fetchOffers() {
      const applicableOffers = offerTemplates.filter(
        (o) => o.applicable_to.includes('all') || o.applicable_to.includes(booking.room_type)
      )
      try {
        const res = await fetch('/api/generate-offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking, offers: applicableOffers }),
        })
        const data = await res.json()
        setOffers(data.offers ?? [])
      } catch {
        setOffers([])
      } finally {
        setLoading(false)
      }
    }
    fetchOffers()
  }, [booking, offerTemplates])

  const byCategory = CATEGORY_ORDER.reduce<Record<string, GeneratedOffer[]>>((acc, cat) => {
    acc[cat] = offers.filter((o) => o.category === cat)
    return acc
  }, {})

  const bundleOffers = offers.filter((o) => o.category === 'bundle')
  const hasAny = CATEGORY_ORDER.some((c) => (byCategory[c]?.length ?? 0) > 0)
  const sectionBgs = ['#F8F6F0', '#F0F4EC']
  let bgIndex = 0

  return (
    <div className="min-h-screen" style={{ background: '#F8F6F0' }}>
      <div className="bg-white px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid #F0EBE0' }}>
        <a href="/" className="text-xs transition-colors" style={{ color: '#A8C97F', letterSpacing: '0.05em' }}>
          {t('back')}
        </a>
        <span style={{ color: '#D4C5A9' }}>|</span>
        {/* Brand wordmark — untranslated per ADR §3 DD-3 */}
        <span className="text-xs font-medium" style={{ color: '#5B8A3C', letterSpacing: '0.08em' }}>▶ Gappy Stay</span>
      </div>

      <WelcomeBanner booking={booking} channel={channel} />

      <div className="px-4 py-6 pb-32 max-w-lg mx-auto space-y-4">

        {loading && (
          <>
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px skeleton" />
                <div className="w-24 h-3 skeleton" />
                <div className="flex-1 h-px skeleton" />
              </div>
              <div className="h-64 skeleton" />
            </section>
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px skeleton" />
                <div className="w-20 h-3 skeleton" />
                <div className="flex-1 h-px skeleton" />
              </div>
              <div className="h-40 skeleton" />
            </section>
          </>
        )}

        {!loading && hasAny && (
          <p
            className="text-center text-xs fade-in-up"
            style={{ color: '#7A8C70', letterSpacing: '0.06em', paddingTop: '0.5rem' }}
          >
            {t('section.intro')}
          </p>
        )}

        {!loading && hasAny && CATEGORY_ORDER.map((cat) => {
          const catOffers = byCategory[cat] ?? []
          if (catOffers.length === 0) return null
          const bg = sectionBgs[bgIndex++ % 2]
          return (
            <CategorySection
              key={cat}
              title={tCategory(cat satisfies CategoryKey)}
              offers={catOffers}
              bg={bg}
            />
          )
        })}

        {!loading && bundleOffers.length > 0 && (
          <section style={{ background: '#F0F4EC', borderRadius: 12, padding: '1rem' }}>
            <Divider title={tCategory('bundle')} />
            <div className="space-y-3">
              {bundleOffers.map((offer) => (
                <BundleCard key={offer.offer_id} offer={offer} />
              ))}
            </div>
          </section>
        )}

        {!loading && !hasAny && bundleOffers.length === 0 && (
          <div
            className="text-center py-16 text-sm"
            style={{ color: '#bbb', letterSpacing: '0.05em' }}
          >
            {t('section.empty')}
          </div>
        )}
      </div>

      <CartDrawer />
    </div>
  )
}

// ── Outer wrapper — receives the page-resolved locale and re-rewraps the
//    NextIntlClientProvider so the booking.language final-fallback applies
//    to the entire client subtree (per ADR §3 DD-6).
type Props = {
  booking: Booking
  offerTemplates: OfferTemplate[]
  locale: SupportedLocale
  messages: Record<string, unknown>
}

export default function OfferPageClient({ booking, offerTemplates, locale, messages }: Props) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <CartProvider>
        <OfferPageInner booking={booking} offerTemplates={offerTemplates} />
      </CartProvider>
    </NextIntlClientProvider>
  )
}
