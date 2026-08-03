import React, { useEffect, useState } from 'react'
import { Plus, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, AlertCircle, Boxes, TrendingDown } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { formatDate } from '../../utils/formatters'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'

const TYPE_META = {
  in: { label: 'Stock In', icon: ArrowUpCircle, className: 'text-emerald-500' },
  out: { label: 'Stock Out', icon: ArrowDownCircle, className: 'text-rose-500' },
  adjustment: { label: 'Adjustment', icon: SlidersHorizontal, className: 'text-indigo-500' },
}

export default function Inventory() {
  const [tab, setTab] = useState('movements') // 'movements' | 'lowstock'

  const [movements, setMovements] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const [lowStock, setLowStock] = useState([])
  const [lowStockLoading, setLowStockLoading] = useState(true)

  const [forecast, setForecast] = useState([])
  const [forecastLoading, setForecastLoading] = useState(true)

  const [products, setProducts] = useState([])
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    defaultValues: { product_id: '', type: 'in', quantity: 1, reference: '', notes: '' }
  })
  const watchType = watch('type')

  const loadMovements = async () => {
    setLoading(true)
    try {
      const typeQuery = typeFilter ? `&type=${typeFilter}` : ''
      const res = await api.get(`/api/v1/inventory?page=${page}&limit=15${typeQuery}`)
      setMovements(res.data.data || [])
      setTotal(res.data.meta?.total || 0)
    } catch (err) {
      toast.error('Failed to load inventory movements.')
    } finally {
      setLoading(false)
    }
  }

  const loadLowStock = async () => {
    setLowStockLoading(true)
    try {
      const res = await api.get('/api/v1/inventory/low-stock')
      setLowStock(res.data.data || [])
    } catch (err) {
      toast.error('Failed to load low stock products.')
    } finally {
      setLowStockLoading(false)
    }
  }

  const loadForecast = async () => {
    setForecastLoading(true)
    try {
      const res = await api.get('/api/v1/inventory/forecast')
      setForecast(res.data.data?.forecast || [])
    } catch (err) {
      toast.error('Failed to load stockout forecast.')
    } finally {
      setForecastLoading(false)
    }
  }

  const loadProducts = async () => {
    try {
      const res = await api.get('/api/v1/products?limit=200')
      setProducts((res.data.data || []).filter(p => !p.is_service))
    } catch (err) {
      // Silent — product list is only needed for the adjustment form
    }
  }

  useEffect(() => {
    loadMovements()
  }, [page, typeFilter])

  useEffect(() => {
    loadLowStock()
    loadForecast()
    loadProducts()
  }, [])

  const openAdjustModal = (productId = '') => {
    reset({ product_id: productId, type: 'in', quantity: 1, reference: '', notes: '' })
    setAdjustOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      await api.post('/api/v1/inventory/adjustments', {
        ...data,
        product_id: Number(data.product_id),
        quantity: Number(data.quantity),
      })
      toast.success('Stock adjustment recorded successfully.')
      setAdjustOpen(false)
      loadMovements()
      loadLowStock()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record stock adjustment.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Banner */}
      <div className="page-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="page-banner-title">Inventory</h1>
          <p className="page-banner-sub">Track stock movements and monitor low-stock products</p>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={() => openAdjustModal()}>
            <Plus size={14} /> New Adjustment
          </button>
        </div>
      </div>


      {/* Tabs */}
      <div className="card">
        <div className="filter-bar">
          <div className="tab-list">
            <button
              className={`tab-btn ${tab === 'movements' ? 'active' : ''}`}
              onClick={() => setTab('movements')}
            >
              Stock Movements
            </button>
            <button
              className={`tab-btn ${tab === 'lowstock' ? 'active' : ''}`}
              onClick={() => setTab('lowstock')}
            >
              Low Stock {lowStock.length > 0 && <Badge variant="warning" className="ml-1.5">{lowStock.length}</Badge>}
            </button>
            <button
              className={`tab-btn ${tab === 'forecast' ? 'active' : ''}`}
              onClick={() => setTab('forecast')}
            >
              Stockout Forecast {forecast.length > 0 && <Badge variant="warning" className="ml-1.5">{forecast.length}</Badge>}
            </button>
          </div>
        </div>

        {tab === 'movements' && (
          <>
            <div className="filter-bar">
              <select
                className="input-field max-w-[200px]"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All Movement Types</option>
                <option value="in">Stock In</option>
                <option value="out">Stock Out</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>

            {loading ? (
              <div className="p-8 text-center">
                <div className="spinner mx-auto" />
              </div>
            ) : movements.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Reference</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => {
                      const meta = TYPE_META[m.type] || TYPE_META.adjustment
                      const Icon = meta.icon
                      return (
                        <tr key={m.id}>
                          <td className="text-xs text-slate-500">{formatDate(m.created_at)}</td>
                          <td>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{m.product_name || 'Deleted Product'}</div>
                            {m.product_sku && <div className="text-[10px] text-slate-400 font-mono">SKU: {m.product_sku}</div>}
                          </td>
                          <td>
                            <span className={`flex items-center gap-1.5 text-xs font-semibold ${meta.className}`}>
                              <Icon className="h-3.5 w-3.5" /> {meta.label}
                            </span>
                          </td>
                          <td className={`font-bold ${meta.className}`}>
                            {m.type === 'out' ? '-' : m.quantity >= 0 ? '+' : ''}{Math.abs(m.quantity)} {m.product_unit || ''}
                          </td>
                          <td className="text-xs text-slate-500">{m.reference || 'N/A'}</td>
                          <td className="text-xs text-slate-500 max-w-xs truncate-text">{m.notes || 'N/A'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil(total / 15)}
                  onPageChange={setPage}
                  totalItems={total}
                  itemsPerPage={15}
                />
              </div>
            ) : (
              <EmptyState
                title="No stock movements yet"
                description="Movements appear here automatically from sales, purchase order receipts, and manual adjustments."
                actionText="New Adjustment"
                onAction={() => openAdjustModal()}
              />
            )}
          </>
        )}

        {tab === 'lowstock' && (
          lowStockLoading ? (
            <div className="p-8 text-center">
              <div className="spinner mx-auto" />
            </div>
          ) : lowStock.length > 0 ? (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Threshold</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStock.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku || 'N/A'}</div>
                      </td>
                      <td>
                        <span className="font-bold text-amber-500 flex items-center gap-1.5">
                          <AlertCircle className="h-3.5 w-3.5" /> {p.stock} {p.unit || 'pcs'}
                        </span>
                      </td>
                      <td className="text-slate-500">{p.low_stock_threshold} {p.unit || 'pcs'}</td>
                      <td className="text-right">
                        <Button variant="secondary" size="sm" onClick={() => openAdjustModal(p.id)} icon={Boxes}>
                          Restock
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="All stock levels healthy"
              description="No products are currently at or below their low stock threshold."
            />
          )
        )}

        {tab === 'forecast' && (
          forecastLoading ? (
            <div className="p-8 text-center">
              <div className="spinner mx-auto" />
            </div>
          ) : forecast.length > 0 ? (
            <div className="table-container">
              <p className="text-[11px] text-slate-400 px-4 pt-3">
                Based on the last 30 days of sales, these products are projected to run out within 14 days —
                even ones that haven't crossed their low-stock threshold yet.
              </p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Current Stock</th>
                    <th>Daily Velocity</th>
                    <th>Runs Out In</th>
                    <th>Projected Date</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku || 'N/A'}</div>
                      </td>
                      <td>{p.stock} {p.unit || 'pcs'}</td>
                      <td className="text-slate-500">{p.daily_velocity} {p.unit || 'pcs'}/day</td>
                      <td>
                        <span className={`font-bold flex items-center gap-1.5 ${p.days_until_stockout <= 7 ? 'text-rose-500' : 'text-amber-500'}`}>
                          <TrendingDown className="h-3.5 w-3.5" /> {p.days_until_stockout} days
                        </span>
                      </td>
                      <td className="text-slate-500">{p.projected_stockout_date}</td>
                      <td className="text-right">
                        <Button variant="secondary" size="sm" onClick={() => openAdjustModal(p.id)} icon={Boxes}>
                          Restock
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No stockouts projected"
              description="Based on recent sales velocity, no products are on track to run out in the next 14 days."
            />
          )
        )}
      </div>

      {/* Adjustment Modal */}
      <Modal
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Record Stock Adjustment"
        size="sm"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="form-group">
            <label className="form-label">Product *</label>
            <select
              className="input-field"
              {...register('product_id', { required: 'Product is required' })}
            >
              <option value="">Select Product</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.stock} {p.unit || 'pcs'} in stock)</option>
              ))}
            </select>
            {errors.product_id && <p className="form-error">{errors.product_id.message}</p>}
          </div>

          <div className="form-group">
            <label className="form-label">Adjustment Type</label>
            <select className="input-field" {...register('type')}>
              <option value="in">Increase Stock (procurement/return IN)</option>
              <option value="out">Deduct Stock (damage/loss OUT)</option>
              <option value="adjustment">Recount Adjustment (signed delta)</option>
            </select>
          </div>

          <Input
            label={watchType === 'adjustment' ? 'Delta (use a negative number to decrease)' : 'Quantity'}
            type="number"
            required
            error={errors.quantity?.message}
            {...register('quantity', {
              required: 'Quantity is required',
              validate: (val) => {
                const n = Number(val)
                if (watchType === 'adjustment') return n !== 0 || 'Adjustment cannot be zero'
                return n > 0 || 'Quantity must be greater than zero'
              }
            })}
          />

          <Input
            label="Reference ID (Optional)"
            placeholder="e.g. Stock count #14"
            {...register('reference')}
          />

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              rows={2}
              className="input-field"
              placeholder="Reason for the adjustment..."
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setAdjustOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Save Adjustment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
