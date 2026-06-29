import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const NAV = [
  { path: '/', icon: '📊', label: 'Dashboard', section: 'main' },
  { path: '/new-order', icon: '🧾', label: 'New Order', section: 'main' },
  { path: '/orders', icon: '📋', label: 'All Orders', section: 'main' },
  { path: '/daily-summary', icon: '📅', label: 'Daily Summary', section: 'main' },
  { path: '/retailers', icon: '🏪', label: 'Retailers', section: 'manage' },
  { path: '/products', icon: '🥛', label: 'Products & Variants', section: 'manage' },
  { path: '/users', icon: '👥', label: 'Users', section: 'admin', adminOnly: true },
]

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => { await signOut(); toast.success('Signed out'); navigate('/login') }
  const initials = (profile?.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const currentTitle = NAV.find(n => n.path === location.pathname)?.label || 'Dashboard'
  const filteredNav = NAV.filter(n => !n.adminOnly || isAdmin)
  const sections = ['main', 'manage', ...(isAdmin ? ['admin'] : [])]
  const sectionLabels = { main: 'Operations', manage: 'Manage', admin: 'Admin' }

  function SidebarContent() {
    return (
      <>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">🥛</div>
          <div><h1>Patidar K Namkeen</h1><span>Milk Distribution</span></div>
        </div>
        <nav className="sidebar-nav">
          {sections.map(section => (
            <div key={section}>
              <div className="nav-section-label">{sectionLabels[section]}</div>
              {filteredNav.filter(n => n.section === section).map(item => (
                <button key={item.path}
                  className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                  onClick={() => { navigate(item.path); setSidebarOpen(false) }}>
                  <span className="nav-item-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{initials}</div>
            <div><div className="user-name">{profile?.full_name || 'User'}</div><div className="user-role">{profile?.role || 'helper'}</div></div>
          </div>
          <button className="nav-item" onClick={handleSignOut} style={{ color: 'rgba(255,100,100,0.8)' }}>
            <span className="nav-item-icon">🚪</span>Sign Out
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="app-layout">
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>☰</button>
          <span style={{ fontFamily: "'Baloo 2', cursive", fontWeight: 700 }}>PKN Milk</span>
        </div>
        <span style={{ fontSize: '0.85rem', opacity: 0.75 }}>{currentTitle}</span>
      </div>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}><SidebarContent /></aside>
      <div className="main-content">
        <div className="topbar">
          <div className="topbar-title">{currentTitle}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--warm-gray)' }}>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </div>
        <div className="page-content"><Outlet /></div>
      </div>
    </div>
  )
}
