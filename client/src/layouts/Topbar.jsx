import React, { useState, useEffect, useRef } from 'react'
import { Search, Sun, Moon, Bell, User, Laptop, Package, FileText, CreditCard, ClipboardList, AlertCircle, ShoppingCart, Truck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Link, useNavigate } from 'react-router-dom'
import api from '../services/api'

const NOTIF_ICON = {
  low_stock: AlertCircle,
  invoice_created: FileText,
  invoice_paid: CreditCard,
  payment_received: CreditCard,
  purchase_order_received: ClipboardList,
}

const NOTIFICATION_ROUTES = {
  invoice: '/invoices',
  payment: '/payments',
  product: '/products',
  customer: '/customers',
  supplier: '/suppliers',
  purchase_order: '/purchase-orders',
}

function timeAgo(dateString) {
  const seconds = Math.floor((new Date() - new Date(dateString)) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function Topbar() {
  const { user, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState({ customers: [], invoices: [], products: [], suppliers: [], purchaseOrders: [], payments: [] })
  const [searching, setSearching] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const notifRef = useRef(null)

  const searchRef = useRef(null)
  const profileRef = useRef(null)

  // Handle outside click to close menus
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false)
      }
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false)
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadUnreadCount = async () => {
    try {
      const res = await api.get('/api/v1/notifications/unread-count')
      setUnreadCount(res.data.data?.count || 0)
    } catch (err) {
      // Silent — notifications are non-critical to the rest of the UI
    }
  }

  const loadNotifications = async () => {
    try {
      const res = await api.get('/api/v1/notifications?limit=8')
      setNotifications(res.data.data || [])
    } catch (err) {
      // Silent
    }
  }

  useEffect(() => {
    loadUnreadCount()
    const interval = setInterval(loadUnreadCount, 60000) // poll every minute
    return () => clearInterval(interval)
  }, [])

  const handleBellClick = () => {
    const opening = !notifOpen
    setNotifOpen(opening)
    if (opening) loadNotifications()
  }

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/api/v1/notifications/${id}/read`)
      setNotifications((prev) => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
      setUnreadCount((prev) => Math.max(0, prev - 1))
    } catch (err) {
      // Silent
    }
  }

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) await handleMarkRead(notification.id)
    setNotifOpen(false)
    const destination = NOTIFICATION_ROUTES[notification.entity_type]
    if (destination) navigate(destination)
  }

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/api/v1/notifications/read-all')
      setNotifications((prev) => prev.map(n => ({ ...n, is_read: 1 })))
      setUnreadCount(0)
    } catch (err) {
      // Silent
    }
  }

  // Search Everywhere trigger
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults({ customers: [], invoices: [], products: [], suppliers: [], purchaseOrders: [], payments: [] })
      return
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await api.get(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`)
        setSearchResults(res.data.data || { customers: [], invoices: [], products: [], suppliers: [], purchaseOrders: [], payments: [] })
      } catch (err) {
        console.error('[Search] Failed:', err)
      } finally {
        setSearching(false)
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [searchQuery])

  return (
    <div className="topbar">
      {/* ── Search Everywhere ── */}
      <div ref={searchRef} className="search-bar relative">
        <Search className="input-icon text-slate-400" />
        <input
          type="text"
          placeholder="Search everywhere (Invoice #, Customer, Product SKU...)"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value)
            setSearchOpen(true)
          }}
          onFocus={() => setSearchOpen(true)}
        />
        
        {/* Instant Search Results Dropdown */}
        {searchOpen && (searchQuery.trim().length >= 2) && (
          <div className="absolute top-[42px] left-0 w-[480px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
              {searching ? 'Searching records...' : 'Search Results'}
            </div>
            
            <div className="max-h-[360px] overflow-y-auto p-2 flex flex-col gap-3">
              {/* Invoices */}
              {searchResults.invoices?.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase">Invoices</div>
                  {searchResults.invoices.map((inv) => (
                    <Link
                      key={inv.id}
                      to="/invoices"
                      onClick={() => setSearchOpen(false)}
                      className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-indigo-400" />{inv.invoice_no}</span>
                      <span className="text-[10px] text-slate-400">{inv.customer_name}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Customers */}
              {searchResults.customers?.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase">Customers</div>
                  {searchResults.customers.map((cust) => (
                    <Link
                      key={cust.id}
                      to="/customers"
                      onClick={() => setSearchOpen(false)}
                      className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-1.5"><User className="h-3 w-3 text-emerald-400" />{cust.name}</span>
                      <span className="text-[10px] text-slate-400">{cust.email}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Products */}
              {searchResults.products?.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase">Products</div>
                  {searchResults.products.map((prod) => (
                    <Link
                      key={prod.id}
                      to="/products"
                      onClick={() => setSearchOpen(false)}
                      className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-1.5"><Package className="h-3 w-3 text-amber-400" />{prod.name}</span>
                      <span className="text-[10px] text-slate-400">SKU: {prod.sku}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Suppliers */}
              {searchResults.suppliers?.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase">Suppliers</div>
                  {searchResults.suppliers.map((sup) => (
                    <Link
                      key={sup.id}
                      to="/suppliers"
                      onClick={() => setSearchOpen(false)}
                      className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-1.5"><Truck className="h-3 w-3 text-blue-400" />{sup.name}</span>
                      <span className="text-[10px] text-slate-400">{sup.email}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Purchase Orders */}
              {searchResults.purchaseOrders?.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase">Purchase Orders</div>
                  {searchResults.purchaseOrders.map((po) => (
                    <Link
                      key={po.id}
                      to="/purchase-orders"
                      onClick={() => setSearchOpen(false)}
                      className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-1.5"><ShoppingCart className="h-3 w-3 text-purple-400" />{po.po_no}</span>
                      <span className="text-[10px] text-slate-400">{po.supplier_name}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Payments */}
              {searchResults.payments?.length > 0 && (
                <div>
                  <div className="px-2 pb-1 text-[10px] font-bold text-slate-400 uppercase">Payments</div>
                  {searchResults.payments.map((pay) => (
                    <Link
                      key={pay.id}
                      to="/payments"
                      onClick={() => setSearchOpen(false)}
                      className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 text-xs font-semibold text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-1.5"><CreditCard className="h-3 w-3 text-rose-400" />{pay.reference_no || `Payment #${pay.id}`}</span>
                      <span className="text-[10px] text-slate-400">{pay.customer_name}</span>
                    </Link>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {!searching &&
               !searchResults.customers?.length &&
               !searchResults.invoices?.length &&
               !searchResults.products?.length &&
               !searchResults.suppliers?.length &&
               !searchResults.purchaseOrders?.length &&
               !searchResults.payments?.length && (
                <div className="py-6 text-center text-xs text-slate-400">
                  No matching records found.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* ── Utility Buttons ── */}
      <div className="flex items-center gap-3">
        {/* Theme Toggle */}
        <button onClick={toggleTheme} className="btn-icon-only">
          {isDark ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button onClick={handleBellClick} className="btn-icon-only relative" id="notification-bell">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center leading-none shadow-sm">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex justify-between items-center p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Notifications</span>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} className="text-[10px] font-semibold text-indigo-500 hover:underline bg-transparent border-none cursor-pointer">
                    Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[360px] overflow-y-auto">
                {notifications.length > 0 ? notifications.map((n) => {
                  const Icon = NOTIF_ICON[n.type] || Bell
                  return (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`w-full text-left flex gap-2.5 items-start px-3 py-2.5 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 bg-transparent border-x-0 border-t-0 cursor-pointer ${!n.is_read ? 'bg-indigo-50/50 dark:bg-indigo-950/10' : ''}`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${!n.is_read ? 'text-indigo-500' : 'text-slate-400'}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs leading-snug ${!n.is_read ? 'font-bold text-slate-800 dark:text-slate-100' : 'font-medium text-slate-500 dark:text-slate-400'}`}>
                          {n.title}
                        </div>
                        {n.body && <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{n.body}</div>}
                        <div className="text-[9px] text-slate-300 dark:text-slate-500 mt-1">{timeAgo(n.created_at)}</div>
                      </div>
                      {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1 flex-shrink-0" />}
                    </button>
                  )
                }) : (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No notifications yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="divider-v h-6" />

        {/* User Profile dropdown */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="avatar avatar-md bg-indigo-100 text-indigo-600">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex flex-col text-left hidden sm:flex">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                {user?.name || 'User Profile'}
              </span>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                {user?.role_slug || 'Owner'}
              </span>
            </div>
          </button>

          {profileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 p-1">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-slate-700/50">
                My Accounts
              </div>
              <Link
                to="/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
              >
                <User className="h-4 w-4" /> Account Settings
              </Link>
              <button
                onClick={() => {
                  setProfileOpen(false)
                  logout()
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/20 text-left bg-transparent border-none cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
