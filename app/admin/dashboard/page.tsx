'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, ArcElement, BarElement,
  Tooltip, Filler,
} from 'chart.js'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import type { Booking, CartItem } from '@/types'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  ArcElement, BarElement, Tooltip, Filler,
)

// ── Types ────────────────────────────────────────────────────
type Order = {
  order_id: string; booking_id: string; guest_name: string
  room_type: string; check_in: string; items: CartItem[]
  total: number; created_at: string
}
type OfferTemplate = {
  offer_id: string; category: string
  title: Record<string, string>; description: Record<string, string>
  price: number; original_price: number | null
  unit: string; availability: number; popularity: number
  tags: string[]; applicable_to: string[]; includes?: string[]
}
type Page = 'dashboard' | 'offers' | 'analytics'

// ── Design tokens — match guest app exactly ──────────────────
const SHINRYOKU  = '#5B8A3C'   // main green
const WAKABA     = '#A8C97F'   // light green
const SUMI       = '#2C4A1E'   // dark text
const BG         = '#F8F6F0'   // off-white bg
const CARD       = '#FFFFFF'
const MATCHA     = '#F0F4EC'   // light section bg
const BORDER     = '#F0EBE0'
const BORDER2    = '#D4C5A9'
const GRAY       = '#B0B0A0'
const SUBTEXT    = '#7A8C70'
const RED_SOFT   = '#8B2020'
const GOLD       = '#B8963E'

// Sidebar deep green
const SIDEBAR_BG   = SUMI         // #2C4A1E
const SIDEBAR_ACT  = 'rgba(168,201,127,0.15)'

const ISO_ALIAS: Record<string, string> = {
  UK: 'GB', EN: 'GB', ENG: 'GB',
  HK: 'HK', TW: 'TW',
}

const COUNTRY_NAME: Record<string, string> = {
  AF:'Afghanistan', AL:'Albania', DZ:'Algeria', AR:'Argentina', AU:'Australia',
  AT:'Austria', BE:'Belgium', BR:'Brazil', CA:'Canada', CN:'China',
  HR:'Croatia', CZ:'Czech Republic', DK:'Denmark', EG:'Egypt', FI:'Finland',
  FR:'France', DE:'Germany', GR:'Greece', HK:'Hong Kong', HU:'Hungary',
  IN:'India', ID:'Indonesia', IE:'Ireland', IL:'Israel', IT:'Italy',
  JP:'Japan', KZ:'Kazakhstan', KE:'Kenya', KR:'South Korea', MY:'Malaysia',
  MX:'Mexico', NL:'Netherlands', NZ:'New Zealand', NG:'Nigeria', NO:'Norway',
  PK:'Pakistan', PH:'Philippines', PL:'Poland', PT:'Portugal', RO:'Romania',
  RU:'Russia', SA:'Saudi Arabia', SG:'Singapore', ZA:'South Africa', ES:'Spain',
  SE:'Sweden', CH:'Switzerland', TW:'Taiwan', TH:'Thailand', TR:'Turkey',
  UA:'Ukraine', GB:'United Kingdom', US:'United States', VN:'Vietnam',
}

function countryName(code: string): string {
  return COUNTRY_NAME[code.toUpperCase().slice(0,2)] ?? code.toUpperCase().slice(0,2)
}

function flagUrl(code: string, size: '20x15' | '24x18' | '32x24' = '24x18'): string {
  if (!code || code.length < 2) return ''
  const normalized = ISO_ALIAS[code.toUpperCase()] ?? code.toLowerCase().slice(0, 2)
  return `https://flagcdn.com/${size}/${normalized}.png`
}

// fallback for any remaining emoji references
function countryFlag(code: string): string {
  if (!code || code.length < 2) return '🌐'
  const c = code.toUpperCase().slice(0, 2)
  return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65) +
         String.fromCodePoint(0x1F1E6 + c.charCodeAt(1) - 65)
}

// kept for NAT_COLOR lookups only
const FLAG_MAP: Record<string, string> = {}
const NAT_COLOR: Record<string, string> = {
  US:'#4A7FB5', JP:SHINRYOKU, DE:GOLD, KR:'#8B6DB3', CN:RED_SOFT,
  AU:'#3A8C6E', GB:'#5B7A8A', UK:'#5B7A8A',
}

const OFFER_ICON: Record<string, string> = {
  room:'🛏️', dining:'🍳', wellness:'♨️', transport:'🚗', experience:'🍶', bundle:'✨',
}

function detectChannel(phone: string): 'LINE'|'WhatsApp'|'SMS'|'Email' {
  if (phone.startsWith('+81')) return 'LINE'
  if (phone.startsWith('+1')||phone.startsWith('+44')||phone.startsWith('+61')) return 'WhatsApp'
  if (phone.startsWith('+82')) return 'SMS'
  return 'Email'
}

// ── Helpers ──────────────────────────────────────────────────
function weeklyRevenue(orders: Order[]) {
  const labels: string[] = [], data: number[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const key = d.toISOString().split('T')[0]
    labels.push(`${d.getMonth()+1}/${d.getDate()}`)
    data.push(orders.filter(o => o.created_at?.startsWith(key)).reduce((s,o) => s+o.total, 0))
  }
  return { labels, data }
}

function channelCounts(bookings: Booking[]) {
  const c = { LINE:0, WhatsApp:0, SMS:0, Email:0 }
  bookings.forEach(b => c[detectChannel(b.phone)]++)
  return c
}

function topOffers(orders: Order[]) {
  const m: Record<string, { title:string; count:number; revenue:number }> = {}
  orders.forEach(o => o.items.forEach(item => {
    if (!m[item.offer_id]) m[item.offer_id] = { title: item.title, count:0, revenue:0 }
    m[item.offer_id].count  += item.quantity
    m[item.offer_id].revenue += item.price * item.quantity
  }))
  return Object.values(m).sort((a,b) => b.revenue - a.revenue).slice(0,5)
}

// ── Counter animation hook ────────────────────────────────────
function useCounter(target: number, ms = 1200) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (target === 0) { setV(0); return }
    const t0 = performance.now()
    let raf: number
    function tick(now: number) {
      const p = Math.min((now - t0) / ms, 1)
      setV(Math.round((1 - Math.pow(1-p, 3)) * target))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return v
}

// ── Leaf SVG divider (matches offer page) ────────────────────
function LeafDivider({ title }: { title: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <div style={{ flex:1, borderTop:`1px dashed ${WAKABA}` }} />
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <ellipse cx="7" cy="7" rx="5.5" ry="3" fill={WAKABA} opacity="0.8" transform="rotate(-35 7 7)" />
        <line x1="3" y1="10" x2="11" y2="4" stroke={SHINRYOKU} strokeWidth="0.6" opacity="0.5" />
      </svg>
      <span style={{
        color: SHINRYOKU, fontSize: 10, letterSpacing:'0.16em',
        fontWeight: 600, textTransform:'uppercase', whiteSpace:'nowrap',
      }}>
        {title}
      </span>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <ellipse cx="7" cy="7" rx="5.5" ry="3" fill={WAKABA} opacity="0.8" transform="rotate(-35 7 7)" />
        <line x1="3" y1="10" x2="11" y2="4" stroke={SHINRYOKU} strokeWidth="0.6" opacity="0.5" />
      </svg>
      <div style={{ flex:1, borderTop:`1px dashed ${WAKABA}` }} />
    </div>
  )
}

// ── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, pre='', suf='', subtext, highlight=false }: {
  label:string; value:number; pre?:string; suf?:string; subtext?:string; highlight?:boolean
}) {
  const c = useCounter(value)
  return (
    <div style={{
      background: CARD, borderRadius:12,
      border: `1px solid ${BORDER}`,
      borderLeft: `3px solid ${highlight ? SHINRYOKU : WAKABA}`,
      padding:'18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ fontSize:10, fontWeight:500, color:WAKABA, letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:10 }}>
        {label}
      </div>
      <div style={{ fontSize:28, fontWeight:600, color: highlight ? SHINRYOKU : SUMI, letterSpacing:'-0.5px', lineHeight:1, marginBottom:6 }}>
        {pre}{c.toLocaleString()}{suf}
      </div>
      {subtext && (
        <div style={{ fontSize:11, color:GRAY, letterSpacing:'0.04em' }}>{subtext}</div>
      )}
    </div>
  )
}

// ── Section card wrapper ──────────────────────────────────────
function SectionCard({ children, style }: { children:React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: CARD, borderRadius:12,
      border: `1px solid ${BORDER}`,
      padding:'20px 22px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Channel badge ─────────────────────────────────────────────
function ChannelBadge({ ch }: { ch: string }) {
  const map: Record<string, [string,string]> = {
    LINE:     ['rgba(91,138,60,0.12)', SHINRYOKU],
    WhatsApp: ['rgba(91,138,60,0.08)', SHINRYOKU],
    SMS:      ['rgba(139,109,179,0.12)', '#8B6DB3'],
    Email:    ['rgba(74,127,181,0.12)', '#4A7FB5'],
  }
  const [bg, color] = map[ch] || map.Email
  return (
    <span style={{ fontSize:10, fontWeight:500, padding:'3px 8px', borderRadius:5, background:bg, color, display:'inline-block', letterSpacing:'0.04em' }}>
      {ch}
    </span>
  )
}

// ── Sidebar ───────────────────────────────────────────────────
function Sidebar({ active, onNav, offerCount }: { active:Page; onNav:(p:Page)=>void; offerCount:number }) {
  const items: { id:Page; label:string; icon:React.ReactNode; badge?:number }[] = [
    { id:'dashboard', label:'Dashboard', icon:
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg> },
    { id:'offers', label:'Offers', badge:offerCount, icon:
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/>
      </svg> },
    { id:'analytics', label:'Analytics', icon:
      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg> },
  ]
  return (
    <aside style={{
      position:'fixed', top:0, left:0, width:240, height:'100vh',
      background: SIDEBAR_BG,
      display:'flex', flexDirection:'column', zIndex:100,
    }}>
      {/* Logo */}
      <div style={{
        padding:'22px 24px', borderBottom:`1px solid rgba(255,255,255,0.08)`,
        display:'flex', alignItems:'center', gap:10,
      }}>
        <span style={{
          fontWeight:600, fontSize:15, color:'#fff', letterSpacing:'0.06em',
        }}>▶ Gappy Stay</span>
        <span style={{
          fontSize:9, fontWeight:500, color:SHINRYOKU,
          background:'rgba(91,138,60,0.2)',
          border:`1px solid rgba(91,138,60,0.4)`,
          padding:'2px 6px', borderRadius:4, letterSpacing:'0.5px',
        }}>ADMIN</span>
      </div>

      {/* Hotel pill */}
      <div style={{ margin:'14px 16px 4px', padding:'10px 14px', background:'rgba(255,255,255,0.06)', border:`1px solid rgba(255,255,255,0.08)`, borderRadius:10 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,0.85)' }}>Gappy Hotel Tokyo</div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:2, letterSpacing:'0.06em' }}>Hotel Management</div>
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'8px 12px', overflowY:'auto' }}>
        <div style={{ fontSize:9, fontWeight:500, color:'rgba(255,255,255,0.25)', letterSpacing:'1.2px', textTransform:'uppercase', padding:'10px 8px 6px' }}>Main</div>
        {items.map(item => {
          const on = active === item.id
          return (
            <button key={item.id} onClick={() => onNav(item.id)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px', borderRadius:8, cursor:'pointer',
                color: on ? WAKABA : 'rgba(255,255,255,0.5)',
                fontSize:13, marginBottom:2,
                width:'100%', textAlign:'left',
                background: on ? SIDEBAR_ACT : 'transparent',
                borderLeft: on ? `2px solid ${WAKABA}` : '2px solid transparent',
                fontFamily:'inherit',
                transition:'all 0.15s',
              }}
            >
              <span style={{ opacity: on ? 1 : 0.6, flexShrink:0, color: on ? WAKABA : 'rgba(255,255,255,0.5)' }}>{item.icon}</span>
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span style={{ marginLeft:'auto', fontSize:10, fontWeight:600, background:SHINRYOKU, color:'#fff', padding:'2px 7px', borderRadius:20 }}>{item.badge}</span>
              )}
            </button>
          )
        })}

        <div style={{ fontSize:9, fontWeight:500, color:'rgba(255,255,255,0.25)', letterSpacing:'1.2px', textTransform:'uppercase', padding:'12px 8px 6px', marginTop:4 }}>More</div>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, color:'rgba(255,255,255,0.45)', fontSize:13, textDecoration:'none', marginBottom:2 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/></svg>
          Guest App
        </Link>
        <Link href="/admin/upload" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, color:'rgba(255,255,255,0.45)', fontSize:13, textDecoration:'none' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          Upload CSV
        </Link>
      </nav>

      {/* Footer */}
      <div style={{ padding:'14px 16px', borderTop:`1px solid rgba(255,255,255,0.08)` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{
            width:32, height:32, borderRadius:'50%',
            background: 'linear-gradient(135deg, #A8C97F, #5B8A3C)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:12, fontWeight:600, color:'#fff', flexShrink:0,
          }}>GA</div>
          <div>
            <div style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,0.8)' }}>Gappy Admin</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', letterSpacing:'0.04em' }}>Hotel Manager</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── TopBar ────────────────────────────────────────────────────
