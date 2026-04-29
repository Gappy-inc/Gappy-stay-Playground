'use client'

import { useState, useRef } from 'react'
import Link from 'next/link'

// ── CSV parser ────────────────────────────────────────────────────────────────
function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  result.push(current.trim())
  return result
}

function detectLang(nat: string): 'en' | 'ja' | 'ko' | 'zh' {
  const n = nat.toUpperCase()
  if (['JP', 'JPN'].includes(n)) return 'ja'
  if (['KR', 'KOR'].includes(n)) return 'ko'
  if (['CN', 'CHN', 'TW', 'HK'].includes(n)) return 'zh'
  return 'en'
}

function inferTags(row: Record<string, string>): string[] {
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
  const lines = text.trim().split('\n').filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = parseLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/__+/g, '_')
  )
  return lines.slice(1).map((line, i) => {
    const vals = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = vals[j] ?? '' })
    const nationality = row.nationality || row.country || row.nat || 'US'
    return {
      booking_id: row.booking_id || row.reservation_id || row.id || `CSV-${Date.now()}-${i}`,
      guest_name: row.guest_name || row.name || row.guest || '',
      nationality,
      phone: row.phone || row.telephone || row.mobile || '',
      email: row.email || '',
      language: detectLang(nationality),
      room_type: row.room_type || row.room || '',
      room_number: row.room_number || row.room_no || '',
      check_in: row.check_in || row.checkin || row.arrival || '',
      check_out: row.check_out || row.checkout || row.departure || '',
      nights: parseInt(row.nights || row.length_of_stay || '1') || 1,
      guests: parseInt(row.guests || row.adults || row.pax || '1') || 1,
      booking_source: row.booking_source || row.source || row.ota || '',
      total_paid: parseInt(row.total_paid || row.total || '0') || 0,
      special_requests: row.special_requests || row.requests || row.notes || '',
      tags: inferTags(row),
    }
  }).filter((b) => b.guest_name)
}

const TEMPLATE_CSV =
  'booking_id,guest_name,nationality,phone,email,room_type,room_number,check_in,check_out,nights,guests,booking_source,special_requests\n' +
  'BK-001,John Smith,US,+14155550001,john@example.com,Deluxe Twin,401,2025-10-01,2025-10-03,2,2,Booking.com,\n' +
  'BK-002,佐藤花子,JP,+819012345678,hanako@example.jp,Standard Single,205,2025-10-02,2025-10-03,1,1,じゃらん,禁煙希望'

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'gappy-booking-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Page ──────────────────────────────────────────────────────────────────────
type ParsedBooking = ReturnType<typeof parseCSV>[number]

