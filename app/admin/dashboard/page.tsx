'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Booking, CartItem } from '@/types'

type Order = {
  order_id: string
  booking_id: string
  guest_name: string
  room_type: string
  check_in: string
  items: CartItem[]
  total: number
  created_at: string
}

type OfferStat = { title: string; count: number; revenue: number }

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } catch {
    return iso
  }
}

const STAT_CARD = {
  background: '#fff',
  borderRadius: 12,
  padding: 16,
  border: '1px solid #F0EBE0',
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [od, bd] = await Promise.all([
      fetch('/api/admin/orders').then((r) => r.json()),
      fetch('/api/admin/bookings').then((r) => r.json()),
    ])
    setOrders(od.orders ?? [])
    setBookings(bd.bookings ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Stats
  const now = new Date()
  const thisMonth = orders.filter((o) => {
    const d = new Date(o.created_at)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
  const monthRevenue = thisMonth.reduce((s, o) => s + o.total, 0)
  const totalRevenue = orders.reduce((s, o) => s + o.total, 0)
  const cvr = bookings.length > 0
    ? ((orders.length / bookings.length) * 100).toFixed(1)
    : '0.0'
  const avgOrder = orders.length > 0
    ? Math.round(totalRevenue / orders.length)
    : 0

  // Offer performance
  const offerMap: Record<string, OfferStat> = {}
  orders.forEach((o) => {
    o.items.forEach((item) => {
      if (!offerMap[item.offer_id]) {
        offerMap[item.offer_id] = { title: item.title, count: 0, revenue: 0 }
      }
      offerMap[item.offer_id].count += item.quantity
      offerMap[item.offer_id].revenue += item.price * item.quantity
    })
  })
  const offerStats = Object.values(offerMap).sort((a, b) => b.count - a.count)

  // Paid booking IDs
  const paidIds = new Set(orders.map((o) => o.booking_id))

  // Sort bookings by check-in (soonest first)
  const sortedBookings = [...bookings].sort(
    (a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime()
  )

  const monthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen" style={{ background: '#F8F6F0' }}>
      {/* Nav */}
      <div
        style={{
          background: '#2C4A1E',
          padding: '12px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <span
          style={{ color: '#A8C97F', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em' }}
        >
          ▶ GAPPY STAY ADMIN
        </span>
        <span style={{ color: '#5B8A3C' }}>|</span>
        <Link href="/admin/upload" style={{ color: '#A8C97F', fontSize: 12, textDecoration: 'none' }}>
          Upload CSV
        </Link>
        <button
          onClick={load}
          style={{
            background: 'transparent',
            color: '#A8C97F',
            border: 'none',
            fontSize: 12,
            cursor: 'pointer',
            marginLeft: 'auto',
          }}
        >
          ↻ Refresh
        </button>
        <Link href="/" style={{ color: '#A8C97F', fontSize: 12, textDecoration: 'none' }}>
          ← Guest App
        </Link>
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 20px' }}>
        <h1 style={{ color: '#2C4A1E', fontSize: 22, fontWeight: 500, marginBottom: 4 }}>
          Dashboard
        </h1>
        <p style={{ color: '#7A8C70', fontSize: 13, marginBottom: 32 }}>{monthLabel}</p>

        {loading ? (
          <p style={{ color: '#A8C97F', fontSize: 14 }}>Loading...</p>
        ) : (
          <>
            {/* Stats row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
                marginBottom: 32,
              }}
            >
              <div style={STAT_CARD}>
                <p style={{ color: '#999', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Revenue (this month)
                </p>
                <p style={{ color: '#2C4A1E', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
                  ¥{monthRevenue.toLocaleString()}
                </p>
                <p style={{ color: '#B0B0A0', fontSize: 11 }}>
                  ¥{totalRevenue.toLocaleString()} all time
                </p>
              </div>

              <div style={STAT_CARD}>
                <p style={{ color: '#999', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Total Orders
                </p>
                <p style={{ color: '#2C4A1E', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
                  {orders.length}
                </p>
                <p style={{ color: '#B0B0A0', fontSize: 11 }}>
                  {thisMonth.length} this month
                </p>
              </div>

              <div style={STAT_CARD}>
                <p style={{ color: '#999', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  CVR
                </p>
                <p style={{ color: '#5B8A3C', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
                  {cvr}%
                </p>
                <p style={{ color: '#B0B0A0', fontSize: 11 }}>
                  {orders.length} / {bookings.length} guests
                </p>
              </div>

              <div style={STAT_CARD}>
                <p style={{ color: '#999', fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Avg Order Value
                </p>
                <p style={{ color: '#2C4A1E', fontSize: 22, fontWeight: 600, marginBottom: 4 }}>
                  ¥{avgOrder.toLocaleString()}
                </p>
                <p style={{ color: '#B0B0A0', fontSize: 11 }}>per booking</p>
              </div>
            </div>

            {/* Offer performance */}
            {offerStats.length > 0 && (
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 20,
                  marginBottom: 24,
                  border: '1px solid #F0EBE0',
                }}
              >
                <p
                  style={{
                    color: '#5B8A3C',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 16,
                  }}
                >
                  Offer Performance
                </p>
                <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: '#999', borderBottom: '1px solid #F0EBE0' }}>
                      {['Offer', 'Sold', 'Revenue', 'CVR'].map((h, i) => (
                        <th
                          key={h}
                          style={{
                            textAlign: i === 0 ? 'left' : 'right',
                            padding: '4px 8px',
                            fontWeight: 500,
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {offerStats.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F8F6F0' }}>
                        <td style={{ padding: '8px', color: '#2C4A1E' }}>{s.title}</td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#5B8A3C', fontWeight: 600 }}>
                          {s.count}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#2C4A1E' }}>
                          ¥{s.revenue.toLocaleString()}
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', color: '#999' }}>
                          {bookings.length > 0
                            ? ((s.count / bookings.length) * 100).toFixed(1)
                            : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Guest list */}
            <div
              style={{
                background: '#fff',
                borderRadius: 12,
                padding: 20,
                border: '1px solid #F0EBE0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                }}
              >
                <p
                  style={{
                    color: '#5B8A3C',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Guests ({sortedBookings.length})
                </p>
                <Link
                  href="/admin/upload"
                  style={{ color: '#A8C97F', fontSize: 12, textDecoration: 'none' }}
                >
                  + Upload CSV
                </Link>
              </div>

              {sortedBookings.length === 0 ? (
                <p style={{ color: '#CCC', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>
                  No bookings yet —{' '}
                  <Link href="/admin/upload" style={{ color: '#A8C97F' }}>
                    upload a CSV
                  </Link>{' '}
                  to get started
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#999', borderBottom: '1px solid #F0EBE0' }}>
                        {['Guest', 'Room', 'Check-in', 'Source', 'Offer URL', 'Status'].map((h, i) => (
                          <th
                            key={h}
                            style={{
                              textAlign: i >= 4 ? 'right' : 'left',
                              padding: '4px 8px',
                              fontWeight: 500,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBookings.map((b, i) => {
                        const isPaid = paidIds.has(b.booking_id)
                        const order = orders.find((o) => o.booking_id === b.booking_id)
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #F8F6F0' }}>
                            <td style={{ padding: '8px' }}>
                              <span style={{ color: '#2C4A1E', fontWeight: 500 }}>
                                {b.guest_name}
                              </span>
                              <span style={{ fontSize: 11, color: '#A8C97F', marginLeft: 6 }}>
                                {b.nationality}
                              </span>
                            </td>
                            <td style={{ padding: '8px', color: '#666' }}>{b.room_type || '—'}</td>
                            <td style={{ padding: '8px', color: '#666', whiteSpace: 'nowrap' }}>
                              {formatDate(b.check_in)}
                            </td>
                            <td style={{ padding: '8px', color: '#999', fontSize: 11 }}>
                              {b.booking_source || '—'}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <Link
                                href={`/offer/${b.booking_id}`}
                                style={{ color: '#5B8A3C', fontSize: 11, textDecoration: 'none' }}
                              >
                                Open ↗
                              </Link>
                            </td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              {isPaid ? (
                                <span
                                  style={{
                                    background: '#F0F4EC',
                                    color: '#5B8A3C',
                                    fontSize: 11,
                                    padding: '3px 10px',
                                    borderRadius: 20,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  ✓ ¥{order?.total.toLocaleString()}
                                </span>
                              ) : (
                                <span
                                  style={{
                                    background: '#F8F6F0',
                                    color: '#B0B0A0',
                                    fontSize: 11,
                                    padding: '3px 10px',
                                    borderRadius: 20,
                                  }}
                                >
                                  Not yet
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
