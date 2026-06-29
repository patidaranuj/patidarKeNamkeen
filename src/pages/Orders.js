import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { printSingleBill } from '../lib/pdfUtils'
import toast from 'react-hot-toast'

const PAYMENT_OPTIONS = [
  { value: 'unpaid', label: '⏳ Unpaid', color: '#C62828', bg: '#FFEBEE' },
  { value: 'partial', label: '⚡ Partial', color: '#E65100', bg: '#FFF3E0' },
  { value: 'paid', label: '✅ Paid', color: '#2E7D32', bg: '#E8F5E9' },
]

function PaymentBadge({ status }) {
  const opt = PAYMENT_OPTIONS.find(o => o.value === status) || PAYMENT_OPTIONS[0]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, background: opt.bg, color: opt.color }}>
      {opt.label}
    </span>
  )
}

function PaymentModal({ order, onClose, onSaved }) {
  const [status, setStatus] = useState(order.payment_status || 'unpaid')
  const [amountPaid, setAmountPaid] = useState(String(order.amount_paid || 0))
  const [saving, setSaving] = useState(false)

  const total = Number(order.total)

  const handleSave = async () => {
    let paid = status === 'paid' ? total : status === 'unpaid' ? 0 : parseFloat(amountPaid) || 0
    if (status === 'partial' && (paid <= 0 || paid >= total)) {
      toast.error('Partial amount must be between 0 and total'); return
    }
    setSaving(true)
    const { error } = await supabase.from('orders').update({ payment_status: status, amount_paid: paid }).eq('id', order.id)
    setSaving(false)
    if (error) { toast.error('Failed: ' + error.message); return }
    toast.success('Payment updated ✓')
    onSaved({ ...order, payment_status: status, amount_paid: paid })
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-title">Update Payment</div>
        <div style={{ marginBottom: 14, padding: '10px 14px', background: 'var(--cream)', borderRadius: 8 }}>
          <div style={{ fontSize: '0.82rem', color: 'var(--warm-gray)' }}>{order.retailers?.name} · {order.order_date}</div>
          <div style={{ fontFamily: "'Baloo 2',cursive", fontSize: '1.4rem', fontWeight: 700, color: 'var(--saffron)' }}>₹{total.toFixed(2)}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>Payment Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PAYMENT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => {
                  setStatus(opt.value)
                  if (opt.value === 'paid') setAmountPaid(total.toFixed(2))
                  if (opt.value === 'unpaid') setAmountPaid('0')
                }}
                  style={{ flex: 1, padding: '10px 6px', border: `2px solid ${status === opt.value ? opt.color : 'var(--border)'}`, borderRadius: 8, background: status === opt.value ? opt.bg : '#fff', color: status === opt.value ? opt.color : 'var(--warm-gray)', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.15s' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {status === 'partial' && (
            <div className="field">
              <label>Amount Paid (₹)</label>
              <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} placeholder="0.00" min="0" max={total} step="0.01" autoFocus />
              <span style={{ fontSize: '0.78rem', color: 'var(--warm-gray)', marginTop: 3 }}>
                Pending: ₹{(total - (parseFloat(amountPaid) || 0)).toFixed(2)}
              </span>
            </div>
          )}
          {status === 'paid' && (
            <div style={{ padding: '10px 14px', background: '#E8F5E9', borderRadius: 8, color: '#2E7D32', fontWeight: 600, fontSize: '0.88rem' }}>
              ✅ Full amount ₹{total.toFixed(2)} will be marked as paid
            </div>
          )}
          {status === 'unpaid' && (
            <div style={{ padding: '10px 14px', background: '#FFEBEE', borderRadius: 8, color: '#C62828', fontWeight: 600, fontSize: '0.88rem' }}>
              ⏳ Full amount ₹{total.toFixed(2)} will be marked as pending
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? '⏳…' : 'Save Payment'}</button>
        </div>
      </div>
    </div>
  )
}

