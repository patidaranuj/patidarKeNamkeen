import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', fullName: '', confirmPassword: '' })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleLogin = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) { toast.error('Enter email and password'); return }
    setLoading(true)
    const { error } = await signIn(form.email, form.password)
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('Welcome back!')
    navigate('/')
  }

  const handleSignup = async (e) => {
    e.preventDefault()
    if (!form.fullName) { toast.error('Enter your name'); return }
    if (!form.email) { toast.error('Enter your email'); return }
    if (form.password.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (form.password !== form.confirmPassword) { toast.error('Passwords do not match'); return }
    setLoading(true)
    const { error } = await signIn(form.email, form.password)
      .catch(() => {}) // will fail for new users
    if (!error) { navigate('/'); return }
    // Try signup
    const { signUp } = useAuth()
    const { error: signUpError } = await signUp(form.email, form.password, form.fullName, 'helper')
    setLoading(false)
    if (signUpError) { toast.error(signUpError.message); return }
    toast.success('Account created! You can now sign in.')
    setMode('login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--cream)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64,
            background: 'var(--deep-brown)',
            borderRadius: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 32, margin: '0 auto 14px',
          }}>🥛</div>
          <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: '1.6rem', fontWeight: 800, color: 'var(--deep-brown)' }}>
            Patidar K Namkeen
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--warm-gray)', marginTop: 2 }}>
            Milk Distribution Management
          </div>
        </div>

        <div className="card">
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: "'Baloo 2', cursive", fontSize: '1.3rem', fontWeight: 700 }}>
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--warm-gray)', marginTop: 3 }}>
              {mode === 'login' ? 'Welcome back! Enter your credentials.' : 'New user? Set up your account.'}
            </div>
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'signup' && (
              <div className="field">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="Your full name"
                  value={form.fullName}
                  onChange={e => set('fullName', e.target.value)}
                  autoFocus
                />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                autoFocus={mode === 'login'}
              />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => set('password', e.target.value)}
              />
            </div>
            {mode === 'signup' && (
              <div className="field">
                <label>Confirm Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={form.confirmPassword}
                  onChange={e => set('confirmPassword', e.target.value)}
                />
              </div>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? '⏳ Please wait…' : mode === 'login' ? '→ Sign In' : '→ Create Account'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: '0.85rem', color: 'var(--warm-gray)' }}>
            {mode === 'login' ? (
              <>Don't have an account?{' '}
                <button
                  onClick={() => setMode('signup')}
                  style={{ background: 'none', border: 'none', color: 'var(--saffron)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign up
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button
                  onClick={() => setMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--saffron)', fontWeight: 600, cursor: 'pointer' }}
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: '0.75rem', color: 'var(--warm-gray)' }}>
          Secured by Supabase · Data synced across all devices
        </div>
      </div>
    </div>
  )
}