export default function UploadPage() {
  const [bookings, setBookings] = useState<ParsedBooking[]>([])
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState<'idle' | 'preview' | 'uploading' | 'done' | 'error'>('idle')
  const [result, setResult] = useState<{ added: number; total: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setFileName(file.name)
    setStatus('idle')
    setResult(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      setBookings(parsed)
      setStatus(parsed.length > 0 ? 'preview' : 'error')
    }
    reader.readAsText(file, 'UTF-8')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) handleFile(file)
  }

  async function upload() {
    setStatus('uploading')
    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookings }),
      })
      const data = await res.json()
      setResult(data)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  async function clearUploaded() {
    await fetch('/api/admin/upload', { method: 'DELETE' })
    setBookings([])
    setFileName('')
    setStatus('idle')
    setResult(null)
  }

  return (
    <div className="min-h-screen" style={{ background: '#F8F6F0' }}>
      {/* Nav */}
      <div style={{ background: '#2C4A1E', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: '#A8C97F', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em' }}>
          ▶ GAPPY STAY ADMIN
        </span>
        <span style={{ color: '#5B8A3C' }}>|</span>
        <Link href="/admin/dashboard" style={{ color: '#A8C97F', fontSize: 12, textDecoration: 'none' }}>
          Dashboard
        </Link>
        <Link href="/" style={{ color: '#A8C97F', fontSize: 12, textDecoration: 'none', marginLeft: 'auto' }}>
          ← Guest App
        </Link>
      </div>

      <div style={{ maxWidth: 600, margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ color: '#2C4A1E', fontSize: 22, fontWeight: 500, marginBottom: 4 }}>
          Upload Booking CSV
        </h1>
        <p style={{ color: '#7A8C70', fontSize: 13, marginBottom: 32 }}>
          Export from your PMS (手間いらず, TLリンカーン, ねっぱん！ etc.) and upload here.
        </p>

        {/* Template download */}
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 20,
            border: '1px solid #F0EBE0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <p style={{ color: '#2C4A1E', fontSize: 13, fontWeight: 500 }}>Need the CSV template?</p>
            <p style={{ color: '#999', fontSize: 12, marginTop: 2 }}>
              Download, fill in your bookings, then upload
            </p>
          </div>
          <button
            onClick={downloadTemplate}
            style={{
              background: '#F0F4EC',
              color: '#5B8A3C',
              border: '1px solid #A8C97F',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            ↓ Template
          </button>
        </div>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          style={{
            border: `2px dashed ${fileName ? '#5B8A3C' : '#A8C97F'}`,
            borderRadius: 12,
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            background: '#fff',
            marginBottom: 20,
            transition: 'border-color 0.2s',
          }}
        >
          <p style={{ fontSize: 28, marginBottom: 8 }}>📂</p>
          <p style={{ color: '#5B8A3C', fontSize: 14, fontWeight: 500 }}>
            {fileName || 'Drop CSV here or click to browse'}
          </p>
          {fileName && bookings.length > 0 && (
            <p style={{ color: '#A8C97F', fontSize: 12, marginTop: 4 }}>
              {bookings.length} bookings parsed
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </div>

        {/* Preview */}
        {status === 'preview' && bookings.length > 0 && (
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              border: '1px solid #F0EBE0',
              overflowX: 'auto',
            }}
          >
            <p
              style={{
                color: '#5B8A3C',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              Preview — first {Math.min(3, bookings.length)} of {bookings.length}
            </p>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: '#999', borderBottom: '1px solid #F0EBE0' }}>
                  {['Name', 'Nationality', 'Room', 'Check-in', 'Nights'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.slice(0, 3).map((b, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #F8F6F0' }}>
                    <td style={{ padding: '6px 8px', color: '#2C4A1E' }}>{b.guest_name}</td>
                    <td style={{ padding: '6px 8px', color: '#666' }}>{b.nationality}</td>
                    <td style={{ padding: '6px 8px', color: '#666' }}>{b.room_type || '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#666' }}>{b.check_in || '—'}</td>
                    <td style={{ padding: '6px 8px', color: '#666' }}>{b.nights}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Success */}
        {status === 'done' && result && (
          <div
            style={{
              background: '#F0F4EC',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
              border: '1px solid #A8C97F',
            }}
          >
            <p style={{ color: '#2C4A1E', fontWeight: 500, fontSize: 14 }}>
              ✅ {result.added} bookings added ({result.total} total in system)
            </p>
            <Link
              href="/admin/dashboard"
              style={{ color: '#5B8A3C', fontSize: 13, textDecoration: 'underline' }}
            >
              View in Dashboard →
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div
            style={{
              background: '#FFF0F0',
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 20,
              border: '1px solid #F4BABA',
            }}
          >
            <p style={{ color: '#8B2020', fontSize: 14 }}>
              {bookings.length === 0
                ? 'No valid rows found. Check the CSV has a header row and at least one guest name.'
                : 'Upload failed. Please try again.'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          {status === 'preview' && (
            <button
              onClick={upload}
              style={{
                flex: 1,
                background: '#5B8A3C',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: 14,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Upload {bookings.length} bookings →
            </button>
          )}
          {status === 'uploading' && (
            <button
              disabled
              style={{
                flex: 1,
                background: '#A8C97F',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                padding: 14,
                fontSize: 14,
                fontFamily: 'inherit',
              }}
            >
              Uploading...
            </button>
          )}
          <button
            onClick={clearUploaded}
            style={{
              background: 'transparent',
              color: '#B0B0A0',
              border: '1px solid #D4C5A9',
              borderRadius: 10,
              padding: '14px 20px',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  )
}
