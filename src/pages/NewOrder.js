import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const PAYMENT_OPTIONS = [
  { value: 'unpaid', label: 'Unpaid', color: '#C62828', bg: '#FFEBEE' },
  { value: 'partial', label: 'Partial Paid', color: '#E65100', bg: '#FFF3E0' },
  { value: 'paid', label: 'Fully Paid', color: '#2E7D32', bg: '#E8F5E9' },
]

export default function NewOrder() {
  const { user } = useAuth()
  const [retailers, setRetailers] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [variants, setVariants] = useState([])
  const [selectedRetailer, setSelectedRetailer] = useState('')
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0])
  const [slot, setSlot] = useState('morning')
  const [notes, setNotes] = useState('')
  const [quantities, setQuantities] = useState({})
  const [saving, setSaving] = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [amountPaid, setAmountPaid] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [r, c, p, v] = await Promise.all([
      supabase.from('retailers').select('*').eq('is_active', true).order('name'),
      supabase.from('product_categories').select('*').order('sort_order'),
      supabase.from('products').select('*').eq('is_active', true).order('sort_order').order('name'),
      supabase.from('product_variants').select('*').eq('is_active', true).order('sort_order').order('variant_name'),
    ])
    setRetailers(r.data || [])
    setCategories(c.data || [])
    setProducts(p.data || [])
    setVariants(v.data || [])
    if (c.data?.length) setActiveCategory(c.data[0].id)
  }

  const setQty = (variantId, val) => {
    const num = parseFloat(val) || 0
    setQuantities(q => ({ ...q, [variantId]: num < 0 ? 0 : num }))
  }

  const getVariantsForProduct = (productId) => variants.filter(v => v.product_id === productId)
  const getAmount = (v) => (quantities[v.id] || 0) * Number(v.retailer_rate)
  const grandTotal = variants.reduce((s, v) => s + getAmount(v), 0)
  const orderedVariants = variants.filter(v => (quantities[v.id] || 0) > 0)

  const productsByCategory = useMemo(() => {
    const map = {}
    categories.forEach(c => { map[c.id] = [] })
    map['none'] = []
    products.forEach(p => {
      const key = p.category_id || 'none'
      if (!map[key]) map[key] = []
      map[key].push(p)
    })
    return map
  }, [categories, products])

  // When payment status changes, reset amount paid
  const handlePaymentStatusChange = (status) => {
    setPaymentStatus(status)
    if (status === 'paid') setAmountPaid(grandTotal.toFixed(2))
    else if (status === 'unpaid') setAmountPaid('0')
    else setAmountPaid('')
  }

  const handleSave = async () => {
    if (!selectedRetailer) { toast.error('Select a retailer'); return }
    if (!orderDate) { toast.error('Select a date'); return }
    if (!orderedVariants.length) { toast.error('Add at least one quantity'); return }
    if (paymentStatus === 'partial') {
      const paid = parseFloat(amountPaid) || 0
      if (paid <= 0 || paid >= grandTotal) { toast.error('Enter a partial amount between 0 and total'); return }
    }

    const paid = paymentStatus === 'paid' ? grandTotal : paymentStatus === 'unpaid' ? 0 : parseFloat(amountPaid) || 0

    const items = orderedVariants.map(v => {
      const prod = products.find(p => p.id === v.product_id)
      return {
        variant_id: v.id,
        product_name: prod?.name || '',
        product_english_name: prod?.english_name || prod?.name || '',
        variant_name: v.variant_name,
        variant_english_name: v.english_variant_name || v.variant_name,
        unit: v.unit,
        rate: Number(v.retailer_rate),
        quantity: quantities[v.id],
        amount: getAmount(v),
      }
    })

    setSaving(true)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        retailer_id: selectedRetailer,
        order_date: orderDate,
        slot,
        total: grandTotal,
        notes,
        payment_status: paymentStatus,
        amount_paid: paid,
        created_by: user.id,
      })
      .select().single()

    if (orderError) { toast.error('Failed: ' + orderError.message); setSaving(false); return }

    const { error: itemsError } = await supabase.from('order_items').insert(items.map(i => ({ ...i, order_id: order.id })))
    setSaving(false)
    if (itemsError) { toast.error('Items failed: ' + itemsError.message); return }

    toast.success(`Order saved! ${slot === 'morning' ? '☀️' : '🌙'} ${paymentStatus === 'paid' ? '✅ Paid' : paymentStatus === 'partial' ? '⚡ Partial' : '⏳ Unpaid'}`)
    setSelectedRetailer(''); setNotes(''); setQuantities({})
    setPaymentStatus('unpaid'); setAmountPaid('')
    setOrderDate(new Date().toISOString().split('T')[0])
  }

  const retailerInfo = retailers.find(r => r.id === selectedRetailer)
  const activeCategoryProducts = productsByCategory[activeCategory] || []
  const paidDisplay = paymentStatus === 'paid' ? grandTotal : parseFloat(amountPaid) || 0
  const pendingDisplay = grandTotal - paidDisplay

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>New Order</h2>
          <p>Select retailer, slot, quantities and payment status</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Left: Retailer + Slot */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 14 }}>Retailer & Slot</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label>Select Retailer *</label>
              <select value={selectedRetailer} onChange={e => setSelectedRetailer(e.target.value)}>
                <option value="">— Choose retailer —</option>
                {retailers.map(r => <option key={r.id} value={r.id}>{r.name}{r.area ? ` (${r.area})` : ''}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Order Slot</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['morning', '☀️ Morning'], ['evening', '🌙 Evening']].map(([val, label]) => (
                  <button key={val} onClick={() => setSlot(val)} className={slot === val ? 'btn btn-primary' : 'btn btn-ghost'} style={{ flex: 1 }}>{label}</button>
                ))}
              </div>
            </div>
            {retailerInfo && (
              <div style={{ padding: '10px 12px', background: 'var(--saffron-light)', borderRadius: 8, fontSize: '0.83rem' }}>
                {retailerInfo.phone && <div>📞 {retailerInfo.phone}</div>}
                {retailerInfo.area && <div>📍 {retailerInfo.area}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Right: Details + Payment */}
        <div className="card">
          <div style={{ fontWeight: 700, marginBottom: 14 }}>Order Details & Payment</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-grid">
              <div className="field">
                <label>Order Date *</label>
                <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
              </div>
              <div className="field">
                <label>Notes (optional)</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any note…" />
              </div>
            </div>

            {/* Payment status */}
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--warm-gray)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>Payment Status</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {PAYMENT_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => handlePaymentStatusChange(opt.value)}
                    style={{ flex: 1, padding: '8px 6px', border: `2px solid ${paymentStatus === opt.value ? opt.color : 'var(--border)'}`, borderRadius: 8, background: paymentStatus === opt.value ? opt.bg : '#fff', color: paymentStatus === opt.value ? opt.color : 'var(--warm-gray)', fontWeight: 700, cursor: 'pointer', fontSize: '0.78rem', transition: 'all 0.15s' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Partial amount input */}
            {paymentStatus === 'partial' && (
              <div className="field">
                <label>Amount Paid (₹) *</label>
                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                  placeholder="Enter amount received" min="0" max={grandTotal} step="0.01" />
              </div>
            )}

            {/* Running totals */}
            {orderedVariants.length > 0 && (
              <div style={{ background: 'var(--deep-brown)', color: '#fff', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.78rem', opacity: 0.65 }}>Order Total</span>
                  <span style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 800, color: 'var(--saffron)', fontSize: '1.2rem' }}>₹{grandTotal.toFixed(2)}</span>
                </div>
                {paymentStatus !== 'unpaid' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ opacity: 0.65 }}>Paid</span>
                      <span style={{ color: '#81C784' }}>₹{paidDisplay.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                      <span style={{ opacity: 0.65 }}>Pending</span>
                      <span style={{ color: '#EF9A9A' }}>₹{pendingDisplay.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Category tabs + product table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--cream)' }}>
          {categories.map(cat => {
            const catProducts = productsByCategory[cat.id] || []
            const catVariants = variants.filter(v => catProducts.some(p => p.id === v.product_id))
            const filled = catVariants.filter(v => (quantities[v.id] || 0) > 0).length
            return (
              <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                style={{ padding: '12px 18px', border: 'none', borderBottom: activeCategory === cat.id ? '2px solid var(--saffron)' : '2px solid transparent', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: activeCategory === cat.id ? 700 : 400, color: activeCategory === cat.id ? 'var(--saffron)' : 'var(--warm-gray)', whiteSpace: 'nowrap', fontSize: '0.88rem', transition: 'all 0.15s' }}>
                {cat.name}
                {filled > 0 && <span style={{ marginLeft: 6, background: 'var(--saffron)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '0.7rem' }}>{filled}</span>}
              </button>
            )
          })}
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--deep-brown)' }}>
              {['Product', 'Variant / Size', 'Rate (₹)', 'Qty', 'Amount (₹)'].map((h, i) => (
                <th key={h} style={{ padding: '10px 16px', textAlign: i >= 2 ? (i === 2 ? 'left' : i === 3 ? 'center' : 'right') : 'left', color: '#fff', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeCategoryProducts.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: 'var(--warm-gray)' }}>No products in this category</td></tr>
            ) : activeCategoryProducts.map(prod => {
              const pvs = getVariantsForProduct(prod.id)
              return pvs.map((v, vi) => {
                const qty = quantities[v.id] || 0
                const amt = qty * Number(v.retailer_rate)
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid var(--border)', background: qty > 0 ? 'var(--saffron-light)' : vi % 2 === 0 ? '#fff' : 'var(--milk-white)' }}>
                    <td style={{ padding: '9px 16px', fontWeight: vi === 0 ? 600 : 400, color: vi === 0 ? 'var(--deep-brown)' : 'transparent', fontSize: '0.9rem' }}>
                      {vi === 0 ? prod.name : ''}
                    </td>
                    <td style={{ padding: '9px 16px' }}><span className="tag">{v.variant_name}</span></td>
                    <td style={{ padding: '9px 16px', fontSize: '0.9rem' }}>₹{Number(v.retailer_rate).toFixed(2)}</td>
                    <td style={{ padding: '9px 16px', textAlign: 'center' }}>
                      <input type="number" min="0" step="1" value={quantities[v.id] || ''} placeholder="0"
                        onChange={e => setQty(v.id, e.target.value)}
                        style={{ width: 80, padding: '5px 8px', border: `1.5px solid ${qty > 0 ? 'var(--saffron)' : 'var(--border)'}`, borderRadius: 7, textAlign: 'center', fontFamily: 'inherit', fontSize: '0.9rem', outline: 'none', background: qty > 0 ? '#fff' : 'var(--milk-white)' }}
                      />
                    </td>
                    <td style={{ padding: '9px 16px', textAlign: 'right', fontWeight: qty > 0 ? 700 : 400, color: qty > 0 ? 'var(--saffron-dark)' : 'var(--warm-gray)' }}>
                      {qty > 0 ? `₹${amt.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                )
              })
            })}
          </tbody>
        </table>
      </div>

      {/* Total bar */}
      <div className="order-total-bar" style={{ marginTop: 16 }}>
        <div>
          <div className="order-total-label">{slot === 'morning' ? '☀️ Morning' : '🌙 Evening'} · {retailerInfo?.name || 'No retailer'}</div>
          <div className="order-total-amount">₹{grandTotal.toFixed(2)}</div>
          <div className="order-total-label">{orderedVariants.length} items</div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => setQuantities({})}>Clear</button>
          <button className="btn btn-success btn-lg" disabled={saving} onClick={handleSave}>
            {saving ? '⏳ Saving…' : '✓ Save Order'}
          </button>
        </div>
      </div>
    </div>
  )
}
