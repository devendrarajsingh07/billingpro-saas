import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  CreditCard,
  BarChart3,
  Settings,
  History,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Truck,
  ClipboardList,
  Boxes
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { logout, company } = useAuth()

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Invoices', path: '/invoices', icon: FileText },
    { label: 'Customers', path: '/customers', icon: Users },
    { label: 'Products & Stock', path: '/products', icon: Package },
    { label: 'Inventory', path: '/inventory', icon: Boxes },
    { label: 'Suppliers', path: '/suppliers', icon: Truck },
    { label: 'Purchase Orders', path: '/purchase-orders', icon: ClipboardList },
    { label: 'Payments', path: '/payments', icon: CreditCard },
    { label: 'Reports', path: '/reports', icon: BarChart3 },
    { label: 'Audit Trail', path: '/activity', icon: History },
    { label: 'Settings', path: '/settings', icon: Settings },
  ]

  return (
    <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <span className="sidebar-logo-text">BillingPro</span>
      </div>

      {!collapsed && (
        <div className="px-4 py-3 flex flex-col gap-0.5 border-b border-white/5">
          <span className="text-xs font-bold text-slate-100 truncate-text">
            {company?.name || 'My Company'}
          </span>
          <span className="text-[10px] font-semibold text-slate-400">
            Enterprise Plan
          </span>
        </div>
      )}

      <div className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon className="h-5 w-5" />
              <span className="nav-label">{item.label}</span>
            </Link>
          )
        })}
      </div>

      <div className="sidebar-footer">
        <button onClick={logout} className="nav-item w-full bg-transparent border-none text-left">
          <LogOut className="h-5 w-5 text-rose-400" />
          <span className="nav-label text-rose-400 font-semibold">Sign Out</span>
        </button>
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="nav-item w-full bg-transparent border-none flex justify-center py-2"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4 text-slate-500" />
          ) : (
            <div className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4 text-slate-500" />
              <span className="nav-label text-slate-500 text-xs font-medium">Collapse Navigation</span>
            </div>
          )}
        </button>
      </div>
    </div>
  )
}
