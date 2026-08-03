import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Users, CreditCard, MessageCircle } from 'lucide-react'

const LEDGER_ROWS = [
  { no: 'INV-2026-0412', amt: '₹18,400', status: 'paid' },
  { no: 'INV-2026-0413', amt: '₹6,250', status: 'pending' },
  { no: 'INV-2026-0414', amt: '₹42,000', status: 'paid' },
  { no: 'INV-2026-0415', amt: '₹3,180', status: 'paid' },
  { no: 'INV-2026-0416', amt: '₹11,750', status: 'pending' },
  { no: 'INV-2026-0417', amt: '₹27,900', status: 'paid' },
]

const FEATURES = [
  { icon: Users, text: 'Multi-tenant workspace with role-based access for your whole team' },
  { icon: CreditCard, text: 'Accept payments instantly with built-in Razorpay checkout' },
  { icon: MessageCircle, text: 'Automatic WhatsApp & SMS reminders for overdue invoices' },
]

function LedgerRow({ no, amt, status }) {
  return (
    <div className="auth-ledger-row">
      <span className="inv-no">{no}</span>
      <span className="inv-amt">{amt}</span>
      <span className={`auth-ledger-status ${status}`}>{status}</span>
    </div>
  )
}

export default function AuthLayout() {
  const { isAuthenticated } = useAuth()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="auth-shell-split">
      {/* Brand panel — hidden below lg, shown on desktop */}
      <aside className="auth-brand-panel">
        <div className="auth-brand-content">
          <div className="auth-logo">
            <div className="auth-logo-icon">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-black text-slate-100 tracking-tight">BillingPro</span>
          </div>

          <h2 className="auth-brand-headline">Billing that keeps pace with your business.</h2>
          <p className="auth-brand-sub">
            Invoices, inventory, and payments in one place — built for teams who'd
            rather spend time closing deals than chasing spreadsheets.
          </p>

          <div className="auth-feature-list">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div className="auth-feature-item" key={text}>
                <span className="auth-feature-icon"><Icon className="h-4 w-4" /></span>
                <span className="auth-feature-text">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Signature: a quiet, ever-scrolling feed of invoices getting paid */}
        <div className="auth-ledger" aria-hidden="true">
          <div className="auth-ledger-track">
            {LEDGER_ROWS.map((row) => <LedgerRow key={row.no} {...row} />)}
            {LEDGER_ROWS.map((row) => <LedgerRow key={`${row.no}-dup`} {...row} />)}
          </div>
        </div>
      </aside>

      {/* Form side */}
      <div className="auth-form-side">
        <div className="auth-card">
          {/* Logo shown here only on mobile, where the brand panel is hidden */}
          <div className="auth-logo lg:hidden">
            <div className="auth-logo-icon">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xl font-black text-slate-100 tracking-tight">BillingPro</span>
          </div>

          <Outlet />
        </div>
      </div>
    </div>
  )
}
