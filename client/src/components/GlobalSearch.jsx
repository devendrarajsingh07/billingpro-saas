import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Users, FileText, Package, X, Loader2 } from 'lucide-react'
import { search as searchAPI } from '../services/searchService'

const statusBadge = (status) => {
  const cls = {
    paid: 'bg-emerald-100 text-emerald-700',
    sent: 'bg-blue-100 text-blue-700',
    pending: 'bg-amber-100 text-amber-700',
    draft: 'bg-slate-100 text-slate-600',
    overdue: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  )
}

export default function GlobalSearch({ onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef()
  const navigate = useNavigate()
  const timerRef = useRef()

  useEffect(() => {
    inputRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults(null); return }
    setLoading(true)
    try {
      const res = await searchAPI(q)
      setResults(res.data)
    } catch {
      setResults(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(val), 280)
  }

  const go = (path) => { navigate(path); onClose() }

  const total = results
    ? (results.customers?.length || 0) + (results.invoices?.length || 0) + (results.products?.length || 0)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '70vh' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-100">
          {loading ? (
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
          ) : (
            <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            placeholder="Search customers, invoices, products…"
            className="flex-1 text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent"
          />
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 60px)' }}>
          {!query && (
            <div className="px-4 py-8 text-center">
              <Search className="w-10 h-10 mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 text-sm">Type to search across customers, invoices & products</p>
              <p className="text-slate-300 text-xs mt-1">Press Esc to close</p>
            </div>
          )}

          {query && !loading && results && total === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-slate-400 text-sm">No results for "<strong>{query}</strong>"</p>
            </div>
          )}

          {results && results.customers?.length > 0 && (
            <div className="p-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">Customers</p>
              {results.customers.map(c => (
                <button
                  key={c.id}
                  onClick={() => go('/customers')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{c.name}</p>
                    <p className="text-xs text-slate-400 truncate">{c.email || c.phone || '—'}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {results && results.invoices?.length > 0 && (
            <div className="p-3 border-t border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">Invoices</p>
              {results.invoices.map(inv => (
                <button
                  key={inv.id}
                  onClick={() => go('/invoices')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{inv.invoice_no}</p>
                    <p className="text-xs text-slate-400 truncate">{inv.customer_name || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-700">₹{Number(inv.grand_total || 0).toLocaleString('en-IN')}</span>
                    {statusBadge(inv.status)}
                  </div>
                </button>
              ))}
            </div>
          )}

          {results && results.products?.length > 0 && (
            <div className="p-3 border-t border-slate-50">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-2 mb-1.5">Products</p>
              {results.products.map(p => (
                <button
                  key={p.id}
                  onClick={() => go('/products')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.category || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">₹{Number(p.price || 0).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-400">Stock: {p.stock}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
