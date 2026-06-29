import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const UNITS = ['litre','ml','gm','kg','pack','piece','jar','dozen']
const EMPTY_PRODUCT = { name: '', english_name: '', category_id: '', is_active: true }
const EMPTY_VARIANT = { variant_name: '', english_variant_name: '', unit: 'litre', retailer_rate: '', mrp: '', sort_order: 0 }

export default function Products() {
  const { user } = useAuth()
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [variants, setVariants] = useState({})
  const [loading, setLoading] = useState(true)
  const [expandedProduct, setExpandedProduct] = useState(null)
  const [productModal, setProductModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT)
  const [variantModal, setVariantModal] = useState(false)
  const [editingVariant, setEditingVariant] = useState(null)
  const [variantParentId, setVariantParentId] = useState(null)
  const [variantForm, setVariantForm] = useState(EMPTY_VARIANT)
  const [catModal, setCatModal] = useState(false)
  const [catName, setCatName] = useState('')
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const [catRes, prodRes, varRes] = await Promise.all([
      supabase.from('product_categories').select('*').order('sort_order'),
      supabase.from('products').select('*, product_categories(name)').order('sort_order').order('name'),
      supabase.from('product_variants').select('*').order('sort_order').order('variant_name'),
    ])
    setCategories(catRes.data || [])
    setProducts(prodRes.data || [])
    const vMap = {}
    ;(varRes.data || []).forEach(v => { if (!vMap[v.product_id]) vMap[v.product_id] = []; vMap[v.product_id].push(v) })
    setVariants(vMap)
    setLoading(false)
  }

  const saveCategory = async () => {
    if (!catName.trim()) { toast.error('Enter category name'); return }
    await supabase.from('product_categories').insert({ name: catName.trim(), sort_order: categories.length })
    toast.success('Category added'); setCatModal(false); setCatName(''); loadAll()
  }

  const openAddProduct = () => { setEditingProduct(null); setProductForm(EMPTY_PRODUCT); setProductModal(true) }
  const openEditProduct = (p) => { setEditingProduct(p.id); setProductForm({ name: p.name, english_name: p.english_name || '', category_id: p.category_id || '', is_active: p.is_active }); setProductModal(true) }

  const saveProduct = async () => {
    if (!productForm.name.trim()) { toast.error('Product name required'); return }
    setSaving(true)
    const payload = { name: productForm.name.trim(), english_name: productForm.english_name.trim() || null, category_id: productForm.category_id || null, is_active: productForm.is_active }
    if (editingProduct) {
      await supabase.from('products').update(payload).eq('id', editingProduct)
      toast.success('Product updated')
    } else {
      await supabase.from('products').insert({ ...payload, created_by: user.id })
      toast.success('Product added')
    }
    setSaving(false); setProductModal(false); loadAll()
  }

  const deleteProduct = async (id, name) => {
    if (!window.confirm(`Delete "${name}" and ALL its variants?`)) return
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) { toast.error('Cannot delete — may be used in orders'); return }
    toast.success('Deleted'); loadAll()
  }

  const openAddVariant = (productId) => { setEditingVariant(null); setVariantParentId(productId); setVariantForm(EMPTY_VARIANT); setVariantModal(true) }
  const openEditVariant = (v) => { setEditingVariant(v.id); setVariantParentId(v.product_id); setVariantForm({ variant_name: v.variant_name, english_variant_name: v.english_variant_name || '', unit: v.unit, retailer_rate: v.retailer_rate, mrp: v.mrp || '', sort_order: v.sort_order }); setVariantModal(true) }

  const saveVariant = async () => {
    if (!variantForm.variant_name.trim()) { toast.error('Variant name required'); return }
    if (!variantForm.retailer_rate) { toast.error('Rate required'); return }
    setSaving(true)
    const payload = { variant_name: variantForm.variant_name.trim(), english_variant_name: variantForm.english_variant_name.trim() || null, unit: variantForm.unit, retailer_rate: parseFloat(variantForm.retailer_rate), mrp: parseFloat(variantForm.mrp) || null, sort_order: parseInt(variantForm.sort_order) || 0 }
    if (editingVariant) {
      await supabase.from('product_variants').update(payload).eq('id', editingVariant)
      toast.success('Variant updated')
    } else {
      await supabase.from('product_variants').insert({ ...payload, product_id: variantParentId })
      toast.success('Variant added')
    }
    setSaving(false); setVariantModal(false); loadAll()
  }

  const deleteVariant = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    const { error } = await supabase.from('product_variants').delete().eq('id', id)
    if (error) { toast.error('Cannot delete — may be used in orders'); return }
    toast.success('Deleted'); loadAll()
  }

  const toggleVariantActive = async (v) => {
    await supabase.from('product_variants').update({ is_active: !v.is_active }).eq('id', v.id)
    loadAll()
  }

  const filtered = products.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.english_name || '').toLowerCase().includes(search.toLowerCase())) &&
    (!filterCat || p.category_id === filterCat)
  )

  const grouped = categories.reduce((acc, cat) => {
    const prods = filtered.filter(p => p.category_id === cat.id)
    if (prods.length) acc.push({ cat, prods })
    return acc
  }, [])
  const uncategorized = filtered.filter(p => !p.category_id)
  if (uncategorized.length) grouped.push({ cat: { id: 'none', name: 'Uncategorized' }, prods: uncategorized })

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Products & Variants</h2>
          <p>Set English names for PDF bills to display correctly</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setCatModal(true)}>+ Category</button>
          <button className="btn btn-primary" onClick={openAddProduct}>+ Product</button>
        </div>
      </div>

      <div style={{ background: '#FFF8E1', border: '1.5px solid #FFE082', borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: '0.85rem', color: '#E65100' }}>
        ⚠️ <strong>Important:</strong> jsPDF cannot render Hindi/Devanagari text. Please fill in the <strong>English Name</strong> field for every product and variant. This is what appears on printed bills.
      </div>

      <div className="search-row">
        <input className="search-input" placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={{ padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontFamily: 'inherit', outline: 'none', background: '#fff' }}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div> : (
        <div>
          {grouped.map(({ cat, prods }) => (
            <div key={cat.id} style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, fontSize: '1.1rem', marginBottom: 10, color: 'var(--deep-brown)', borderBottom: '2px solid var(--saffron)', paddingBottom: 6, display: 'inline-block' }}>
                {cat.name}
              </div>
              {prods.map(p => (
                <div key={p.id} style={{ background: '#fff', border: '1.5px solid var(--border)', borderRadius: 10, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', flexWrap: 'wrap', gap: 8 }}
                    onClick={() => setExpandedProduct(expandedProduct === p.id ? null : p.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span>{expandedProduct === p.id ? '▼' : '▶'}</span>
                      <div>
                        <span style={{ fontWeight: 700 }}>{p.name}</span>
                        {p.english_name && <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--warm-gray)' }}>→ {p.english_name}</span>}
                        {!p.english_name && <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#FFEBEE', color: '#C62828', padding: '2px 7px', borderRadius: 10 }}>⚠ No English name</span>}
                        {!p.is_active && <span style={{ marginLeft: 8, fontSize: '0.72rem', background: '#eee', color: '#888', padding: '2px 7px', borderRadius: 10 }}>Hidden</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ fontSize: '0.78rem', color: 'var(--warm-gray)' }}>{(variants[p.id] || []).length} variants</span>
                      <button className="btn btn-outline btn-sm" onClick={e => { e.stopPropagation(); openAddVariant(p.id) }}>+ Variant</button>
                      <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); openEditProduct(p) }}>✏️</button>
                      <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); deleteProduct(p.id, p.name) }}>🗑</button>
                    </div>
                  </div>

                  {expandedProduct === p.id && (
                    <div style={{ borderTop: '1px solid var(--border)', background: 'var(--cream)' }}>
                      {!(variants[p.id] || []).length ? (
                        <div style={{ padding: '14px 20px', color: 'var(--warm-gray)', fontSize: '0.88rem' }}>
                          No variants. <button className="btn btn-outline btn-sm" style={{ marginLeft: 8 }} onClick={() => openAddVariant(p.id)}>+ Add First Variant</button>
                        </div>
                      ) : (
                        <div className="table-wrap" style={{ border: 'none', borderRadius: 0 }}>
                          <table>
                            <thead>
                              <tr>
                                <th>Variant (Hindi)</th>
                                <th>English Name (for PDF) ⚠</th>
                                <th>Unit</th>
                                <th>Retailer Rate (₹)</th>
                                <th>MRP (₹)</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(variants[p.id] || []).map(v => (
                                <tr key={v.id} style={{ opacity: v.is_active ? 1 : 0.5 }}>
                                  <td style={{ fontWeight: 600 }}>{v.variant_name}</td>
                                  <td>
                                    {v.english_variant_name
                                      ? <span style={{ color: '#2E7D32' }}>{v.english_variant_name}</span>
                                      : <span style={{ color: '#C62828', fontSize: '0.78rem' }}>⚠ Missing — edit to add</span>
                                    }
                                  </td>
                                  <td><span className="tag">{v.unit}</span></td>
                                  <td><span style={{ fontFamily: "'Baloo 2',cursive", fontWeight: 700, color: 'var(--saffron)' }}>₹{Number(v.retailer_rate).toFixed(2)}</span></td>
                                  <td style={{ color: 'var(--warm-gray)' }}>{v.mrp ? `₹${Number(v.mrp).toFixed(2)}` : '—'}</td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      <button className="btn btn-ghost btn-sm" onClick={() => openEditVariant(v)}>✏️ Edit</button>
                                      <button className="btn btn-ghost btn-sm" onClick={() => toggleVariantActive(v)}>{v.is_active ? '👁 Hide' : '👁 Show'}</button>
                                      <button className="btn btn-danger btn-sm" onClick={() => deleteVariant(v.id, v.variant_name)}>🗑</button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
          {filtered.length === 0 && <div className="empty-state"><div className="empty-icon">🥛</div><div className="empty-title">No products</div></div>}
        </div>
      )}

      {/* Product Modal */}
      {productModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setProductModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-title">{editingProduct ? 'Edit Product' : 'Add Product'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Product Name (Hindi/Any language)</label>
                <input type="text" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} autoFocus placeholder="e.g. हाईफेट / गोल्ड" />
              </div>
              <div className="field">
                <label>English Name * (used in PDF bills)</label>
                <input type="text" value={productForm.english_name} onChange={e => setProductForm(f => ({ ...f, english_name: e.target.value }))} placeholder="e.g. Highfat / Gold Milk" />
                <span style={{ fontSize: '0.75rem', color: 'var(--warm-gray)', marginTop: 2 }}>This is printed on bills — must be in English</span>
              </div>
              <div className="field">
                <label>Category</label>
                <select value={productForm.category_id} onChange={e => setProductForm(f => ({ ...f, category_id: e.target.value }))}>
                  <option value="">No category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={productForm.is_active} onChange={e => setProductForm(f => ({ ...f, is_active: e.target.checked }))} />
                Active (visible in orders)
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setProductModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={saveProduct}>{saving ? '⏳…' : editingProduct ? 'Save' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Variant Modal */}
      {variantModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setVariantModal(false)}>
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-title">{editingVariant ? 'Edit Variant' : 'Add Variant'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-grid">
                <div className="field">
                  <label>Variant Name (Hindi)</label>
                  <input type="text" value={variantForm.variant_name} onChange={e => setVariantForm(f => ({ ...f, variant_name: e.target.value }))} autoFocus placeholder="e.g. 1 लीटर" />
                </div>
                <div className="field">
                  <label>English Name * (for PDF)</label>
                  <input type="text" value={variantForm.english_variant_name} onChange={e => setVariantForm(f => ({ ...f, english_variant_name: e.target.value }))} placeholder="e.g. 1 Litre" />
                </div>
                <div className="field">
                  <label>Unit Type</label>
                  <select value={variantForm.unit} onChange={e => setVariantForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Sort Order</label>
                  <input type="number" value={variantForm.sort_order} onChange={e => setVariantForm(f => ({ ...f, sort_order: e.target.value }))} placeholder="0" />
                </div>
                <div className="field">
                  <label>Retailer Rate (₹) *</label>
                  <input type="number" value={variantForm.retailer_rate} onChange={e => setVariantForm(f => ({ ...f, retailer_rate: e.target.value }))} placeholder="0.00" step="0.01" />
                </div>
                <div className="field">
                  <label>MRP / Customer Rate (₹)</label>
                  <input type="number" value={variantForm.mrp} onChange={e => setVariantForm(f => ({ ...f, mrp: e.target.value }))} placeholder="0.00" step="0.01" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setVariantModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={saveVariant}>{saving ? '⏳…' : editingVariant ? 'Save' : 'Add Variant'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {catModal && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setCatModal(false)}>
          <div className="modal" style={{ maxWidth: 380 }}>
            <div className="modal-title">Add Category</div>
            <div className="field"><label>Category Name</label><input type="text" value={catName} onChange={e => setCatName(e.target.value)} autoFocus placeholder="e.g. Milk Products" /></div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setCatModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveCategory}>Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
