'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

// ── Design tokens (same as dashboard) ────────────────────────
const SHINRYOKU = '#5B8A3C'
const WAKABA    = '#A8C97F'
const SUMI      = '#2C4A1E'
const BG        = '#F8F6F0'
const CARD      = '#FFFFFF'
const MATCHA    = '#F0F4EC'
const BORDER    = '#F0EBE0'
const BORDER2   = '#D4C5A9'
const GRAY      = '#B0B0A0'
const SUBTEXT   = '#7A8C70'
const RED_SOFT  = '#8B2020'
const SIDEBAR   = SUMI

// ── CSV parser (unchanged logic) ─────────────────────────────
function countryFlag(code: string): string {
  if (!code || code.length < 2) return '🌐'
  const c = code.toUpperCase().slice(0, 2)
  return String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65) +
         String.fromCodePoint(0x1F1E6 + c.charCodeAt(1) - 65)
}

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) { result.push(current.trim()); current = '' }
    else current += c
  }
  result.push(current.trim())
  return result
}

function detectLang(nat: string): 'en'|'ja'|'ko'|'zh' {
  const n = nat.toUpperCase()
  if (['JP','JPN'].includes(n)) return 'ja'
  if (['KR','KOR'].includes(n)) return 'ko'
  if (['CN','CHN','TW','HK'].includes(n)) return 'zh'
  return 'en'
}

function inferTags(row: Record<string,string>): string[] {
  const tags: string[] = []
  const guests = parseInt(row.guests ?? row.adults ?? '1') || 1
  const nights = parseInt(row.nights ?? '1') || 1
  if (guests === 1) tags.push('solo')
  else if (guests === 2) tags.push('couple')
  else tags.push('family')
  if (nights >= 5) tags.push('long_stay')
  return tags
}

function parseCSV(text: string) {
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseLine(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g,'_').replace(/__+/g,'_'))
  return lines.slice(1).map((line, i) => {
    const vals = parseLine(line)
    const row: Record<string,string> = {}
    headers.forEach((h,j) => { row[h] = vals[j] ?? '' })
    const nationality = row.nationality || row.country || row.nat || 'US'
    return {
      booking_id:       row.booking_id || row.reservation_id || row.id || `CSV-${Date.now()}-${i}`,
      guest_name:       row.guest_name || row.name || row.guest || '',
      nationality,
      phone:            row.phone || row.telephone || row.mobile || '',
      email:            row.email || '',
      language:         detectLang(nationality),
      room_type:        row.room_type || row.room || '',
      room_number:      row.room_number || row.room_no || '',
      check_in:         row.check_in || row.checkin || row.arrival || '',
      check_out:        row.check_out || row.checkout || row.departure || '',
      nights:           parseInt(row.nights || row.length_of_stay || '1') || 1,
      guests:           parseInt(row.guests || row.adults || row.pax || '1') || 1,
      booking_source:   row.booking_source || row.source || row.ota || '',
      total_paid:       parseInt(row.total_paid || row.total || '0') || 0,
      special_requests: row.special_requests || row.requests || row.notes || '',
      tags:             inferTags(row),
    }
  }).filter(b => b.guest_name)
}

const TEMPLATE_CSV =
  'booking_id,guest_name,nationality,phone,email,room_type,room_number,check_in,check_out,nights,guests,booking_source,total_paid,special_requests\n' +
  'BK-001,John Smith,US,+14155550001,john@example.com,Deluxe Twin,401,2025-10-01,2025-10-03,2,2,Booking.com,78000,High floor preferred\n' +
  'BK-002,佐藤花子,JP,+819012345678,hanako@example.jp,Standard Single,205,2025-10-02,2025-10-03,1,1,じゃらん,18000,禁煙希望'

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type:'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'gappy-booking-template.csv'; a.click()
  URL.revokeObjectURL(url)
}

type ParsedBooking = ReturnType<typeof parseCSV>[number]

