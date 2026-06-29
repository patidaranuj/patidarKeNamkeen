import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewOrder from './pages/NewOrder'
import Orders from './pages/Orders'
import DailySummary from './pages/DailySummary'
import Retailers from './pages/Retailers'
import Products from './pages/Products'
import Users from './pages/Users'
import './index.css'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner" /><span>Loading…</span></div>
  return user ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div className="loading-page"><div className="spinner" /></div>
  if (!user) return <Navigate to="/login" replace />
  if (profile?.role !== 'admin') return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="new-order" element={<NewOrder />} />
        <Route path="orders" element={<Orders />} />
        <Route path="daily-summary" element={<DailySummary />} />
        <Route path="retailers" element={<Retailers />} />
        <Route path="products" element={<Products />} />
        <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="bottom-right" toastOptions={{
          style: { background: '#3B2007', color: '#fff', fontFamily: "'Noto Sans', sans-serif", fontSize: '0.9rem', borderRadius: '10px' },
          success: { iconTheme: { primary: '#E8841A', secondary: '#fff' } },
          error: { style: { background: '#C62828' } },
        }} />
      </AuthProvider>
    </BrowserRouter>
  )
}
