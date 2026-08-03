import React, { useEffect, useState } from 'react'
import {
  TrendingUp, CreditCard, Users, Package,
  AlertTriangle, FileText, DollarSign, Plus,
  ArrowUpRight, ArrowDownRight, Activity, Zap
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts'
import api from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import Skeleton from '../../components/ui/Skeleton'
import Badge from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'

/* ─── tiny helpers ─────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good Morning'
  if (h < 17) return 'Good Afternoon'
  return 'Good Evening'
}

/* Radial / donut progress ring (SVG, no deps) */
function RadialRing({ pct = 0, color = '#6366f1', size = 88, stroke = 8, label, value }) {
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
          fill="#fff" fontSize={13} fontWeight={700}>{pct}%</text>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>{value}</div>
      </div>
    </div>
  )
}

/* Custom tooltip for charts */
function ChartTooltip({ active, payload, label, currencyCode }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10,
      padding: '10px 14px', boxShadow: '0 4px 24px rgba(99,102,241,0.12)',
      fontSize: 12,
    }}>
      <p style={{ fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, margin: 0 }}>
          {p.name}: <strong>{formatCurrency(p.value, currencyCode)}</strong>
        </p>
      ))}
    </div>
  )
}

/* ─── STATUS BADGE COLORS ───────────────────────────────────── */
const STATUS_STYLES = {
  paid:      { bg: '#d1fae5', color: '#065f46' },
  pending:   { bg: '#fef3c7', color: '#92400e' },
  sent:      { bg: '#dbeafe', color: '#1e40af' },
  overdue:   { bg: '#fee2e2', color: '#991b1b' },
  draft:     { bg: '#f1f5f9', color: '#475569' },
  partial:   { bg: '#ede9fe', color: '#5b21b6' },
  viewed:    { bg: '#e0f2fe', color: '#0369a1' },
  cancelled: { bg: '#f1f5f9', color: '#64748b' },
}