function TopBar({ title, onRefresh }: { title:string; onRefresh:()=>void }) {
  const now = new Date()
  const d = now.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' })
  return (
    <header style={{
      background: CARD, borderBottom:`1px solid ${BORDER}`,
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 28px', height:60, position:'sticky', top:0, zIndex:50,
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:18, fontWeight:600, color:SUMI, letterSpacing:'0.01em' }}>{title}</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onRefresh} style={{
          fontSize:11, color:SUBTEXT, padding:'5px 12px',
          background:MATCHA, border:`1px solid ${BORDER}`,
          borderRadius:7, cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.04em',
        }}>↻ Refresh</button>
        <div style={{ fontSize:11, color:SUBTEXT, padding:'5px 12px', background:MATCHA, border:`1px solid ${BORDER}`, borderRadius:7, letterSpacing:'0.04em' }}>{d}</div>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:SHINRYOKU, padding:'5px 12px', background:'rgba(91,138,60,0.08)', border:`1px solid rgba(91,138,60,0.2)`, borderRadius:7, letterSpacing:'0.06em' }}>
          <span style={{ width:6, height:6, background:SHINRYOKU, borderRadius:'50%', display:'inline-block', animation:'live-pulse 2s infinite' }} />
          Live
        </div>
      </div>
    </header>
  )
}