// ── Leaf SVG divider ──────────────────────────────────────────
function LeafDivider({ title }: { title: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
      <div style={{ flex:1, borderTop:`1px dashed ${WAKABA}` }} />
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <ellipse cx="7" cy="7" rx="5.5" ry="3" fill={WAKABA} opacity="0.8" transform="rotate(-35 7 7)" />
        <line x1="3" y1="10" x2="11" y2="4" stroke={SHINRYOKU} strokeWidth="0.6" opacity="0.5" />
      </svg>
      <span style={{ color:SHINRYOKU, fontSize:10, letterSpacing:'0.16em', fontWeight:600, textTransform:'uppercase', whiteSpace:'nowrap' }}>{title}</span>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
        <ellipse cx="7" cy="7" rx="5.5" ry="3" fill={WAKABA} opacity="0.8" transform="rotate(-35 7 7)" />
        <line x1="3" y1="10" x2="11" y2="4" stroke={SHINRYOKU} strokeWidth="0.6" opacity="0.5" />
      </svg>
      <div style={{ flex:1, borderTop:`1px dashed ${WAKABA}` }} />
    </div>
  )
}

// ── Sidebar (nav-only version for upload page) ────────────────
function Sidebar() {
  const pathname = usePathname()
  const links = [
    { href:'/admin/dashboard', label:'Dashboard',  icon:<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
    { href:'/admin/upload',    label:'Upload CSV', icon:<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg> },
  ]
  return (
    <aside style={{ position:'fixed', top:0, left:0, width:240, height:'100vh', background:SIDEBAR, display:'flex', flexDirection:'column', zIndex:100 }}>
      {/* Logo */}
      <div style={{ padding:'22px 24px', borderBottom:`1px solid rgba(255,255,255,0.08)`, display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ fontWeight:600, fontSize:15, color:'#fff', letterSpacing:'0.06em' }}>▶ Gappy Stay</span>
        <span style={{ fontSize:9, fontWeight:500, color:SHINRYOKU, background:'rgba(91,138,60,0.2)', border:`1px solid rgba(91,138,60,0.4)`, padding:'2px 6px', borderRadius:4, letterSpacing:'0.5px' }}>ADMIN</span>
      </div>
      {/* Hotel pill */}
      <div style={{ margin:'14px 16px 4px', padding:'10px 14px', background:'rgba(255,255,255,0.06)', border:`1px solid rgba(255,255,255,0.08)`, borderRadius:10 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,0.85)' }}>Gappy Hotel Tokyo</div>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Hotel Management</div>
      </div>
      {/* Nav */}
      <nav style={{ flex:1, padding:'8px 12px' }}>
        <div style={{ fontSize:9, fontWeight:500, color:'rgba(255,255,255,0.25)', letterSpacing:'1.2px', textTransform:'uppercase', padding:'10px 8px 6px' }}>Main</div>
        {links.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href}
              style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'10px 12px', borderRadius:8,
                color: active ? WAKABA : 'rgba(255,255,255,0.5)',
                fontSize:13, marginBottom:2,
                background: active ? 'rgba(168,201,127,0.15)' : 'transparent',
                borderLeft: active ? `2px solid ${WAKABA}` : '2px solid transparent',
                textDecoration:'none', transition:'all 0.15s',
              }}>
              <span style={{ opacity: active ? 1 : 0.6, color: active ? WAKABA : 'rgba(255,255,255,0.5)' }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
        <div style={{ fontSize:9, fontWeight:500, color:'rgba(255,255,255,0.25)', letterSpacing:'1.2px', textTransform:'uppercase', padding:'12px 8px 6px', marginTop:4 }}>More</div>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, color:'rgba(255,255,255,0.45)', fontSize:13, textDecoration:'none' }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/></svg>
          Guest App
        </Link>
      </nav>
      {/* Footer */}
      <div style={{ padding:'14px 16px', borderTop:`1px solid rgba(255,255,255,0.08)` }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#A8C97F,#5B8A3C)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:'#fff', flexShrink:0 }}>GA</div>
          <div>
            <div style={{ fontSize:12, fontWeight:500, color:'rgba(255,255,255,0.8)' }}>Gappy Admin</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)' }}>Hotel Manager</div>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function UploadPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState<ParsedBooking[]>([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [status, setStatus] = useState<'idle'|'preview'|'uploading'|'done'|'error'>('idle')
  const [result, setResult] = useState<{added:number; total:number}|null>(null)
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set())
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  function isDuplicate(b: ParsedBooking): boolean {
    if (existingIds.has(b.booking_id)) return true
    const key = `${b.guest_name.toLowerCase()}|${b.check_in?.split('T')[0]}`
    return existingKeys.has(key)
  }

  function handleFile(file: File) {
    setFileName(file.name); setStatus('idle'); setResult(null)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) { setBookings([]); setStatus('error'); return }
      fetch('/api/admin/bookings')
        .then(r => r.json())
        .then(({ bookings: existing }) => {
          setExistingIds(new Set(existing.map((b: { booking_id: string }) => b.booking_id)))
          setExistingKeys(new Set(existing.map((b: { guest_name: string; check_in: string }) =>
            `${b.guest_name.toLowerCase()}|${b.check_in?.split('T')[0]}`
          )))
        })
        .catch(() => {})
        .finally(() => { setBookings(parsed); setStatus('preview') })
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
  }

  async function upload() {
    setStatus('uploading')
    const newBookings = bookings.filter(b => !isDuplicate(b))
    try {
      const res = await fetch('/api/admin/upload', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ bookings: newBookings }) })
      const data = await res.json()
      setResult(data); setStatus('done')
    } catch { setStatus('error') }
  }

  async function clearUploaded() {
    await fetch('/api/admin/upload', { method:'DELETE' })
    setBookings([]); setFileName(''); setStatus('idle'); setResult(null)
  }

  function reset() {
    setBookings([]); setFileName(''); setStatus('idle'); setResult(null)
  }

  return (
    <div style={{ background:BG, minHeight:'100vh', color:SUMI, fontFamily:"'DM Sans','Noto Sans JP',sans-serif" }}>
      <style>{`
        input:focus { outline:none; }
        button:focus { outline:none; }
        ::-webkit-scrollbar { width:4px; } ::-webkit-scrollbar-track { background:transparent; } ::-webkit-scrollbar-thumb { background:${BORDER2}; border-radius:2px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fade-up { animation: fadeUp 0.3s ease both; }
      `}</style>

      <Sidebar />

      <main style={{ marginLeft:240, minHeight:'100vh' }}>
        {/* TopBar */}
        <header style={{ background:CARD, borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 28px', height:60, position:'sticky', top:0, zIndex:50 }}>
          <div style={{ fontSize:18, fontWeight:600, color:SUMI }}>Booking Manager</div>
          <Link href="/admin/dashboard" style={{ fontSize:11, color:SUBTEXT, padding:'5px 12px', background:MATCHA, border:`1px solid ${BORDER}`, borderRadius:7, textDecoration:'none', letterSpacing:'0.04em' }}>← Dashboard</Link>
        </header>

        <div style={{ maxWidth:720, margin:'0 auto', padding:28 }}>


          {/* ── CSV Upload ───────────────────────────────── */}
          <div className="fade-up" style={{ display:'flex', flexDirection:'column', gap:16 }}>

              {/* Step 1 — Template */}
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`3px solid ${WAKABA}`, borderRadius:12, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                    <span style={{ width:26, height:26, borderRadius:'50%', background:MATCHA, border:`1px solid ${WAKABA}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color:SHINRYOKU, flexShrink:0 }}>1</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:SUMI }}>Download the template</div>
                      <div style={{ fontSize:11, color:GRAY, marginTop:2 }}>Fill in your bookings, then upload below</div>
                    </div>
                  </div>
                  <button onClick={downloadTemplate}
                    style={{ background:MATCHA, color:SHINRYOKU, border:`1px solid ${WAKABA}`, borderRadius:8, padding:'8px 16px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:6, letterSpacing:'0.04em', flexShrink:0 }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M7 10l5 5m0 0l5-5m-5 5V4"/></svg>
                    CSV Template
                  </button>
                </div>

                {/* Column reference */}
                <div style={{ marginTop:14, padding:'12px 14px', background:BG, border:`1px solid ${BORDER}`, borderRadius:8 }}>
                  <div style={{ fontSize:10, fontWeight:600, color:WAKABA, textTransform:'uppercase', letterSpacing:'0.14em', marginBottom:8 }}>Supported CSV columns</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                    {['booking_id','guest_name','nationality','phone','email','room_type','room_number','check_in','check_out','nights','guests','booking_source','total_paid','special_requests'].map(col => (
                      <span key={col} style={{ fontSize:10, padding:'3px 8px', background:CARD, border:`1px solid ${BORDER}`, borderRadius:4, color:SUBTEXT, fontFamily:'monospace', letterSpacing:'0.02em' }}>{col}</span>
                    ))}
                  </div>
                  <p style={{ fontSize:11, color:GRAY, marginTop:8 }}>Column names are flexible — we also accept aliases like <span style={{ fontFamily:'monospace', color:SUBTEXT }}>name</span>, <span style={{ fontFamily:'monospace', color:SUBTEXT }}>checkin</span>, <span style={{ fontFamily:'monospace', color:SUBTEXT }}>arrival</span>, <span style={{ fontFamily:'monospace', color:SUBTEXT }}>source</span>, etc.</p>
                </div>
              </div>

              {/* Step 2 — Upload */}
              <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`3px solid ${status==='preview'||status==='done'?SHINRYOKU:WAKABA}`, borderRadius:12, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                  <span style={{ width:26, height:26, borderRadius:'50%', background: status==='preview'||status==='done'?SHINRYOKU:MATCHA, border:`1px solid ${status==='preview'||status==='done'?SHINRYOKU:WAKABA}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color: status==='preview'||status==='done'?'#fff':SHINRYOKU, flexShrink:0, transition:'all 0.2s' }}>
                    {status==='done' ? '✓' : '2'}
                  </span>
                  <div>
                    <div style={{ fontSize:13, fontWeight:500, color:SUMI }}>Upload your CSV file</div>
                    <div style={{ fontSize:11, color:GRAY, marginTop:2 }}>Drag and drop, or click to browse</div>
                  </div>
                </div>

                {/* Drop zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => inputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragOver ? SHINRYOKU : fileName ? WAKABA : BORDER2}`,
                    borderRadius:10, padding:'32px 20px', textAlign:'center',
                    cursor:'pointer', background: dragOver ? MATCHA : BG,
                    transition:'all 0.2s',
                  }}
                >
                  {status === 'done' ? (
                    <>
                      <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
                      <div style={{ fontSize:14, fontWeight:500, color:SHINRYOKU }}>{result?.added} bookings added</div>
                      <div style={{ fontSize:11, color:SUBTEXT, marginTop:4 }}>{result?.total} total in system</div>
                    </>
                  ) : fileName ? (
                    <>
                      <div style={{ fontSize:24, marginBottom:8 }}>📄</div>
                      <div style={{ fontSize:14, fontWeight:500, color:SHINRYOKU }}>{fileName}</div>
                      {bookings.length > 0 && (() => {
                        const newCount = bookings.filter(b => !isDuplicate(b)).length
                        const dupCount = bookings.length - newCount
                        return (
                          <div style={{ fontSize:12, color:SUBTEXT, marginTop:4 }}>
                            {newCount > 0 && <span>{newCount} new booking{newCount!==1?'s':''}</span>}
                            {newCount > 0 && dupCount > 0 && <span style={{ color:BORDER2 }}> · </span>}
                            {dupCount > 0 && <span style={{ color:'#B8963E' }}>{dupCount} already in system</span>}
                          </div>
                        )
                      })()}
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:32, marginBottom:10, opacity:0.6 }}>⬆</div>
                      <div style={{ fontSize:14, fontWeight:500, color:SUBTEXT }}>Drop your CSV here</div>
                      <div style={{ fontSize:11, color:GRAY, marginTop:4 }}>or click to browse files</div>
                    </>
                  )}
                  <input ref={inputRef} type="file" accept=".csv" style={{ display:'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                </div>

                {/* Error */}
                {status === 'error' && (
                  <div style={{ marginTop:12, padding:'10px 14px', background:'#FFF0F0', border:`1px solid rgba(139,32,32,0.2)`, borderLeft:`3px solid ${RED_SOFT}`, borderRadius:8, fontSize:12, color:RED_SOFT }}>
                    {bookings.length === 0 ? 'No valid rows found. Make sure the CSV has a header row and at least one guest name.' : 'Upload failed — please try again.'}
                  </div>
                )}
              </div>

              {/* Step 3 — Preview & Confirm */}
              {(status === 'preview' || status === 'uploading' || status === 'done') && bookings.length > 0 && (
                <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderLeft:`3px solid ${status==='done'?SHINRYOKU:WAKABA}`, borderRadius:12, padding:'18px 20px', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' }} className="fade-up">
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                    <span style={{ width:26, height:26, borderRadius:'50%', background: status==='done'?SHINRYOKU:MATCHA, border:`1px solid ${status==='done'?SHINRYOKU:WAKABA}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:600, color: status==='done'?'#fff':SHINRYOKU, flexShrink:0, transition:'all 0.2s' }}>
                      {status==='done'?'✓':'3'}
                    </span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:SUMI }}>
                        {status==='done'
                          ? `Import complete — ${result?.added} booking${result?.added!==1?'s':''} added`
                          : (() => {
                              const newCount = bookings.filter(b => !isDuplicate(b)).length
                              const dupCount = bookings.length - newCount
                              if (dupCount === bookings.length) return 'All guests already in system'
                              return `Preview — ${newCount} new${dupCount > 0 ? `, ${dupCount} duplicate${dupCount!==1?'s':''}` : ''}`
                            })()
                        }
                      </div>
                      <div style={{ fontSize:11, color:GRAY, marginTop:2 }}>
                        {status==='done' ? `${result?.total} total bookings in system` : 'Review before importing'}
                      </div>
                    </div>
                  </div>

                  <LeafDivider title={`Showing ${Math.min(5,bookings.length)} of ${bookings.length}`} />

                  <div style={{ overflowX:'auto', marginBottom:16 }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ borderBottom:`1px solid ${BORDER}` }}>
                          {['Guest','Nationality','Room','Check-in','Check-out','Nights','Source','Status'].map(h => (
                            <th key={h} style={{ fontSize:9, fontWeight:500, color:WAKABA, textTransform:'uppercase', letterSpacing:'0.14em', textAlign:'left', padding:'0 10px 10px 0', fontFamily:'inherit' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.slice(0,5).map((b,i) => {
                          const dup = isDuplicate(b)
                          return (
                            <tr key={i} style={{ borderBottom:`1px solid ${BORDER}`, opacity: dup ? 0.55 : 1 }}>
                              <td style={{ padding:'9px 10px 9px 0', color:SUMI, fontWeight:500 }}>{b.guest_name}</td>
                              <td style={{ padding:'9px 10px 9px 0' }}>
                                {b.nationality ? (
                                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:1 }}>
                                    <span style={{ fontSize:18, lineHeight:1 }}>{countryFlag(b.nationality)}</span>
                                    <span style={{ fontSize:9, fontWeight:600, color:SUBTEXT, letterSpacing:'0.05em' }}>{b.nationality.toUpperCase().slice(0,2)}</span>
                                  </div>
                                ) : <span style={{ color:GRAY }}>—</span>}
                              </td>
                              <td style={{ padding:'9px 10px 9px 0', color:SUBTEXT }}>{b.room_type || '—'}</td>
                              <td style={{ padding:'9px 10px 9px 0', color:SUBTEXT, whiteSpace:'nowrap' }}>{b.check_in || '—'}</td>
                              <td style={{ padding:'9px 10px 9px 0', color:SUBTEXT, whiteSpace:'nowrap' }}>{b.check_out || '—'}</td>
                              <td style={{ padding:'9px 10px 9px 0', color:SUBTEXT }}>{b.nights}</td>
                              <td style={{ padding:'9px 10px 9px 0', color:GRAY, fontSize:11 }}>{b.booking_source || '—'}</td>
                              <td style={{ padding:'9px 0' }}>
                                {dup ? (
                                  <span style={{ fontSize:10, fontWeight:500, padding:'3px 8px', borderRadius:5, background:'rgba(184,150,62,0.12)', color:'#B8963E', border:'1px solid rgba(184,150,62,0.25)', whiteSpace:'nowrap' }}>
                                    Already in system
                                  </span>
                                ) : (
                                  <span style={{ fontSize:10, fontWeight:500, padding:'3px 8px', borderRadius:5, background:'rgba(91,138,60,0.1)', color:SHINRYOKU, border:'1px solid rgba(91,138,60,0.2)', whiteSpace:'nowrap' }}>
                                    New
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {bookings.length > 5 && (
                      <p style={{ fontSize:11, color:GRAY, marginTop:8, textAlign:'center' }}>+ {bookings.length-5} more bookings not shown</p>
                    )}
                  </div>

                  {/* Actions */}
                  {status !== 'done' && (() => {
                    const newCount = bookings.filter(b => !isDuplicate(b)).length
                    const allDup   = newCount === 0
                    return (
                      <div style={{ display:'flex', gap:10, flexDirection:'column' }}>
                        {allDup && (
                          <div style={{ padding:'10px 14px', background:'rgba(184,150,62,0.08)', border:'1px solid rgba(184,150,62,0.25)', borderRadius:8, fontSize:12, color:'#B8963E', textAlign:'center' }}>
                            All guests from this file are already in the system — nothing new to import.
                          </div>
                        )}
                        <div style={{ display:'flex', gap:10 }}>
                          <button onClick={upload} disabled={status==='uploading' || allDup}
                            style={{ flex:1, background: allDup ? BORDER2 : status==='uploading' ? WAKABA : SHINRYOKU, color:'#fff', border:'none', borderRadius:9, padding:'13px', fontSize:14, fontWeight:500, cursor: allDup || status==='uploading' ? 'default' : 'pointer', fontFamily:'inherit', letterSpacing:'0.03em', transition:'background 0.2s' }}>
                            {status==='uploading' ? 'Importing...' : allDup ? 'Nothing to import' : `Import ${newCount} new booking${newCount!==1?'s':''} →`}
                          </button>
                          <button onClick={reset}
                            style={{ background:'transparent', color:GRAY, border:`1px solid ${BORDER2}`, borderRadius:9, padding:'13px 20px', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )
                  })()}

                  {status === 'done' && (
                    <div style={{ display:'flex', gap:10 }}>
                      <button onClick={() => router.push('/admin/dashboard')}
                        style={{ flex:1, background:SHINRYOKU, color:'#fff', border:'none', borderRadius:9, padding:'13px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', letterSpacing:'0.04em' }}>
                        View in Dashboard →
                      </button>
                      <button onClick={() => { reset(); clearUploaded() }}
                        style={{ background:MATCHA, color:SUBTEXT, border:`1px solid ${BORDER}`, borderRadius:9, padding:'13px 20px', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                        Clear all data
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

        </div>
      </main>
    </div>
  )
}
