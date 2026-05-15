import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function Layout({ children, navItems, title }) {
  const { profile, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isAdmin        = profile?.role === 'admin'
  const inInventory    = location.pathname.startsWith('/inventory')
  const switchTo       = inInventory ? '/admin' : '/inventory'
  const switchLabel    = inInventory ? 'Admin Panel' : 'Inventory'
  const switchIcon     = inInventory ? '🛡️' : '📦'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
    toast.success('Logged out')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">💧</span>
            <span className="font-black text-aqua-700 text-sm hidden sm:block">Friends Aqua Care</span>
            <span className="text-gray-300 hidden sm:block">|</span>
            <span className="font-semibold text-gray-700 text-sm">{title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 hidden sm:block">{profile?.name}</span>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="w-8 h-8 rounded-full bg-aqua-100 flex items-center justify-center text-aqua-700 font-bold text-sm"
            >
              {profile?.name?.[0]?.toUpperCase() || 'U'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 max-w-6xl mx-auto w-full">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 py-6 px-3 gap-1 sticky top-14 h-[calc(100vh-3.5rem)]">
          {/* profile badge */}
          <div className="px-3 pb-4 mb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-aqua-100 flex items-center justify-center font-bold text-aqua-700 text-sm flex-shrink-0">
                {profile?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-800 text-sm truncate">{profile?.name}</p>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-0.5 ${
                  profile?.role === 'admin'             ? 'bg-purple-100 text-purple-700' :
                  profile?.role === 'inventory_manager' ? 'bg-blue-100 text-blue-700' :
                  profile?.role === 'technician'        ? 'bg-aqua-100 text-aqua-700' :
                                                          'bg-green-100 text-green-700'
                }`}>
                  {profile?.role?.replace('_', ' ')}
                </span>
              </div>
            </div>
          </div>
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition ${
                  isActive ? 'bg-aqua-50 text-aqua-700' : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
          <div className="mt-auto space-y-1">
            {/* Admin ↔ Inventory switch — only for admin role */}
            {isAdmin && (
              <button
                onClick={() => navigate(switchTo)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-aqua-600 bg-aqua-50 hover:bg-aqua-100 transition"
              >
                <span className="text-lg">{switchIcon}</span>
                Switch to {switchLabel}
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition"
            >
              <span className="text-lg">🚪</span> Logout
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 flex">
        {navItems.slice(0, isAdmin ? 3 : 4).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 text-xs font-medium transition ${
                isActive ? 'text-aqua-600' : 'text-gray-400'
              }`
            }
          >
            <span className="text-xl">{item.icon}</span>
            <span className="mt-0.5">{item.label}</span>
          </NavLink>
        ))}
        {/* Switch panel button for admin */}
        {isAdmin && (
          <button
            onClick={() => navigate(switchTo)}
            className="flex-1 flex flex-col items-center py-2 text-xs font-medium text-aqua-500"
          >
            <span className="text-xl">{switchIcon}</span>
            <span className="mt-0.5">{switchLabel}</span>
          </button>
        )}
        <button
          onClick={handleLogout}
          className="flex-1 flex flex-col items-center py-2 text-xs font-medium text-red-400"
        >
          <span className="text-xl">🚪</span>
          <span className="mt-0.5">Logout</span>
        </button>
      </nav>
    </div>
  )
}