function StatusPill({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.draft
  return (
    <span style={{
      ...s, borderRadius: 99, padding: '3px 10px',
      fontSize: 11, fontWeight: 700, textTransform: 'capitalize', display: 'inline-block'
    }}>{status}</span>
  )
}

/* ─── ACTIVITY ICON ─────────────────────────────────────────── */
const ACTION_COLORS = {
  created: '#10b981', updated: '#6366f1', deleted: '#ef4444',
  logged_in: '#06b6d4', default: '#94a3b8'
}

/* ─── PIE COLORS ────────────────────────────────────────────── */
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#64748b']

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const { company, user }   = useAuth()

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await api.get('/api/v1/reports/dashboard')
        setData(res.data.data)
      } catch (err) {
        console.error('[Dashboard] Failed to fetch analytics:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  /* ── loading skeleton ──────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <Skeleton className="h-48 w-full" style={{ borderRadius: 20 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    )
  }

  const { kpis, charts, recentInvoices, recentActivity } = data || {}

  /* ── chart data ────────────────────────────────────────────── */
  const revenueTrendData = charts?.revenueTrend?.map(item => ({
    name: item.month?.slice(5) ?? item.month, // show "MM" not "YYYY-MM"
    Revenue:   item.revenue   || 0,
    Collected: item.collected || 0,
  })) || []

  const pieData = charts?.invoiceStatus?.map(item => ({
    name:  item.status,
    value: item.count || 0,
  })) || []

  /* ── computed KPIs ─────────────────────────────────────────── */
  const collectionRate = kpis?.totalRevenue
    ? Math.round((kpis.totalCollected / kpis.totalRevenue) * 100)
    : 0

  const cur = company?.currency_code || 'INR'

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: '100%' }}>

      {/* ── HERO GRADIENT BANNER (Design #3) ─────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 45%, #4338ca 75%, #06b6d4 100%)',
        borderRadius: 20,
        padding: '32px 36px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(67,56,202,0.35)',
      }}>
        {/* Background orbs */}
        <div style={{
          position: 'absolute', top: -40, right: -40, width: 220, height: 220,
          borderRadius: '50%', background: 'rgba(6,182,212,0.15)',
          filter: 'blur(40px)', pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute', bottom: -60, left: '40%', width: 180, height: 180,
          borderRadius: '50%', background: 'rgba(139,92,246,0.2)',
          filter: 'blur(50px)', pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 24, position: 'relative', zIndex: 1 }}>
          {/* Left: greeting + headline number */}
          <div>
            <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 500, margin: 0 }}>
              {getGreeting()}, {user?.name?.split(' ')[0] || 'there'} 👋
            </p>
            <h1 style={{ color: '#fff', fontSize: 32, fontWeight: 800, margin: '6px 0 4px', letterSpacing: '-0.5px' }}>
              {formatCurrency(kpis?.totalRevenue, cur)}
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, margin: 0 }}>
              Total all-time revenue · {company?.name}
            </p>

            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              <Link to="/invoices?create=true" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#fff', color: '#312e81',
                borderRadius: 10, padding: '9px 18px', fontSize: 13,
                fontWeight: 700, textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
                transition: 'transform .15s',
              }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <Plus size={15} /> New Invoice
              </Link>
              <Link to="/reports" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.12)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 10, padding: '9px 18px', fontSize: 13,
                fontWeight: 600, textDecoration: 'none', backdropFilter: 'blur(6px)',
              }}>
                <Activity size={15} /> View Reports
              </Link>
            </div>
          </div>

          {/* Right: Radial rings (Design #3) */}
          <div style={{ display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap' }}>
            <RadialRing
              pct={collectionRate}
              color="#06b6d4"
              label="Collection Rate"
              value={formatCurrency(kpis?.totalCollected, cur)}
            />
            <RadialRing
              pct={kpis?.totalRevenue ? Math.min(100, Math.round((kpis?.monthlyRevenue / kpis?.totalRevenue) * 100 * 4)) : 0}
              color="#a78bfa"
              label="This Month"
              value={formatCurrency(kpis?.monthlyRevenue, cur)}
            />
            <RadialRing
              pct={kpis?.products ? Math.min(100, Math.round(((kpis?.products - kpis?.lowStock) / kpis?.products) * 100)) : 100}
              color="#34d399"
              label="Stock Health"
              value={`${kpis?.products - kpis?.lowStock || 0} / ${kpis?.products || 0}`}
            />
          </div>
        </div>
      </div>

      {/* ── KPI CARDS (Design #2 — white cards with colored left border) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[
          {
            label: 'Total Revenue', value: formatCurrency(kpis?.totalRevenue, cur),
            icon: <DollarSign size={18} />, accent: '#6366f1', bg: '#eef2ff',
            sub: 'All-time invoiced', trend: 'up'
          },
          {
            label: 'Monthly Revenue', value: formatCurrency(kpis?.monthlyRevenue, cur),
            icon: <TrendingUp size={18} />, accent: '#10b981', bg: '#d1fae5',
            sub: 'Current month', trend: 'up'
          },
          {
            label: 'Pending Invoices', value: kpis?.pendingInvoices ?? '—',
            icon: <FileText size={18} />, accent: '#f59e0b', bg: '#fef3c7',
            sub: formatCurrency(kpis?.totalOutstanding, cur) + ' outstanding', trend: 'down'
          },
          {
            label: 'Customers', value: kpis?.customers ?? '—',
            icon: <Users size={18} />, accent: '#06b6d4', bg: '#e0f2fe',
            sub: `${kpis?.products || 0} products listed`, trend: 'neutral'
          },
        ].map(card => (
          <div key={card.label} style={{
            background: '#fff',
            borderRadius: 16,
            padding: '20px 22px',
            borderLeft: `4px solid ${card.accent}`,
            boxShadow: '0 1px 12px rgba(0,0,0,0.06)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ margin: 0, fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {card.label}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>
                  {card.value}
                </p>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: card.accent, flexShrink: 0
              }}>
                {card.icon}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
              {card.trend === 'up'   && <ArrowUpRight size={13} color="#10b981" />}
              {card.trend === 'down' && <ArrowDownRight size={13} color="#ef4444" />}
              {card.sub}
            </div>
          </div>
        ))}
      </div>

      {/* ── CHARTS ROW: Area + Donut ──────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

        {/* Revenue Trend */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Revenue Trend</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Invoiced vs Collected · last 12 months</p>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
              background: 'linear-gradient(135deg,#6366f1,#06b6d4)',
              color: '#fff', borderRadius: 8, padding: '4px 10px', fontWeight: 600
            }}>
              <Zap size={12} /> Live
            </div>
          </div>
          <div style={{ height: 280, padding: '8px 4px 0' }}>
            {revenueTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0}    />
                    </linearGradient>
                    <linearGradient id="gradCol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#06b6d4" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#cbd5e1" fontSize={11} tickLine={false} axisLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip content={<ChartTooltip currencyCode={cur} />} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Revenue"   stroke="#6366f1" strokeWidth={2.5} fill="url(#gradRev)" dot={false} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="Collected" stroke="#06b6d4" strokeWidth={2.5} fill="url(#gradCol)" dot={false} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>
                No revenue data yet
              </div>
            )}
          </div>
        </div>

        {/* Invoice Status Donut */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 0' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Invoice Status</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Breakdown by status</p>
          </div>
          <div style={{ height: 280, padding: '4px 0 0' }}>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="45%" innerRadius={60} outerRadius={85}
                    paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>
                No invoices yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CHARTS ROW 2: Top Customers + Best Sellers ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          { title: 'Top Customers', sub: 'By sales volume', data: charts?.topCustomers, color: '#6366f1', key: 'value', name: 'Sales' },
          { title: 'Best Selling Products', sub: 'By revenue generated', data: charts?.bestSellers, color: '#06b6d4', key: 'value', name: 'Revenue' },
        ].map(chart => (
          <div key={chart.title} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px 0' }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{chart.title}</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>{chart.sub}</p>
            </div>
            <div style={{ height: 240, padding: '8px 4px 0' }}>
              {chart.data?.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart.data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#cbd5e1" fontSize={10} tickLine={false} axisLine={false}
                      tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                    <Tooltip content={<ChartTooltip currencyCode={cur} />} />
                    <Bar dataKey={chart.key} name={chart.name} fill={chart.color} radius={[6, 6, 0, 0]}>
                      {chart.data.map((_, i) => (
                        <Cell key={i} fill={chart.color} opacity={1 - i * 0.12} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>
                  No data yet
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── BOTTOM ROW: Recent Invoices + Activity ─────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

        {/* Recent Invoices Table (Design #2) */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Recent Invoices</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Latest 5 transactions</p>
            </div>
            <Link to="/invoices" style={{
              fontSize: 12, fontWeight: 700, color: '#6366f1', textDecoration: 'none',
              background: '#eef2ff', borderRadius: 8, padding: '5px 12px'
            }}>
              View All →
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc' }}>
                  {['Invoice', 'Customer', 'Date', 'Amount', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentInvoices?.length > 0 ? recentInvoices.map((inv, i) => (
                  <tr key={inv.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? '#fff' : '#fafcff' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#6366f1', fontFamily: 'monospace', fontSize: 12 }}>#{inv.invoice_no}</td>
                    <td style={{ padding: '12px 16px', color: '#334155', fontWeight: 500 }}>{inv.customer_name}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{formatDate(inv.date)}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(inv.grand_total, cur)}</td>
                    <td style={{ padding: '12px 16px' }}><StatusPill status={inv.status} /></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No recent invoices</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 12px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid #f1f5f9' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>Activity</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>Recent system events</p>
          </div>
          <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
            {recentActivity?.length > 0 ? recentActivity.map((act, i) => {
              const dotColor = ACTION_COLORS[act.action] || ACTION_COLORS.default
              return (
                <div key={act.id} style={{
                  display: 'flex', gap: 12, paddingBottom: 14, paddingTop: i === 0 ? 6 : 14,
                  borderBottom: i < recentActivity.length - 1 ? '1px solid #f1f5f9' : 'none',
                  alignItems: 'flex-start'
                }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                    background: `${dotColor}18`, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 12.5, color: '#334155', lineHeight: 1.45 }}>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>{act.user_name || 'System'}</span>
                      {' '}<span style={{ color: dotColor, fontWeight: 600 }}>{act.action}</span>
                      {' '}<span style={{ color: '#64748b' }}>{act.entity_type}</span>
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: '#94a3b8' }}>
                      {act.created_at ? new Date(act.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              )
            }) : (
              <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                No recent activity
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
