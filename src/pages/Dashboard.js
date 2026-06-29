import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ retailers: 0, orders: 0, revenue: 0, todayRevenue: 0, totalPaid: 0, totalPending: 0 })
  const [recentOrders, setRecentOrders] = useState([])
  const [topRetailers, setTopRetailers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const [retailersRes, ordersRes] = await Promise.all([
      supabase.from('retailers').select('id', { count: 'exact' }).eq('is_active', true),
      supabase.from('orders').select('id,total,amount_paid,payment_status,order_date,slot,retailer_id,retailers(name)').order('created_at', { ascending: false }),
    ])
    const orders = ordersRes.data || []
    const totalRevenue = orders.reduce((s, o) => s + Number(o.total), 0)
    const totalPaid = orders.reduce((s, o) => s + Number(o.amount_paid || 0), 0)
    const todayRevenue = orders.filter(o => o.order_date === today).reduce((s, o) => s + Number(o.total), 0)
    setStats({ retailers: retailersRes.count || 0, orders: orders.length, revenue: totalRevenue, todayRevenue, totalPaid, totalPending: totalRevenue - totalPaid })
    setRecentOrders(orders.slice(0, 6))
    const byRetailer = {}
    orders.forEach(o => {
      const key = o.retailer_id
      if (!key) return
      if (!byRetailer[key]) byRetailer[key] = { name: o.retailers?.name || 'Unknown', total: 0, count: 0 }
      byRetailer[key].total += Number(o.total)
      byRetailer[key].count++
    })
    setTopRetailers(Object.values(byRetailer).sort((a, b) => b.total - a.total).slice(0, 5))
    setLoading(false)
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const paymentColor = (status) => status === 'paid' ? '#2E7D32' : status === 'partial' ? '#E65100' : '#C62828'
  const paymentLabel = (status) => status === 'paid' ? '✅' : status === 'partial' ? '⚡' : '⏳'

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: "'Baloo 2',cursive", fontSize: '1.6rem', fontWeight: 700 }}>
          {greeting()}, {profile?.full_name?.split(' ')[0] || 'there'}! 🌞
        </h2>
        <p style={{ color: 'var(--warm-gray)', fontSize: '0.88rem', marginTop: 3 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Active Retailers', value: stats.retailers, sub: 'registered', color: 'var(--saffron)' },
          { label: 'Total Revenue', value: `₹${Math.round(stats.revenue).toLocaleString('en-IN')}`, sub: 'all time', color: 'var(--saffron)' },
          { label: 'Total Paid', value: `₹${Math.round(stats.totalPaid).toLocaleString('en-IN')}`, sub: 'collected', color: '#2E7D32' },
          { label: 'Total Pending', value: `₹${Math.round(stats.totalPending).toLocaleString('en-IN')}`, sub: 'outstanding', color: '#C62828' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: '1.05rem' }}>Recent Orders</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/orders')}>View All</button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}><div className="empty-icon">📭</div><p>No orders yet</p></div>
          ) : recentOrders.map(o => (
            <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {o.retailers?.name || '—'}
                  <span style={{ fontSize: '0.8rem' }}>{paymentLabel(o.payment_status)}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--warm-gray)' }}>{o.order_date} · {o.slot}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, color: 'var(--saffron)', fontSize: '1rem' }}>₹{Number(o.total).toFixed(0)}</div>
                {o.payment_status !== 'paid' && (
                  <div style={{ fontSize: '0.7rem', color: paymentColor(o.payment_status) }}>
                    ₹{(Number(o.total) - Number(o.amount_paid || 0)).toFixed(0)} pending
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: '1.05rem' }}>Top Retailers</div>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/retailers')}>Manage</button>
          </div>
          {topRetailers.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}><div className="empty-icon">🏪</div><p>No data yet</p></div>
          ) : topRetailers.map((r, i) => (
            <div key={r.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 26, height: 26, background: i === 0 ? 'var(--saffron)' : 'var(--border)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: i === 0 ? '#fff' : 'var(--warm-gray)', flexShrink: 0 }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--warm-gray)' }}>{r.count} orders</div>
                </div>
              </div>
              <div style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, color: 'var(--saffron)', fontSize: '1rem' }}>₹{r.total.toLocaleString('en-IN')}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => navigate('/new-order')}>🧾 Take New Order</button>
        <button className="btn btn-outline" onClick={() => navigate('/daily-summary')}>📅 Daily Summary</button>
        <button className="btn btn-ghost" onClick={() => navigate('/retailers')}>🏪 Retailers</button>
      </div>
    </div>
  )
}
