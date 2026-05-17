import { Booking, MessagingChannel } from '@/types'
import { useFormatter, useTranslations } from 'next-intl'

const CHANNEL_ICON: Record<MessagingChannel, string> = {
  LINE:     '💬',
  WhatsApp: '📱',
  SMS:      '✉️',
  Email:    '📧',
}

/* ── Bamboo SVG ─────────────────────────────────────── */
function Bamboo() {
  return (
    <svg
      width="56"
      height="130"
      viewBox="0 0 56 130"
      fill="none"
      aria-hidden="true"
      style={{ position: 'absolute', top: 0, left: 12, opacity: 0.9 }}
    >
      <line x1="8"  y1="0"  x2="8"  y2="130" stroke="rgba(255,255,255,0.28)" strokeWidth="4" strokeLinecap="round" />
      <line x1="4"  y1="32" x2="12" y2="32"  stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" />
      <line x1="4"  y1="72" x2="12" y2="72"  stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" />
      <line x1="4"  y1="108"x2="12" y2="108" stroke="rgba(255,255,255,0.22)" strokeWidth="2" strokeLinecap="round" />
      <line x1="24" y1="8"  x2="24" y2="130" stroke="rgba(255,255,255,0.2)"  strokeWidth="3.5" strokeLinecap="round" />
      <line x1="20" y1="48" x2="28" y2="48"  stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="90" x2="28" y2="90"  stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="40" y1="0"  x2="40" y2="115" stroke="rgba(255,255,255,0.14)" strokeWidth="3"   strokeLinecap="round" />
      <line x1="36" y1="40" x2="44" y2="40"  stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="36" y1="82" x2="44" y2="82"  stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* ── Leaf cluster SVG ───────────────────────────────── */
function Leaves() {
  return (
    <svg
      width="100"
      height="100"
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className="leaf-sway-2"
      style={{ position: 'absolute', bottom: 0, right: 8 }}
    >
      <ellipse cx="65" cy="55" rx="22" ry="10" fill="rgba(255,255,255,0.14)"
        transform="rotate(-35 65 55)" />
      <line x1="47" y1="62" x2="83" y2="48" stroke="rgba(255,255,255,0.09)" strokeWidth="0.6" />
      <ellipse cx="78" cy="72" rx="20" ry="9" fill="rgba(255,255,255,0.11)"
        transform="rotate(-62 78 72)" />
      <line x1="61" y1="80" x2="95" y2="64" stroke="rgba(255,255,255,0.07)" strokeWidth="0.6" />
      <ellipse cx="50" cy="78" rx="17" ry="8" fill="rgba(255,255,255,0.09)"
        transform="rotate(-20 50 78)" />
      <ellipse cx="82" cy="44" rx="15" ry="6.5" fill="rgba(255,255,255,0.12)"
        transform="rotate(-80 82 44)" />
      <line x1="71" y1="52" x2="93" y2="36" stroke="rgba(255,255,255,0.07)" strokeWidth="0.5" />
    </svg>
  )
}

const LIGHTS = [
  { top: '12%', left: '22%', size: 90,  cls: 'komorebi'   },
  { top: '50%', left: '55%', size: 70,  cls: 'komorebi-2' },
  { top: '20%', left: '72%', size: 55,  cls: 'komorebi-3' },
  { top: '68%', left: '35%', size: 100, cls: 'komorebi-4' },
  { top: '38%', left: '82%', size: 60,  cls: 'komorebi-5' },
]

/* ── Banner ─────────────────────────────────────────── */
type Props = { booking: Booking; channel: MessagingChannel }

export default function WelcomeBanner({ booking, channel }: Props) {
  const tOffer = useTranslations('offer')
  const tChannel = useTranslations('channel')
  const fmt = useFormatter()
  const firstName = booking.guest_name.split(' ')[0]
  const inDate = new Date(booking.check_in)
  const outDate = new Date(booking.check_out)
  const dateRange =
    `${fmt.dateTime(inDate, { month: 'short', day: 'numeric' })} – ` +
    `${fmt.dateTime(outDate, { month: 'short', day: 'numeric' })}`

  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #3D6B2C 0%, #5B8A3C 100%)',
        padding: '1.75rem 1.5rem 1.5rem',
      }}
    >
      <Bamboo />
      <Leaves />

      {LIGHTS.map((l, i) => (
        <div
          key={i}
          className={l.cls}
          style={{
            position: 'absolute',
            top: l.top,
            left: l.left,
            width:  l.size,
            height: l.size,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(245,230,200,0.18) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
      ))}

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Brand wordmark — untranslated per ADR §3 DD-3 */}
        <p className="text-xs tracking-widest mb-2.5"
          style={{ color: 'rgba(255,255,255,0.55)', letterSpacing: '0.18em' }}>
          GAPPY HOTEL TOKYO
        </p>

        <h1 className="text-2xl font-medium text-white mb-1" style={{ letterSpacing: '0.02em' }}>
          {tOffer('welcome.greeting', { firstName })}
        </h1>

        <div className="mb-3" style={{ width: 40, height: 1, background: 'rgba(255,255,255,0.35)' }} />

        <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm mb-4"
          style={{ color: 'rgba(255,255,255,0.78)' }}>
          <span>{dateRange}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span>{booking.room_type}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>·</span>
          <span>{tOffer('welcome.nights', { count: booking.nights })}</span>
        </div>

        <span
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
          style={{
            background: 'rgba(255,255,255,0.12)',
            color: 'rgba(255,255,255,0.88)',
            border: '1px solid rgba(255,255,255,0.22)',
            borderRadius: 6,
          }}
        >
          {CHANNEL_ICON[channel]} {tChannel(channel)}
        </span>
      </div>
    </div>
  )
}