// ── Dashboard tab ─────────────────────────────────────────────
function DashboardTab({ orders, bookings, runtimeIds, offerTemplates, onBookingDeleted }: { orders:Order[]; bookings:Booking[]; runtimeIds:Set<string>; offerTemplates:OfferTemplate[]; onBookingDeleted:()=>void }) {
  const [guestSearch,     setGuestSearch]     = useState('')
  const [natFilter,       setNatFilter]       = useState('')
  const [natDropdownOpen, setNatDropdownOpen] = useState(false)
  const [natSearch,       setNatSearch]       = useState('')
  const natDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (natDropdownRef.current && !natDropdownRef.current.contains(e.target as Node)) {
        setNatDropdownOpen(false); setNatSearch('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleDeleteBooking(bookingId: string, e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await fetch(`/api/admin/bookings?id=${encodeURIComponent(bookingId)}`, { method: 'DELETE' })
    onBookingDeleted()
  }

  const uniqueNats = useMemo(() => {
    const seen = new Set<string>()
    bookings.forEach(b => seen.add(b.nationality.toUpperCase().slice(0,2)))
    return Array.from(seen).sort()
  }, [bookings])

  const natCountMap = useMemo(() => {
    const m: Record<string, number> = {}
    bookings.forEach(b => {
      const k = b.nationality.toUpperCase().slice(0,2)
      m[k] = (m[k] || 0) + 1
    })
    return m
  }, [bookings])

  const filteredBookings = useMemo(() => bookings.filter(b => {
    const matchName = b.guest_name.toLowerCase().includes(guestSearch.toLowerCase())
    const matchNat  = natFilter === '' || b.nationality.toUpperCase().slice(0,2) === natFilter
    return matchName && matchNat
  }), [bookings, guestSearch, natFilter])

  const totalRev = orders.reduce((s,o) => s+o.total, 0)
  const cvr = bookings.length > 0 ? Math.round((orders.length / bookings.length) * 100) : 0
  const upcomingCI = bookings.filter(b => new Date(b.check_in) > new Date()).length
  const top = topOffers(orders)
  const { labels: wLabels, data: wData } = useMemo(() => weeklyRevenue(orders), [orders])
  const chCounts = useMemo(() => channelCounts(bookings), [bookings])
  const totalCh = bookings.length || 1
  const hasChannel = Object.values(chCounts).some(v => v > 0)

  const revenueChartData = useMemo(() => ({
    labels: wLabels,
    datasets: [{
      label: 'Revenue',
      data: wData,
      borderColor: SHINRYOKU,
      backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D } }) => {
        const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 180)
        g.addColorStop(0, 'rgba(91,138,60,0.18)')
        g.addColorStop(1, 'rgba(91,138,60,0)')
        return g
      },
      borderWidth: 2,
      pointBackgroundColor: SHINRYOKU,
      pointRadius: 3, pointHoverRadius: 5,
      tension: 0.4, fill: true,
    }],
  }), [wLabels, wData])

  const revenueChartOpts = useMemo(() => ({
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display:false } },
    scales:{
      x:{ grid:{ color:'rgba(0,0,0,0.04)', drawBorder:false }, ticks:{ color:'#B0B0A0', font:{ size:11 } } },
      y:{ grid:{ color:'rgba(0,0,0,0.04)', drawBorder:false }, beginAtZero:true,
        ticks:{ color:'#B0B0A0', font:{ size:11 }, callback:(v:number|string) => '¥'+Math.round(Number(v)/1000)+'k' } },
    },
  }), [])

  const cValues = [chCounts.LINE, chCounts.WhatsApp, chCounts.Email, chCounts.SMS]
  const doughnutData = useMemo(() => ({
    labels:['LINE','WhatsApp','Email','SMS'],
    datasets:[{
      data: hasChannel ? cValues : [35,28,22,15],
      backgroundColor:[SHINRYOKU, WAKABA, '#A8B8C8', BORDER2],
      borderWidth:0, hoverOffset:4,
    }],
  }), [chCounts, hasChannel])

  const doughnutOpts = useMemo(() => ({
    responsive:true, maintainAspectRatio:false, cutout:'72%',
    plugins:{
      legend:{ display:false },
      tooltip:{ callbacks:{ label:(c:{ label:string; raw:unknown }) => ` ${c.label}: ${c.raw}${hasChannel?'':'%'}` } },
    },
  }), [hasChannel])

  const chPcts = hasChannel
    ? { LINE:Math.round(chCounts.LINE/totalCh*100), WhatsApp:Math.round(chCounts.WhatsApp/totalCh*100), Email:Math.round(chCounts.Email/totalCh*100), SMS:Math.round(chCounts.SMS/totalCh*100) }
    : { LINE:35, WhatsApp:28, Email:22, SMS:15 }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Guest Personalization Grid */}
      <SectionCard>
        <LeafDivider title="Guest Personalization Preview" />

        {/* Toolbar: search + country filter + link */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>

          {/* Left group: search + country filter side by side */}
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Name search */}
            <div style={{ position:'relative' }}>
              <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:GRAY, pointerEvents:'none' }}
                width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={guestSearch}
                onChange={e => setGuestSearch(e.target.value)}
                placeholder="Search guest name…"
                style={{
                  background:CARD, border:`1px solid ${BORDER}`, borderRadius:8,
                  padding:'8px 12px 8px 32px', color:SUMI, fontFamily:'inherit',
                  fontSize:13, width:200, outline:'none',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
                }}
              />
            </div>

            {/* Nationality dropdown filter */}
            <div ref={natDropdownRef} style={{ position:'relative' }}>
            <button
              onClick={() => setNatDropdownOpen(o => !o)}
              style={{
                display:'flex', alignItems:'center', gap:7,
                padding:'8px 12px', borderRadius:8, fontSize:13, fontWeight:500,
                fontFamily:'inherit', cursor:'pointer', letterSpacing:'0.02em',
                background: natFilter ? `${NAT_COLOR[natFilter] || SHINRYOKU}12` : CARD,
                color:      natFilter ? (NAT_COLOR[natFilter] || SHINRYOKU)       : SUBTEXT,
                border:     natFilter ? `1px solid ${NAT_COLOR[natFilter] || SHINRYOKU}40` : `1px solid ${BORDER}`,
                boxShadow:'0 1px 3px rgba(0,0,0,0.04)',
                transition:'all 0.15s', minWidth:148,
                justifyContent:'space-between',
              }}>
              <span style={{ display:'flex', alignItems:'center', gap:7 }}>
                {natFilter ? (
                  <>
                    <img src={flagUrl(natFilter, '20x15')} alt={natFilter} width={16} height={12} style={{ borderRadius:2 }} />
                    {countryName(natFilter)}
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ opacity:0.5 }}>
                      <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
                    </svg>
                    All Countries
                  </>
                )}
              </span>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                style={{ opacity:0.5, transform: natDropdownOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s' }}>
                <path d="M6 9l6 6 6-6"/>
              </svg>
            </button>

            {natDropdownOpen && (
              <div style={{
                position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:200,
                background:CARD, border:`1px solid ${BORDER}`,
                borderRadius:10, boxShadow:'0 6px 24px rgba(44,74,30,0.12)',
                minWidth:200, overflow:'hidden',
                animation:'fadeUp 0.15s ease',
              }}>
                {/* Search inside dropdown */}
                <div style={{ padding:'10px 10px 8px', borderBottom:`1px solid ${BORDER}` }}>
                  <div style={{ position:'relative' }}>
                    <svg style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:GRAY, pointerEvents:'none' }}
                      width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                    </svg>
                    <input
                      autoFocus
                      value={natSearch}
                      onChange={e => setNatSearch(e.target.value)}
                      placeholder="Search country…"
                      style={{
                        width:'100%', background:BG, border:`1px solid ${BORDER}`,
                        borderRadius:7, padding:'7px 10px 7px 28px',
                        color:SUMI, fontFamily:'inherit', fontSize:12, outline:'none',
                        boxSizing:'border-box',
                      }}
                    />
                  </div>
                </div>
                {/* All option — only show when not searching */}
                {!natSearch && (
                  <button
                    onClick={() => { setNatFilter(''); setNatDropdownOpen(false); setNatSearch('') }}
                    style={{
                      width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                      padding:'10px 14px', fontSize:12, fontFamily:'inherit', cursor:'pointer',
                      background: natFilter==='' ? MATCHA : 'transparent',
                      color: natFilter==='' ? SHINRYOKU : SUMI,
                      border:'none', borderBottom:`1px solid ${BORDER}`,
                      fontWeight: natFilter==='' ? 600 : 400,
                    }}>
                    <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ opacity:0.5 }}>
                        <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
                      </svg>
                      All Countries
                    </span>
                    <span style={{ fontSize:11, color:GRAY }}>{bookings.length}</span>
                  </button>
                )}
                {/* Country rows */}
                <div style={{ maxHeight:220, overflowY:'auto' }}>
                  {uniqueNats.filter(n => {
                    const q = natSearch.toLowerCase()
                    return n.toLowerCase().includes(q) || countryName(n).toLowerCase().includes(q)
                  }).map(nat => {
                    const active = natFilter === nat
                    const color  = NAT_COLOR[nat] || SHINRYOKU
                    return (
                      <button key={nat}
                        onClick={() => { setNatFilter(active ? '' : nat); setNatDropdownOpen(false); setNatSearch('') }}
                        style={{
                          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                          padding:'9px 14px', fontSize:12, fontFamily:'inherit', cursor:'pointer',
                          background: active ? `${color}10` : 'transparent',
                          color: active ? color : SUMI,
                          border:'none', borderBottom:`1px solid ${BORDER}`,
                          fontWeight: active ? 600 : 400,
                          transition:'background 0.12s',
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = BG }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                        <span style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <img src={flagUrl(nat, '20x15')} alt={nat} width={18} height={13} style={{ borderRadius:2, flexShrink:0 }} />
                          <span style={{ display:'flex', flexDirection:'column', alignItems:'flex-start', gap:1 }}>
                            <span style={{ fontSize:12, color: active ? color : SUMI }}>{countryName(nat)}</span>
                            <span style={{ fontSize:10, color:GRAY, letterSpacing:'0.04em' }}>{nat}</span>
                          </span>
                        </span>
                        <span style={{ fontSize:11, color: active ? color : GRAY, background: active ? `${color}15` : MATCHA, padding:'1px 7px', borderRadius:10, fontWeight:500 }}>
                          {natCountMap[nat] || 0}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            </div> {/* end nationality dropdown */}
          </div> {/* end left group */}

          <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            {(guestSearch || natFilter) && (
              <span style={{ fontSize:11, color:SUBTEXT }}>
                {filteredBookings.length} of {bookings.length}
              </span>
            )}
            <Link href="/" style={{
              background:SHINRYOKU, color:'#fff', borderRadius:8, padding:'8px 14px',
              fontSize:12, fontWeight:500, textDecoration:'none',
              display:'inline-flex', alignItems:'center', gap:6, letterSpacing:'0.04em',
            }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><path d="M15 3h6v6M10 14L21 3"/></svg>
              Open Guest App
            </Link>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
          {filteredBookings.length === 0 ? (
            <div style={{ gridColumn:'1/-1', textAlign:'center', padding:'32px 0', color:GRAY, fontSize:13 }}>
              No guests match your search
            </div>
          ) : null}
          {filteredBookings.map(b => {
            const color = NAT_COLOR[b.nationality] || SHINRYOKU
            const flag = countryFlag(b.nationality)
            const ch = detectChannel(b.phone)
            return (
              <Link key={b.booking_id} href={`/offer/${b.booking_id}`} target="_blank"
                style={{
                  background:BG, border:`1px solid ${BORDER}`,
                  borderRadius:10, padding:'14px 14px 12px',
                  display:'block', textDecoration:'none', color:'inherit',
                  position:'relative', overflow:'hidden',
                  borderLeft:`3px solid ${color}`,
                  transition:'all 0.18s',
                  boxShadow:'0 1px 3px rgba(0,0,0,0.03)',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderLeftColor = color; (e.currentTarget as HTMLElement).style.boxShadow = '0 3px 10px rgba(91,138,60,0.1)'; (e.currentTarget as HTMLElement).style.background = CARD }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.03)'; (e.currentTarget as HTMLElement).style.background = BG }}
              >
                <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:9 }}>
                  {/* Flag + code badge */}
                  <div style={{ width:40, background:CARD, border:`1px solid ${BORDER}`, borderRadius:8, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'5px 3px', gap:3, flexShrink:0 }}>
                    <img src={flagUrl(b.nationality, '24x18')} alt={`${b.nationality} flag`} width={24} height={18} style={{ borderRadius:2, display:'block' }} />
                    <span style={{ fontSize:8, fontWeight:700, color:SUBTEXT, letterSpacing:'0.06em', lineHeight:1 }}>{b.nationality.toUpperCase().slice(0,2)}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:9, color:WAKABA, fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:1 }}>{b.booking_id}</div>
                    <div style={{ fontSize:13, fontWeight:500, color:SUMI, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.guest_name}</div>
                  </div>
                  {runtimeIds.has(b.booking_id) && (
                    <button
                      onClick={e => handleDeleteBooking(b.booking_id, e)}
                      title="Remove guest"
                      style={{
                        width:22, height:22, borderRadius:5, border:`1px solid rgba(139,32,32,0.2)`,
                        background:'rgba(139,32,32,0.06)', color:RED_SOFT, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:12, flexShrink:0, lineHeight:1,
                        transition:'all 0.15s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,32,32,0.14)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(139,32,32,0.06)' }}
                    >×</button>
                  )}
                </div>
                <div style={{ fontSize:11, color:SUBTEXT, marginBottom:8 }}>{b.room_type} · {b.nights} night{b.nights!==1?'s':''}</div>
                <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                  {b.tags.slice(0,2).map(t => (
                    <span key={t} style={{ fontSize:9, padding:'2px 7px', borderRadius:4, background:MATCHA, color:SUBTEXT, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:500 }}>{t}</span>
                  ))}
                  <span style={{ fontSize:9, padding:'2px 7px', borderRadius:4, background:'rgba(91,138,60,0.1)', color:SHINRYOKU, textTransform:'uppercase', letterSpacing:'0.08em', fontWeight:500 }}>{ch}</span>
                </div>
                <div style={{ fontSize:10, color:WAKABA, letterSpacing:'0.06em', paddingTop:8, borderTop:`1px dashed ${BORDER2}` }}>Open offer page ↗</div>
              </Link>
            )
          })}
        </div>
      </SectionCard>

      {/* KPI Cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        <KpiCard label="Total Upsell Revenue" value={totalRev} pre="¥" highlight subtext="all completed orders" />
        <KpiCard label="Conversion Rate"       value={cvr}      suf="%" subtext={`${orders.length} / ${bookings.length} guests`} />
        <KpiCard label="Active Offers"         value={offerTemplates.length} subtext="in catalogue" />
        <KpiCard label="Upcoming Check-ins"    value={upcomingCI} subtext="future bookings" />
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:14 }}>
        <SectionCard>
          <LeafDivider title="Weekly Upsell Revenue" />
          <div style={{ height:190 }}>
            <Line data={revenueChartData} options={revenueChartOpts as Parameters<typeof Line>[0]['options']} />
          </div>
        </SectionCard>

        <SectionCard>
          <LeafDivider title="Channel Split" />
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 14px', marginBottom:12 }}>
            {(['LINE','WhatsApp','Email','SMS'] as const).map((ch,i) => {
              const colors = [SHINRYOKU, WAKABA, '#A8B8C8', BORDER2]
              return (
                <span key={ch} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:SUBTEXT }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:colors[i], display:'inline-block' }} />
                  {ch} {chPcts[ch]}%
                </span>
              )
            })}
          </div>
          <div style={{ height:150 }}>
            <Doughnut data={doughnutData} options={doughnutOpts as Parameters<typeof Doughnut>[0]['options']} />
          </div>
        </SectionCard>
      </div>

      {/* Orders + Top Offers */}
      <div style={{ display:'grid', gridTemplateColumns:'1.3fr 0.7fr', gap:14 }}>
        <SectionCard>
          <LeafDivider title="Recent Orders" />
          {orders.length === 0 ? (
            <div style={{ textAlign:'center', padding:'32px 0', color:GRAY, fontSize:13 }}>
              No orders yet — guests haven&apos;t completed checkout
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${BORDER}` }}>
                  {['Guest','Channel','Items','Amount'].map((h,i) => (
                    <th key={h} style={{ fontSize:9, fontWeight:500, color:WAKABA, textTransform:'uppercase', letterSpacing:'0.14em', textAlign: i>=2?'right':'left', padding:'0 0 10px', fontFamily:'inherit' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.slice().reverse().slice(0,8).map(o => {
                  const bk = bookings.find(b => b.booking_id === o.booking_id)
                  const ch = bk ? detectChannel(bk.phone) : 'Email'
                  const color = bk ? (NAT_COLOR[bk.nationality] || SHINRYOKU) : SHINRYOKU
                  const initials = o.guest_name.split(' ').map((n:string) => n[0]).join('').slice(0,2)
                  return (
                    <tr key={o.order_id} style={{ borderBottom:`1px solid ${BORDER}` }}>
                      <td style={{ padding:'10px 0' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
                          <div style={{ width:28, height:28, borderRadius:'50%', background:`${color}18`, border:`1px solid ${color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:600, color, flexShrink:0 }}>{initials}</div>
                          <div>
                            <div style={{ fontSize:13, fontWeight:500, color:SUMI }}>{o.guest_name}</div>
                            <div style={{ fontSize:10, color:GRAY }}>{o.room_type}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding:'10px 0 10px 8px' }}><ChannelBadge ch={ch} /></td>
                      <td style={{ padding:'10px 0', textAlign:'right' }}>
                        <span style={{ fontSize:11, color:SUBTEXT, background:MATCHA, border:`1px solid ${BORDER}`, padding:'2px 8px', borderRadius:4 }}>
                          {o.items.length}
                        </span>
                      </td>
                      <td style={{ padding:'10px 0', textAlign:'right', fontSize:15, fontWeight:600, color:SHINRYOKU }}>
                        ¥{o.total.toLocaleString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </SectionCard>

        <SectionCard>
          <LeafDivider title="Top Offers" />
          {top.length === 0 ? (
            <div style={{ textAlign:'center', padding:'28px 0', color:GRAY, fontSize:13 }}>
              No orders yet
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {top.map((o, i) => {
                const maxRev = top[0].revenue || 1
                const pct = Math.round(o.revenue / maxRev * 100)
                return (
                  <div key={o.title} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderBottom: i<top.length-1?`1px solid ${BORDER}`:'none' }}>
                    <span style={{ fontSize:14, fontWeight:600, color:BORDER2, width:18, flexShrink:0, textAlign:'center' }}>{i+1}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:SUMI, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.title}</div>
                      <div style={{ marginTop:5, height:4, background:BORDER, borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', borderRadius:2, background:WAKABA, width:`${pct}%`, transition:'width 1s ease' }} />
                      </div>
                    </div>
                    <div style={{ fontSize:12, fontWeight:600, color:SHINRYOKU, textAlign:'right', flexShrink:0, width:60 }}>
                      ¥{o.revenue.toLocaleString()}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  )
}

// ── Offers tab ────────────────────────────────────────────────
function OffersTab({ offerTemplates }: { offerTemplates:OfferTemplate[] }) {
  const [query, setQuery] = useState('')
  const [editOffer, setEditOffer] = useState<OfferTemplate|null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [toggleState, setToggleState] = useState<Record<string,boolean>>(() =>
    Object.fromEntries(offerTemplates.map(o => [o.offer_id, true]))
  )
  const [toast, setToast] = useState('')

  // Load persisted paused state on mount
  useEffect(() => {
    fetch('/api/admin/offers')
      .then(r => r.json())
      .then(({ pausedIds }: { pausedIds: string[] }) => {
        if (pausedIds?.length) {
          setToggleState(prev => {
            const next = { ...prev }
            pausedIds.forEach(id => { next[id] = false })
            return next
          })
        }
      })
      .catch(() => {})
  }, [])

  async function handleToggle(offerId: string, currentOn: boolean) {
    const newActive = !currentOn
    setToggleState(s => ({ ...s, [offerId]: newActive }))
    await fetch('/api/admin/offers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offer_id: offerId, active: newActive }),
    }).catch(() => {})
  }

  function showToast(msg:string) { setToast(msg); setTimeout(() => setToast(''), 3000) }

  const filtered = offerTemplates.filter(o =>
    o.title.en?.toLowerCase().includes(query.toLowerCase()) ||
    o.description.en?.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div style={{ position:'relative' }}>
          <svg style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:GRAY, pointerEvents:'none' }} width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search offers..."
            style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:8, padding:'8px 12px 8px 32px', color:SUMI, fontFamily:'inherit', fontSize:13, width:220, outline:'none', boxShadow:'0 1px 3px rgba(0,0,0,0.04)' }} />
        </div>
        <button onClick={() => { setEditOffer(null); setPanelOpen(true) }}
          style={{ background:SHINRYOKU, color:'#fff', border:'none', borderRadius:8, padding:'9px 16px', fontFamily:'inherit', fontSize:13, fontWeight:500, cursor:'pointer', display:'flex', alignItems:'center', gap:6, letterSpacing:'0.03em' }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M12 5v14m-7-7h14"/></svg>
          New Offer
        </button>
      </div>

      {/* Grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {filtered.map(o => {
          const isOn = toggleState[o.offer_id] ?? true
          return (
            <div key={o.offer_id} style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`3px solid ${isOn?SHINRYOKU:BORDER2}`, borderRadius:12, padding:18, boxShadow:'0 1px 4px rgba(0,0,0,0.04)', transition:'all 0.2s' }}>
              {/* Header */}
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                <div style={{ width:38, height:38, borderRadius:10, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, background:MATCHA, flexShrink:0 }}>
                  {OFFER_ICON[o.category]||'✨'}
                </div>
                {/* Toggle */}
                <div onClick={() => { handleToggle(o.offer_id, isOn); showToast(`"${o.title.en}" ${isOn?'paused':'activated'}`) }}
                  style={{ position:'relative', width:40, height:22, flexShrink:0, cursor:'pointer' }}>
                  <div style={{ position:'absolute', inset:0, background:isOn?'rgba(91,138,60,0.15)':'rgba(0,0,0,0.06)', borderRadius:11, border:`1px solid ${isOn?'rgba(91,138,60,0.3)':BORDER}`, transition:'all 0.25s' }} />
                  <div style={{ position:'absolute', width:14, height:14, background:isOn?SHINRYOKU:BORDER2, borderRadius:'50%', top:3, left:isOn?22:3, transition:'all 0.25s', boxShadow:'0 1px 3px rgba(0,0,0,0.15)' }} />
                </div>
              </div>
              <div style={{ fontSize:14, fontWeight:600, color:SUMI, marginBottom:4 }}>{o.title.en}</div>
              <div style={{ fontSize:11, color:SUBTEXT, marginBottom:14, lineHeight:1.55 }}>{o.description.en}</div>
              {/* Stats */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6, marginBottom:14 }}>
                {[
                  { label:'Price', value:`¥${o.price.toLocaleString()}`, color:SHINRYOKU },
                  { label:'Stock', value:`${o.availability}`, color:o.availability<=3?RED_SOFT:SUMI },
                  { label:'Pop',   value:`${o.popularity}%`, color:o.popularity>=70?SHINRYOKU:o.popularity>=40?GOLD:GRAY },
                ].map(s => (
                  <div key={s.label} style={{ background:MATCHA, borderRadius:7, padding:'7px 9px', border:`1px solid ${BORDER}` }}>
                    <div style={{ fontSize:9, fontWeight:500, color:GRAY, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:2 }}>{s.label}</div>
                    <div style={{ fontSize:14, fontWeight:600, color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>
              {/* Actions */}
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => { setEditOffer(o); setPanelOpen(true) }}
                  style={{ flex:1, background:'transparent', border:`1px solid ${BORDER}`, borderRadius:7, padding:'6px 0', color:SUBTEXT, fontFamily:'inherit', fontSize:11, cursor:'pointer', transition:'all 0.15s' }}
                  onMouseEnter={e=>(e.currentTarget.style.borderColor=SHINRYOKU)} onMouseLeave={e=>(e.currentTarget.style.borderColor=BORDER)}>
                  Edit
                </button>
                <button style={{ flex:0.6, background:'transparent', border:`1px solid ${BORDER}`, borderRadius:7, padding:'6px 0', color:SUBTEXT, fontFamily:'inherit', fontSize:11, cursor:'pointer' }}>Clone</button>
                <button style={{ flex:0.6, background:'transparent', border:`1px solid rgba(139,32,32,0.2)`, borderRadius:7, padding:'6px 0', color:RED_SOFT, fontFamily:'inherit', fontSize:11, cursor:'pointer' }}>Del</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Edit Panel */}
      {panelOpen && (
        <div style={{ position:'fixed', inset:0, background:'rgba(44,74,30,0.35)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'flex-end' }}
          onClick={e => { if (e.target===e.currentTarget) setPanelOpen(false) }}>
          <div style={{ width:400, height:'100vh', background:CARD, borderLeft:`1px solid ${BORDER}`, padding:28, overflowY:'auto', boxShadow:'-4px 0 24px rgba(44,74,30,0.12)', animation:'slideIn 0.25s ease' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
              <h2 style={{ fontSize:18, fontWeight:600, color:SUMI, margin:0 }}>{editOffer?'Edit Offer':'New Offer'}</h2>
              <button onClick={() => setPanelOpen(false)}
                style={{ width:30, height:30, borderRadius:7, background:MATCHA, border:`1px solid ${BORDER}`, color:SUBTEXT, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>✕</button>
            </div>
            {[
              { label:'Offer Name (EN)', val:editOffer?.title.en||'', ph:'e.g. Early Check-in' },
              { label:'Offer Name (JA)', val:editOffer?.title.ja||'', ph:'例：アーリーチェックイン' },
            ].map((f,i) => (
              <div key={i} style={{ marginBottom:16 }}>
                <label style={{ fontSize:10, fontWeight:500, color:SHINRYOKU, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:7, display:'block' }}>{f.label}</label>
                <input defaultValue={f.val} placeholder={f.ph}
                  style={{ width:'100%', background:BG, border:`1px solid ${BORDER}`, borderRadius:8, padding:'10px 12px', color:SUMI, fontFamily:'inherit', fontSize:13, outline:'none' }}
                  onFocus={e=>(e.currentTarget.style.borderColor=SHINRYOKU)} onBlur={e=>(e.currentTarget.style.borderColor=BORDER)} />
              </div>
            ))}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
              <div>
                <label style={{ fontSize:10, fontWeight:500, color:SHINRYOKU, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:7, display:'block' }}>Price (¥)</label>
                <input type="number" defaultValue={editOffer?.price||''} placeholder="3500"
                  style={{ width:'100%', background:BG, border:`1px solid ${BORDER}`, borderRadius:8, padding:'10px 12px', color:SUMI, fontFamily:'inherit', fontSize:13, outline:'none' }}
                  onFocus={e=>(e.currentTarget.style.borderColor=SHINRYOKU)} onBlur={e=>(e.currentTarget.style.borderColor=BORDER)} />
              </div>
              <div>
                <label style={{ fontSize:10, fontWeight:500, color:SHINRYOKU, textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:7, display:'block' }}>Availability</label>
                <input type="number" defaultValue={editOffer?.availability||''} placeholder="10"
                  style={{ width:'100%', background:BG, border:`1px solid ${BORDER}`, borderRadius:8, padding:'10px 12px', color:SUMI, fontFamily:'inherit', fontSize:13, outline:'none' }}
                  onFocus={e=>(e.currentTarget.style.borderColor=SHINRYOKU)} onBlur={e=>(e.currentTarget.style.borderColor=BORDER)} />
              </div>
            </div>
            {/* Preview */}
            <div style={{ background:MATCHA, border:`1px solid rgba(91,138,60,0.2)`, borderRadius:12, padding:16, marginTop:8 }}>
              <div style={{ fontSize:10, fontWeight:600, color:SHINRYOKU, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:12 }}>Guest Preview (LINE)</div>
              <div style={{ background:'rgba(91,138,60,0.08)', borderRadius:14, padding:12 }}>
                <div style={{ background:SHINRYOKU, color:'#fff', borderRadius:'12px 12px 12px 4px', padding:'10px 14px', fontSize:12, fontWeight:500, maxWidth:'90%', lineHeight:1.55, marginBottom:8 }}>
                  🏨 田中様、特別なご滞在のご提案です。<br/><br/>
                  {editOffer?.title.ja||'アーリーチェックイン'}を<b>¥{(editOffer?.price||3500).toLocaleString()}</b>でご利用いただけます。残り<b>{editOffer?.availability||3}枠</b>のみ！
                </div>
                <div style={{ fontSize:10, color:GRAY, paddingLeft:4 }}>既読 · 午後7:00</div>
              </div>
            </div>
            <button onClick={() => { setPanelOpen(false); showToast('Offer saved') }}
              style={{ width:'100%', background:SHINRYOKU, color:'#fff', border:'none', borderRadius:9, padding:'13px', fontFamily:'inherit', fontSize:14, fontWeight:500, cursor:'pointer', marginTop:20, letterSpacing:'0.04em' }}>
              Save & Apply
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:'fixed', bottom:24, right:24, background:CARD, border:`1px solid rgba(91,138,60,0.25)`, borderLeft:`3px solid ${SHINRYOKU}`, borderRadius:10, padding:'12px 16px', display:'flex', alignItems:'center', gap:10, zIndex:1000, fontSize:13, color:SUMI, boxShadow:'0 4px 16px rgba(44,74,30,0.12)', animation:'slideUp 0.3s ease' }}>
          <div style={{ width:22, height:22, background:'rgba(91,138,60,0.12)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={SHINRYOKU} strokeWidth="2.5"><path d="M20 6L9 17l-5-5"/></svg>
          </div>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Analytics tab ─────────────────────────────────────────────
function AnalyticsTab({ orders, bookings }: { orders:Order[]; bookings:Booking[] }) {
  const totalB = bookings.length || 1
  const hasNatData = orders.length > 0

  const natMap: Record<string,number> = {}
  orders.forEach(o => {
    const b = bookings.find(bk => bk.booking_id === o.booking_id)
    if (b) natMap[b.nationality] = (natMap[b.nationality]||0) + o.total
  })

  const natData = hasNatData
    ? Object.entries(natMap).map(([n,r]) => ({ nat:n, flag:countryFlag(n), revenue:r, color:NAT_COLOR[n]||SHINRYOKU })).sort((a,b)=>b.revenue-a.revenue).slice(0,6)
    : [
        { nat:'JP', flag:'🇯🇵', revenue:380000, color:SHINRYOKU },
        { nat:'US', flag:'🇺🇸', revenue:290000, color:'#4A7FB5' },
        { nat:'KR', flag:'🇰🇷', revenue:240000, color:'#8B6DB3' },
        { nat:'CN', flag:'🇨🇳', revenue:210000, color:RED_SOFT },
        { nat:'DE', flag:'🇩🇪', revenue:120000, color:GOLD },
      ]
  const maxNat = natData[0]?.revenue || 1

  const funnelData = [
    { label:'Delivered', count: bookings.length,  pct:100, color:'#4A7FB5' },
    { label:'Opened',    count: Math.round(bookings.length*0.72), pct:72, color:'#8B6DB3' },
    { label:'Viewed',    count: Math.round(bookings.length*0.44), pct:44, color:GOLD },
    { label:'Purchased', count: orders.length, pct: bookings.length>0?Math.round(orders.length/bookings.length*100):0, color:SHINRYOKU },
  ]

  const chPerfData = useMemo(() => ({
    labels:['LINE','WhatsApp','Email','SMS'],
    datasets:[
      { label:'Open Rate', data:[76,86,32,48], backgroundColor:`${SHINRYOKU}B3`, borderRadius:5 },
      { label:'CVR',       data:[12,14, 8, 9], backgroundColor:`${WAKABA}B3`,    borderRadius:5 },
    ],
  }), [])

  const chPerfOpts = useMemo(() => ({
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label:(c:{dataset:{label:string};raw:unknown}) => ` ${c.dataset.label}: ${c.raw}%` } } },
    scales:{
      x:{ grid:{display:false}, ticks:{color:GRAY, font:{size:11}}, border:{display:false} },
      y:{ grid:{color:'rgba(0,0,0,0.04)'}, ticks:{color:GRAY, font:{size:11}, callback:(v:number|string) => v+'%'}, border:{display:false} },
    },
  }), [])

  const days  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
  const hours = ['7am','10am','1pm','4pm','7pm','10pm']
  const heatData = [[2,3,4,3,2,5,6],[3,4,5,4,3,6,8],[2,3,4,5,4,5,7],[4,5,6,5,4,7,9],[8,7,6,5,9,10,8],[5,4,3,4,6,7,5]]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <SectionCard>
          <LeafDivider title="Conversion Funnel" />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {funnelData.map(f => (
              <div key={f.label} style={{ display:'flex', alignItems:'center', gap:12 }}>
                <div style={{ fontSize:11, color:SUBTEXT, width:72, flexShrink:0, letterSpacing:'0.04em' }}>{f.label}</div>
                <div style={{ flex:1, height:28, background:MATCHA, borderRadius:6, overflow:'hidden', border:`1px solid ${BORDER}` }}>
                  <div style={{ height:'100%', background:f.color, width:`${f.pct}%`, display:'flex', alignItems:'center', paddingLeft:10, transition:'width 1.2s ease', borderRadius:5 }}>
                    <span style={{ fontSize:11, fontWeight:600, color:'#fff' }}>{f.pct}%</span>
                  </div>
                </div>
                <div style={{ fontSize:13, fontWeight:600, width:36, textAlign:'right', color:SUMI, flexShrink:0 }}>{f.count}</div>
              </div>
            ))}
          </div>
          {!hasNatData && <p style={{ fontSize:10, color:GRAY, marginTop:14 }}>* Open / view counts estimated — real tracking requires analytics integration</p>}
        </SectionCard>

        <SectionCard>
          <LeafDivider title="Revenue by Nationality" />
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {natData.map(n => (
              <div key={n.nat} style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', width:34, flexShrink:0, gap:3 }}>
                  <img src={flagUrl(n.nat, '20x15')} alt={`${n.nat} flag`} width={20} height={15} style={{ borderRadius:2, display:'block' }} />
                  <span style={{ fontSize:9, fontWeight:700, color:SUBTEXT, letterSpacing:'0.06em', lineHeight:1 }}>{n.nat}</span>
                </div>
                <div style={{ flex:1, height:7, background:MATCHA, borderRadius:4, overflow:'hidden', border:`1px solid ${BORDER}` }}>
                  <div style={{ height:'100%', borderRadius:4, background:n.color, width:`${Math.round(n.revenue/maxNat*100)}%`, transition:'width 1.2s ease' }} />
                </div>
                <span style={{ fontSize:11, fontWeight:600, color:SUMI, width:56, textAlign:'right', flexShrink:0 }}>
                  ¥{Math.round(n.revenue/10000)}万
                </span>
              </div>
            ))}
          </div>
          {!hasNatData && <p style={{ fontSize:10, color:GRAY, marginTop:14 }}>* Sample data — complete orders to see real values</p>}
        </SectionCard>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <SectionCard>
          <LeafDivider title="Channel Performance" />
          <div style={{ display:'flex', gap:16, marginBottom:12, fontSize:11, color:SUBTEXT }}>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:`${SHINRYOKU}B3`, display:'inline-block' }} />Open Rate
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10, height:10, borderRadius:2, background:`${WAKABA}B3`, display:'inline-block' }} />CVR
            </span>
          </div>
          <div style={{ height:200 }}>
            <Bar data={chPerfData} options={chPerfOpts as Parameters<typeof Bar>[0]['options']} />
          </div>
        </SectionCard>

        <SectionCard>
          <LeafDivider title="Best Send Time" />
          <div style={{ fontSize:10, color:GRAY, marginBottom:10, letterSpacing:'0.06em' }}>CVR heatmap by hour × day</div>
          <div style={{ display:'grid', gridTemplateColumns:'38px repeat(7,1fr)', gap:3 }}>
            <div />
            {days.map(d => (
              <div key={d} style={{ fontSize:9, color:GRAY, textAlign:'center', paddingBottom:3, letterSpacing:'0.04em' }}>{d}</div>
            ))}
            {hours.map((h,hi) => (
              <>
                <div key={h} style={{ fontSize:9, color:GRAY, display:'flex', alignItems:'center', justifyContent:'flex-end', paddingRight:5 }}>{h}</div>
                {days.map((_,di) => {
                  const val = heatData[hi][di]
                  const alpha = 0.1 + (val/10)*0.7
                  return (
                    <div key={di}
                      title={`${h} ${days[di]}: CVR ${val}%`}
                      style={{ height:24, borderRadius:4, background:`rgba(91,138,60,${alpha.toFixed(2)})`, cursor:'pointer', border:`1px solid rgba(91,138,60,0.08)` }}
                    />
                  )
                })}
              </>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [page, setPage] = useState<Page>('dashboard')
  const [orders, setOrders] = useState<Order[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [runtimeIds, setRuntimeIds] = useState<Set<string>>(new Set())
  const [offerTemplates, setOfferTemplates] = useState<OfferTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [od, bd, off] = await Promise.all([
        fetch('/api/admin/orders').then(r => r.json()),
        fetch('/api/admin/bookings').then(r => r.json()),
        fetch('/api/admin/offers').then(r => r.json()),
      ])
      setOrders(od.orders ?? [])
      setBookings(bd.bookings ?? [])
      setRuntimeIds(new Set(bd.runtimeIds ?? []))
      setOfferTemplates(off.offers ?? [])
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const titles: Record<Page,string> = { dashboard:'Dashboard', offers:'Offers', analytics:'Analytics' }

  return (
    <div style={{ background:BG, minHeight:'100vh', color:SUMI, fontFamily:"'DM Sans','Noto Sans JP',sans-serif" }}>
      <style>{`
        @keyframes live-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(.8)} }
        @keyframes slideIn  { from{transform:translateX(28px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes slideUp  { from{transform:translateY(16px);opacity:0} to{transform:translateY(0);opacity:1} }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        button:focus { outline: none; }
        input:focus { border-color: ${SHINRYOKU} !important; }
        ::-webkit-scrollbar { width:4px; height:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${BORDER2}; border-radius:2px; }
      `}</style>

      <Sidebar active={page} onNav={setPage} offerCount={offerTemplates.length} />

      <main style={{ marginLeft:240, minHeight:'100vh' }}>
        <TopBar title={titles[page]} onRefresh={load} />

        <div style={{ padding:28 }}>
          {loading ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:400 }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ width:36, height:36, borderRadius:'50%', border:`3px solid ${BORDER}`, borderTopColor:SHINRYOKU, animation:'spin 0.9s linear infinite', margin:'0 auto 14px' }} />
                <div style={{ color:GRAY, fontSize:13, letterSpacing:'0.06em' }}>Loading data...</div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            </div>
          ) : (
            <>
              {page==='dashboard' && <DashboardTab orders={orders} bookings={bookings} runtimeIds={runtimeIds} offerTemplates={offerTemplates} onBookingDeleted={load} />}
              {page==='offers'    && <OffersTab offerTemplates={offerTemplates} />}
              {page==='analytics' && <AnalyticsTab orders={orders} bookings={bookings} />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