export default function Orders() {
  const [orders, setOrders] = useState([])
  const [retailers, setRetailers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterRetailer, setFilterRetailer] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterSlot, setFilterSlot] = useState('')
  const [filterPayment, setFilterPayment] = useState('')
  const [expandedOrder, setExpandedOrder] = useState(null)
  const [orderItems, setOrderItems] = useState({})
  const [paymentModal, setPaymentModal] = useState(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [ordersRes, retailersRes] = await Promise.all([
      supabase.from('orders').select('*, retailers(id,name,phone,area,address,gstin)').order('order_date', { ascending: false }).order('slot').order('created_at', { ascending: false }),
      supabase.from('retailers').select('id,name').order('name'),
    ])
    setOrders(ordersRes.data || [])
    setRetailers(retailersRes.data || [])
    setLoading(false)
  }

  async function loadItems(orderId) {
    if (orderItems[orderId]) return
    const { data } = await supabase.from('order_items').select('*').eq('order_id', orderId)
    setOrderItems(prev => ({ ...prev, [orderId]: data || [] }))
  }

  const toggleExpand = async (orderId) => {
    if (expandedOrder === orderId) { setExpandedOrder(null); return }
    setExpandedOrder(orderId)
    await loadItems(orderId)
  }

  const handleDelete = async (orderId) => {
    if (!window.confirm('Delete this order?')) return
    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    if (error) { toast.error('Failed to delete'); return }
    setOrders(prev => prev.filter(o => o.id !== orderId))
    toast.success('Order deleted')
  }

  const handlePrintBill = async (order) => {
    let items = orderItems[order.id]
    if (!items) {
      const { data } = await supabase.from('order_items').select('*').eq('order_id', order.id)
      items = data || []
      setOrderItems(prev => ({ ...prev, [order.id]: items }))
    }
    printSingleBill(order, items, order.retailers || {})
    toast.success('Bill downloaded!')
  }

  const onPaymentSaved = (updatedOrder) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o))
  }

  const filtered = orders.filter(o => {
    const name = o.retailers?.name?.toLowerCase() || ''
    if (search && !name.includes(search.toLowerCase())) return false
    if (filterRetailer && o.retailer_id !== filterRetailer) return false
    if (filterDate && o.order_date !== filterDate) return false
    if (filterSlot && o.slot !== filterSlot) return false
    if (filterPayment && o.payment_status !== filterPayment) return false
    return true
  })

  const totalBilled = filtered.reduce((s, o) => s + Number(o.total), 0)
  const totalPaid = filtered.reduce((s, o) => s + Number(o.amount_paid || 0), 0)
  const totalPending = totalBilled - totalPaid

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h2>All Orders</h2><p>View, update payments, and print bills</p></div>
        {filtered.length > 0 && (
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--warm-gray)', textTransform: 'uppercase', fontWeight: 600 }}>Total Billed</div>
              <div style={{ fontFamily: "'Baloo 2',cursive", fontSize: '1.2rem', fontWeight: 700, color: 'var(--saffron)' }}>₹{totalBilled.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--warm-gray)', textTransform: 'uppercase', fontWeight: 600 }}>Paid</div>
              <div style={{ fontFamily: "'Baloo 2',cursive", fontSize: '1.2rem', fontWeight: 700, color: '#2E7D32' }}>₹{totalPaid.toLocaleString('en-IN')}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--warm-gray)', textTransform: 'uppercase', fontWeight: 600 }}>Pending</div>
              <div style={{ fontFamily: "'Baloo 2',cursive", fontSize: '1.2rem', fontWeight: 700, color: '#C62828' }}>₹{totalPending.toLocaleString('en-IN')}</div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="search-row">
        <input className="search-input" placeholder="Search by retailer…" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterRetailer} onChange={e => setFilterRetailer(e.target.value)}
          style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', outline: 'none', background: '#fff', minWidth: 130 }}>
          <option value="">All Retailers</option>
          {retailers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)}
          style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', outline: 'none', background: '#fff' }} />
        <select value={filterSlot} onChange={e => setFilterSlot(e.target.value)}
          style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          <option value="">All Slots</option>
          <option value="morning">☀️ Morning</option>
          <option value="evening">🌙 Evening</option>
        </select>
        <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)}
          style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          <option value="">All Payments</option>
          <option value="paid">✅ Paid</option>
          <option value="partial">⚡ Partial</option>
          <option value="unpaid">⏳ Unpaid</option>
        </select>
        {(search || filterRetailer || filterDate || filterSlot || filterPayment) && (
          <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(''); setFilterRetailer(''); setFilterDate(''); setFilterSlot(''); setFilterPayment('') }}>✕ Clear</button>
        )}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
        : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📭</div><div className="empty-title">No orders found</div></div>
        ) : filtered.map(order => {
          const pending = Number(order.total) - Number(order.amount_paid || 0)
          return (
            <div key={order.id} style={{ background: '#fff', border: `1.5px solid ${order.payment_status === 'unpaid' ? '#FFCDD2' : order.payment_status === 'partial' ? '#FFE0B2' : 'var(--border)'}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', flexWrap: 'wrap', gap: 10, cursor: 'pointer' }}
                onClick={() => toggleExpand(order.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 38, height: 38, background: order.slot === 'morning' ? '#FFF8E1' : '#EDE7F6', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', flexShrink: 0 }}>
                    {order.slot === 'morning' ? '☀️' : '🌙'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {order.retailers?.name || 'Unknown'}
                      <PaymentBadge status={order.payment_status} />
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--warm-gray)' }}>
                      {order.order_date} · {order.slot}{order.notes ? ` · ${order.notes}` : ''}
                      {order.payment_status === 'partial' && <span style={{ color: '#E65100', marginLeft: 6 }}>· Pending ₹{pending.toFixed(2)}</span>}
                      {order.payment_status === 'unpaid' && <span style={{ color: '#C62828', marginLeft: 6 }}>· Full amount pending</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: "'Baloo 2',cursive", fontSize: '1.2rem', fontWeight: 700, color: 'var(--saffron)' }}>₹{Number(order.total).toFixed(2)}</div>
                    {order.payment_status !== 'paid' && <div style={{ fontSize: '0.72rem', color: '#C62828', fontWeight: 600 }}>₹{pending.toFixed(2)} pending</div>}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setPaymentModal(order) }}>💰 Payment</button>
                  <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); handlePrintBill(order) }}>🖨 Bill</button>
                  <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(order.id) }}>🗑</button>
                  <span style={{ color: 'var(--warm-gray)' }}>{expandedOrder === order.id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedOrder === order.id && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--cream)' }}>
                  {!orderItems[order.id] ? <div style={{ textAlign: 'center', padding: 20 }}><div className="spinner" /></div> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--border)' }}>
                          {['Product', 'Size / Variant', 'Rate', 'Qty', 'Amount'].map(h => (
                            <th key={h} style={{ padding: '8px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--warm-gray)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {orderItems[order.id].map(item => (
                          <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '9px 16px', fontWeight: 600 }}>{item.product_name}</td>
                            <td style={{ padding: '9px 16px' }}><span className="tag">{item.variant_name}</span></td>
                            <td style={{ padding: '9px 16px' }}>₹{Number(item.rate).toFixed(2)}</td>
                            <td style={{ padding: '9px 16px' }}>{item.quantity}</td>
                            <td style={{ padding: '9px 16px', fontWeight: 700, color: 'var(--saffron-dark)' }}>₹{Number(item.amount).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )
        })}

      {paymentModal && (
        <PaymentModal order={paymentModal} onClose={() => setPaymentModal(null)} onSaved={onPaymentSaved} />
      )}
    </div>
  )
}
