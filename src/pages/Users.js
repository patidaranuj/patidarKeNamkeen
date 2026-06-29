import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

export default function Users() {
  const { user: currentUser, signUp } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', fullName: '', role: 'helper' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadUsers() }, [])

  async function loadUsers() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data || [])
    setLoading(false)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleCreate = async () => {
    if (!form.fullName.trim()) { toast.error('Name is required'); return }
    if (!form.email.trim()) { toast.error('Email is required'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    setSaving(true)
    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName, role: form.role } }
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Account created for ${form.fullName}`)
    setModalOpen(false)
    setForm({ email: '', password: '', fullName: '', role: 'helper' })
    setTimeout(loadUsers, 1000)
  }

  const updateRole = async (userId, newRole) => {
    if (userId === currentUser.id) { toast.error("You can't change your own role"); return }
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    if (error) { toast.error('Failed to update role'); return }
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
    toast.success('Role updated')
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-left">
          <h2>Users</h2>
          <p>Manage who can access this app</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>+ Add User</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" /></div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Change Role</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, background: 'var(--saffron-light)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--saffron)', fontSize: '0.85rem', flexShrink: 0 }}>
                          {(u.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.full_name || '—'}</div>
                          {u.id === currentUser.id && <span style={{ fontSize: '0.72rem', color: 'var(--warm-gray)' }}>You</span>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge badge-${u.role}`}>{u.role}</span>
                    </td>
                    <td style={{ color: 'var(--warm-gray)', fontSize: '0.85rem' }}>
                      {new Date(u.created_at).toLocaleDateString('en-IN')}
                    </td>
                    <td>
                      {u.id !== currentUser.id ? (
                        <select
                          value={u.role}
                          onChange={e => updateRole(u.id, e.target.value)}
                          style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 6, fontFamily: 'inherit', outline: 'none' }}
                        >
                          <option value="helper">Helper</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: 'var(--warm-gray)' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--warm-gray)' }}>
            💡 <strong>Admin</strong> can manage users and has full access. <strong>Helper</strong> can take orders and view data but cannot manage users.
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-title">Create New User</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="field">
                <label>Full Name *</label>
                <input type="text" placeholder="User's full name" value={form.fullName} onChange={e => set('fullName', e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label>Email *</label>
                <input type="email" placeholder="user@example.com" value={form.email} onChange={e => set('email', e.target.value)} />
              </div>
              <div className="form-grid">
                <div className="field">
                  <label>Password *</label>
                  <input type="password" placeholder="Min 6 characters" value={form.password} onChange={e => set('password', e.target.value)} />
                </div>
                <div className="field">
                  <label>Role</label>
                  <select value={form.role} onChange={e => set('role', e.target.value)}>
                    <option value="helper">Helper</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleCreate}>
                {saving ? '⏳ Creating…' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
