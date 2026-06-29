import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { printSingleBill, printMultiBills, printPurchaseOrder } from '../lib/pdfUtils'
import toast from 'react-hot-toast'

export default function DailySummary() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [slot, setSlot] = useState('all')
  const [orders, setOrders] = useState([])
  const [orderItems, setOrderItems] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (date) loadSummary() }, [date, slot])

  async function loadSummary() {
    setLoading(true)
    let q = supabase.from('orders')
      .select('*, retailers(id,name,phone,area,address,gstin)')
      .eq('order_date', date).order('slot').order('created_at')
    if (slot !== 'all') q = q.eq('slot', slot)
    const { data: ordersData } = await q
    setOrders(ordersData || [])

    if (ordersData?.length) {
      const ids = ordersData.map(o => o.id)
      const { data: items } = await supabase.from('order_items').select('*').in('order_id', ids)
      const map = {}
      ;(items || []).forEach(i => { if (!map[i.order_id]) map[i.order_id] = []; map[i.order_id].push(i) })
      setOrderItems(map)
    } else setOrderItems({})
    setLoading(false)
  }

  const consolidated = () => {
    const map = {}
    orders.forEach(o => {
      ;(orderItems[o.id] || []).forEach(item => {
        const key = `${item.product_name}|||${item.variant_name}`
        if (!map[key]) map[key] = {
          product_name: item.product_name,
          product_english_name: item.product_english_name,
          variant_name: item.variant_name,
          variant_english_name: item.variant_english_name,
          unit: item.unit, rate: item.rate, totalQty: 0, totalAmount: 0,
        }
        map[key].totalQty += Number(item.quantity)
        map[key].totalAmount += Number(item.amount)
      })
    })
    return Object.values(map).sort((a, b) => (a.product_english_name || a.product_name).localeCompare(b.product_english_name || b.product_name))
  }

  const handlePrintAll2up = () => {
    if (!orders.length) { toast.error('No orders'); return }
    printMultiBills(orders, orderItems, 2)
    toast.success('2-up PDF downloaded!')
  }
  const handlePrintAll4up = () => {
    if (!orders.length) { toast.error('No orders'); return }
    printMultiBills(orders, orderItems, 4)
    toast.success('4-up PDF downloaded!')
  }
  const handlePurchaseOrder = () => {
    const ok = printPurchaseOrder(date, slot, orders, orderItems)
    if (ok) toast.success('Purchase order PDF downloaded!')
    else toast.error('No items to print')
  }
  const handleSingleBill = (order) => {
    const items = orderItems[order.id] || []
    printSingleBill(order, items, order.retailers || {})
    toast.success('Bill downloaded!')
  }

  const cons = consolidated()
  const grandTotal = orders.reduce((s, o) => s + Number(o.total), 0)
  const totalPaid = orders.reduce((s, o) => s + Number(o.amount_paid || 0), 0)
  const totalPending = grandTotal - totalPaid
  const unpaidCount = orders.filter(o => o.payment_status === 'unpaid').length
  const partialCount = orders.filter(o => o.payment_status === 'partial').length

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h2>Daily Summary</h2><p>All orders for a day — print bills & purchase order</p></div>
      </div>

      {/* Controls */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="field" style={{ minWidth: 160 }}>
            <label>Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Slot</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['all', 'All Day'], ['morning', '☀️ Morning'], ['evening', '🌙 Evening']].map(([v, l]) => (
                <button key={v} onClick={() => setSlot(v)} className={slot === v ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-ghost btn-sm" onClick={handlePrintAll2up} disabled={!orders.length}>🖨 2 Bills/Page</button>
            <button className="btn btn-ghost btn-sm" onClick={handlePrintAll4up} disabled={!orders.length}>🖨 4 Bills/Page</button>
            <button className="btn btn-primary btn-sm" onClick={handlePurchaseOrder} disabled={!orders.length}>📋 Purchase Order PDF</button>
          </div>
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div> : (
        <>
          {orders.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 14, marginBottom: 20 }}>
              {[
                { label: 'Total Shops', value: orders.length, color: 'var(--saffron)' },
                { label: 'Total Billed', value: `₹${grandTotal.toLocaleString('en-IN')}`, color: 'var(--saffron)' },
                { label: 'Total Paid', value: `₹${totalPaid.toLocaleString('en-IN')}`, color: '#2E7D32' },
                { label: 'Total Pending', value: `₹${totalPending.toLocaleString('en-IN')}`, color: '#C62828' },
                { label: 'Unpaid / Partial', value: `${unpaidCount} / ${partialCount}`, color: '#E65100' },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value" style={{ color: s.color, fontSize: '1.4rem' }}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20 }}>
            {/* Orders list */}
            <div>
              <div style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: '1.05rem', marginBottom: 10 }}>
                {orders.length} Orders · {date} {slot !== 'all' ? `(${slot})` : ''}
              </div>
              {orders.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📭</div><div className="empty-title">No orders</div><p className="empty-sub">No orders for this date/slot.</p></div>
              ) : orders.map(o => {
                const pending = Number(o.total) - Number(o.amount_paid || 0)
                const statusColor = o.payment_status === 'paid' ? '#2E7D32' : o.payment_status === 'partial' ? '#E65100' : '#C62828'
                return (
                  <div key={o.id} style={{ background: '#fff', border: `1.5px solid ${o.payment_status === 'unpaid' ? '#FFCDD2' : o.payment_status === 'partial' ? '#FFE0B2' : 'var(--border)'}`, borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{o.retailers?.name || 'Unknown'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--warm-gray)' }}>
                        {o.slot === 'morning' ? '☀️' : '🌙'} {o.slot} · {(orderItems[o.id] || []).length} items
                      </div>
                      <div style={{ fontSize: '0.75rem', color: statusColor, fontWeight: 600, marginTop: 2 }}>
                        {o.payment_status === 'paid' ? '✅ Paid' : o.payment_status === 'partial' ? `⚡ Partial · ₹${pending.toFixed(2)} pending` : `⏳ Unpaid · ₹${Number(o.total).toFixed(2)} pending`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, color: 'var(--saffron)', fontSize: '1.1rem' }}>₹{Number(o.total).toFixed(2)}</div>
                      <button className="btn btn-outline btn-sm" onClick={() => handleSingleBill(o)}>🖨</button>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Consolidated purchase order */}
            <div>
              <div style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: '1.05rem', marginBottom: 10 }}>📋 Consolidated Purchase Order</div>
              {cons.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', color: 'var(--warm-gray)', padding: 40 }}>No items for this date</div>
              ) : (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--deep-brown)' }}>
                        {['Product', 'Size', 'Qty', 'Value'].map(h => (
                          <th key={h} style={{ padding: '9px 12px', color: '#fff', fontSize: '0.75rem', textAlign: h === 'Qty' ? 'center' : h === 'Value' ? 'right' : 'left', fontWeight: 600 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cons.map((item, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 ? 'var(--milk-white)' : '#fff' }}>
                          <td style={{ padding: '8px 12px', fontSize: '0.85rem', fontWeight: 600 }}>{item.product_name}</td>
                          <td style={{ padding: '8px 12px' }}><span className="tag">{item.variant_name}</span></td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: '1rem', color: 'var(--saffron)' }}>{item.totalQty}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: '0.85rem', fontWeight: 600 }}>₹{item.totalAmount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: 'var(--deep-brown)' }}>
                        <td colSpan={3} style={{ padding: '10px 12px', color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>GRAND TOTAL</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: "'Baloo 2',cursive", fontWeight: 800, fontSize: '1.1rem', color: 'var(--saffron)' }}>
                          ₹{cons.reduce((s, i) => s + i.totalAmount, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
