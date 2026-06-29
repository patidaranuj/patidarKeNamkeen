import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const EMPTY = { name: '', owner_name: '', phone: '', area: '', address: '', gstin: '', credit_limit: '' }

export default function Retailers() {
  const { user } = useAuth()
  const [retailers, setRetailers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [orderStats, setOrderStats] = useState({})

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('retailers').select('*').order('name')
    setRetailers(data || [])
    const { data: orders } = await supabase.from('orders').select('retailer_id, total, amount_paid, payment_status')
    const stats = {}
    ;(orders || []).forEach(o => {
      if (!o.retailer_id) return
      if (!stats[o.retailer_id]) stats[o.retailer_id] = { count: 0, revenue: 0, paid: 0, pending: 0 }
      stats[o.retailer_id].count++
      stats[o.retailer_id].revenue += Number(o.total)
      stats[o.retailer_id].paid += Number(o.amount_paid || 0)
      stats[o.retailer_id].pending += Number(o.total) - Number(o.amount_paid || 0)
    })
    setOrderStats(stats)
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const openAdd = () => { setEditing(null); setForm(EMPTY); setModalOpen(true) }
  const openEdit = (r) => {
    setEditing(r.id)
    setForm({ name: r.name, owner_name: r.owner_name || '', phone: r.phone || '', area: r.area || '', address: r.address || '', gstin: r.gstin || '', credit_limit: r.credit_limit || '' })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Shop name is required'); return }
    setSaving(true)
    const payload = { name: form.name.trim(), owner_name: form.owner_name.trim(), phone: form.phone.trim(), area: form.area.trim(), address: form.address.trim(), gstin: form.gstin.trim(), credit_limit: parseFloat(form.credit_limit) || 0 }
    if (editing) {
      const { error } = await supabase.from('retailers').update(payload).eq('id', editing)
      if (error) { toast.error('Failed: ' + error.message); setSaving(false); return }
      toast.success('Retailer updated ✓')
    } else {
      const { error } = await supabase.from('retailers').insert({ ...payload, created_by: user.id })
      if (error) { toast.error('Failed: ' + error.message); setSaving(false); return }
      toast.success('Retailer added ✓')
    }
    setSaving(false); setModalOpen(false); loadData()
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    const { error } = await supabase.from('retailers').delete().eq('id', id)
    if (error) { toast.error('Cannot delete'); return }
    toast.success('Deleted')
    setRetailers(prev => prev.filter(r => r.id !== id))
  }

  const filtered = retailers.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.area || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left"><h2>Retailers</h2><p>{retailers.length} retailers in your network</p></div>
        <button className="btn btn-primary" onClick={openAdd}>+ Add Retailer</button>
      </div>
      <div className="search-row">
        <input className="search-input" placeholder="Search by name or area…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
        : filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">🏪</div><div className="empty-title">{search ? 'No results' : 'No retailers yet'}</div></div>
        ) : (
          <div className="retailer-grid">
            {filtered.map(r => {
              const initials = r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
              const stats = orderStats[r.id] || { count: 0, revenue: 0, paid: 0, pending: 0 }
              return (
                <div key={r.id} className="retailer-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="rc-avatar">{initials}</div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{r.name}</div>
                      {r.area && <div style={{ fontSize: '0.8rem', color: 'var(--warm-gray)' }}>{r.area}</div>}
                    </div>
                  </div>
                  <div className="rc-meta">
                    {r.phone && <span>📞 {r.phone}</span>}
                    {r.owner_name && <span>👤 {r.owner_name}</span>}
                    {r.address && <span>📍 {r.address}</span>}
                    {r.gstin && <span>🔖 {r.gstin}</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: '0.78rem' }}>
                    <div style={{ background: 'var(--cream)', borderRadius: 6, padding: '5px 8px' }}>
                      <div style={{ color: 'var(--warm-gray)' }}>Orders</div>
                      <div style={{ fontWeight: 700 }}>{stats.count}</div>
                    </div>
                    <div style={{ background: 'var(--cream)', borderRadius: 6, padding: '5px 8px' }}>
                      <div style={{ color: 'var(--warm-gray)' }}>Billed</div>
                      <div style={{ fontWeight: 700, color: 'var(--saffron)' }}>₹{stats.revenue.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ background: '#E8F5E9', borderRadius: 6, padding: '5px 8px' }}>
                      <div style={{ color: '#2E7D32', fontSize: '0.72rem' }}>Paid</div>
                      <div style={{ fontWeight: 700, color: '#2E7D32' }}>₹{stats.paid.toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ background: stats.pending > 0 ? '#FFEBEE' : '#E8F5E9', borderRadius: 6, padding: '5px 8px' }}>
                      <div style={{ color: stats.pending > 0 ? '#C62828' : '#2E7D32', fontSize: '0.72rem' }}>Pending</div>
                      <div style={{ fontWeight: 700, color: stats.pending > 0 ? '#C62828' : '#2E7D32' }}>₹{stats.pending.toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => openEdit(r)}>✏️ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id, r.name)}>🗑 Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal">
            <div className="modal-title">{editing ? 'Edit Retailer' : 'Add Retailer'}</div>
            <div className="form-grid" style={{ gap: 14 }}>
              <div className="field form-full"><label>Shop Name *</label><input type="text" value={form.name} onChange={e => set('name', e.target.value)} autoFocus placeholder="Shop name" /></div>
              <div className="field"><label>Owner Name</label><input type="text" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} placeholder="Owner" /></div>
              <div className="field"><label>Phone</label><input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Phone number" /></div>
              <div className="field"><label>Area / Village</label><input type="text" value={form.area} onChange={e => set('area', e.target.value)} placeholder="Area" /></div>
              <div className="field"><label>Credit Limit (₹)</label><input type="number" value={form.credit_limit} onChange={e => set('credit_limit', e.target.value)} placeholder="0" /></div>
              <div className="field form-full"><label>Address</label><input type="text" value={form.address} onChange={e => set('address', e.target.value)} placeholder="Full address" /></div>
              <div className="field form-full"><label>GSTIN</label><input type="text" value={form.gstin} onChange={e => set('gstin', e.target.value)} placeholder="GST number" /></div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? '⏳…' : editing ? 'Save' : 'Add Retailer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
