import React, { useEffect, useState } from 'react'
import { Search, CreditCard, Calendar } from 'lucide-react'
import api from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../context/AuthContext'

export default function Payments() {
  const [payments, setPayments] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { company } = useAuth()

  const loadPayments = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/payments?page=${page}&search=${search}&limit=10`)
      setPayments(res.data.data || [])
      setTotal(res.data.meta?.total || 0)
    } catch (err) {
      console.error('[Payments] Failed to fetch payments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [page, search])

  return (
    <div className="space-y-6">
      {/* Page Banner */}
      <div className="page-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="page-banner-title">Payments Log</h1>
          <p className="page-banner-sub">Browse payment collections and customer transaction receipts</p>
        </div>
      </div>


      {/* Filter and Search Bar */}
      <div className="card">
        <div className="filter-bar">
          <div className="search-bar w-full max-w-sm">
            <Search className="input-icon" />
            <input
              type="text"
              placeholder="Search payments by reference ID, method..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </div>

        {/* Table View */}
        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto" />
          </div>
        ) : payments.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Receipt Reference</th>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((pm) => (
                  <tr key={pm.id}>
                    <td>
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <CreditCard className="h-4 w-4 text-indigo-500" /> {pm.reference_no || `REC-${pm.id}`}
                      </div>
                      {pm.notes && <div className="text-[10px] text-slate-400 mt-0.5">{pm.notes}</div>}
                    </td>
                    <td className="font-semibold text-indigo-500">#{pm.invoice_no}</td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" /> {formatDate(pm.paid_at)}
                      </div>
                    </td>
                    <td className="font-bold text-emerald-500">
                      {formatCurrency(pm.amount, company?.currency_code)}
                    </td>
                    <td>
                      <span className="text-xs font-semibold bg-slate-100 dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 px-2 py-1 rounded capitalize">
                        {pm.method}
                      </span>
                    </td>
                    <td>
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full capitalize">
                        {pm.status || 'completed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Pagination
              currentPage={page}
              totalPages={Math.ceil(total / 10)}
              onPageChange={setPage}
              totalItems={total}
              itemsPerPage={10}
            />
          </div>
        ) : (
          <EmptyState
            title="No payments received"
            description="There are no payments registered on this workspace yet."
          />
        )}
      </div>
    </div>
  )
}
