import React, { useEffect, useState } from 'react'
import { Plus, Search, ClipboardList, Eye, Trash2, Truck, Send, XCircle } from 'lucide-react'
import { useForm, useFieldArray } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { formatCurrency, formatDate } from '../../utils/formatters'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../context/AuthContext'

// Only forward transitions are offered inline; cancellation is always available
// separately. Mirrors VALID_TRANSITIONS in PurchaseOrderService on the server.
const NEXT_STATUS = {
  draft: 'sent',
  sent: 'received',
};

const STATUS_ACTION_LABEL = {
  draft: 'Mark as Sent',
  sent: 'Mark as Received',
};

const STATUS_ACTION_ICON = {
  draft: Send,
  sent: Truck,
};

export default function PurchaseOrders() {
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const { company } = useAuth()

  const [createOpen, setCreateOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [selectedPO, setSelectedPO] = useState(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm({
    defaultValues: {
      supplier_id: '',
      date: new Date().toISOString().split('T')[0],
      expected_date: '',
      notes: '',
      items: [{ product_id: '', description: '', qty: 1, unit_price: 0, tax_rate: 0 }],
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchItems = watch('items')

  const loadData = async () => {
    setLoading(true)
    try {
      const statusQuery = statusFilter ? `&status=${statusFilter}` : ''
      const [poRes, sRes, pRes] = await Promise.all([
        api.get(`/api/v1/purchase-orders?page=${page}&search=${search}&limit=10${statusQuery}`),
        api.get('/api/v1/suppliers?limit=100'),
        api.get('/api/v1/products?limit=100'),
      ])
      setPurchaseOrders(poRes.data.data || [])
      setTotal(poRes.data.meta?.total || 0)
      setSuppliers(sRes.data.data || [])
      setProducts(pRes.data.data || [])
    } catch (err) {
      toast.error('Failed to load purchase orders.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, search, statusFilter])

  // Live totals preview (server recomputes authoritatively on submit)
  const computeTotals = () => {
    let subtotal = 0
    let taxAmount = 0
    for (const item of (watchItems || [])) {
      const qty = Number(item.qty) || 0
      const price = Number(item.unit_price) || 0
      const taxRate = Number(item.tax_rate) || 0
      const lineBase = qty * price
      subtotal += lineBase
      taxAmount += lineBase * (taxRate / 100)
    }
    return { subtotal, taxAmount, grandTotal: subtotal + taxAmount }
  }
  const { subtotal, taxAmount, grandTotal } = computeTotals()

  const openCreateModal = () => {
    reset({
      supplier_id: '',
      date: new Date().toISOString().split('T')[0],
      expected_date: '',
      notes: '',
      items: [{ product_id: '', description: '', qty: 1, unit_price: 0, tax_rate: 0 }],
    })
    setCreateOpen(true)
  }

  const openViewModal = async (po) => {
    try {
      const res = await api.get(`/api/v1/purchase-orders/${po.id}`)
      setSelectedPO(res.data.data)
      setViewOpen(true)
    } catch (err) {
      toast.error('Failed to load purchase order details.')
    }
  }

  const openDeleteDialog = (po) => {
    setSelectedPO(po)
    setDeleteOpen(true)
  }

  const openCancelDialog = (po) => {
    setSelectedPO(po)
    setCancelOpen(true)
  }

  const handleProductChange = (prodId, idx) => {
    const prod = products.find(p => p.id === Number(prodId))
    if (prod) {
      setValue(`items.${idx}.description`, prod.name)
      setValue(`items.${idx}.unit_price`, prod.purchase_price || 0)
    }
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      await api.post('/api/v1/purchase-orders', {
        ...data,
        supplier_id: data.supplier_id || null,
      })
      toast.success('Purchase order created successfully.')
      setCreateOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create purchase order.')
    } finally {
      setSaving(false)
    }
  }

  const advanceStatus = async (po) => {
    const nextStatus = NEXT_STATUS[po.status]
    if (!nextStatus) return
    setSaving(true)
    try {
      await api.patch(`/api/v1/purchase-orders/${po.id}/status`, { status: nextStatus })
      toast.success(
        nextStatus === 'received'
          ? 'Purchase order received — stock updated.'
          : 'Purchase order marked as sent.'
      )
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update purchase order status.')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    setSaving(true)
    try {
      await api.patch(`/api/v1/purchase-orders/${selectedPO.id}/status`, { status: 'cancelled' })
      toast.success('Purchase order cancelled.')
      setCancelOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel purchase order.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await api.delete(`/api/v1/purchase-orders/${selectedPO.id}`)
      toast.success('Purchase order deleted successfully.')
      setDeleteOpen(false)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete purchase order.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Banner */}
      <div className="page-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="page-banner-title">Purchase Orders</h1>
          <p className="page-banner-sub">Order stock from suppliers and receive goods into inventory</p>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={openCreateModal}>
            <Plus size={14} /> New Purchase Order
          </button>
        </div>
      </div>


      {/* Filter and Search Bar */}
      <div className="card">
        <div className="filter-bar flex flex-wrap gap-3">
          <div className="search-bar w-full max-w-sm">
            <Search className="input-icon" />
            <input
              type="text"
              placeholder="Search by PO number or notes..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <select
            className="input-field max-w-[180px]"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <div className="spinner mx-auto" />
          </div>
        ) : purchaseOrders.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Date</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((po) => {
                  const NextIcon = STATUS_ACTION_ICON[po.status]
                  return (
                    <tr key={po.id}>
                      <td>
                        <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                          <ClipboardList className="h-4 w-4 text-slate-400" /> #{po.po_no}
                        </div>
                      </td>
                      <td>{po.supplier_name || 'Unknown Supplier'}</td>
                      <td>{formatDate(po.date)}</td>
                      <td className="font-semibold">{formatCurrency(po.total, company?.currency_code)}</td>
                      <td>
                        <Badge status={po.status} />
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {NextIcon && (
                            <button
                              onClick={() => advanceStatus(po)}
                              disabled={saving}
                              className="btn-icon-only text-emerald-500"
                              title={STATUS_ACTION_LABEL[po.status]}
                            >
                              <NextIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => openViewModal(po)} className="btn-icon-only" title="View Details">
                            <Eye className="h-4 w-4" />
                          </button>
                          {po.status !== 'cancelled' && (
                            <button
                              onClick={() => openCancelDialog(po)}
                              className="btn-icon-only text-amber-500"
                              title="Cancel Purchase Order"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                          {po.status !== 'received' && (
                            <button
                              onClick={() => openDeleteDialog(po)}
                              className="btn-icon-only text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                              title="Delete Purchase Order"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
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
            title="No purchase orders yet"
            description="Create a purchase order to start restocking from your suppliers."
            actionText="New Purchase Order"
            onAction={openCreateModal}
          />
        )}
      </div>

      {/* Create PO Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Purchase Order"
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Supplier</label>
              <select className="input-field" {...register('supplier_id')}>
                <option value="">Select Supplier</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <Input
              label="Order Date"
              type="date"
              required
              error={errors.date?.message}
              {...register('date', { required: 'Date is required' })}
            />
            <Input
              label="Expected Delivery Date"
              type="date"
              {...register('expected_date')}
            />
          </div>

          <div className="divider" />
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Line Items</h3>

          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="form-group md:col-span-3">
                  <label className="form-label text-slate-400 text-[10px]">Select Product (Optional)</label>
                  <select
                    className="input-field"
                    {...register(`items.${idx}.product_id`)}
                    onChange={(e) => handleProductChange(e.target.value, idx)}
                  >
                    <option value="">Non-catalog item</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <Input
                  label="Description"
                  className="md:col-span-3"
                  labelStyle="text-slate-400 text-[10px]"
                  placeholder="Item description..."
                  required
                  {...register(`items.${idx}.description`, { required: 'Description is required' })}
                />

                <Input
                  label="Quantity"
                  type="number"
                  className="md:col-span-2"
                  {...register(`items.${idx}.qty`, { required: true, min: 0.01 })}
                />

                <Input
                  label="Unit Cost"
                  type="number"
                  className="md:col-span-2"
                  {...register(`items.${idx}.unit_price`, { required: true, min: 0 })}
                />

                <div className="form-group md:col-span-1">
                  <label className="form-label text-slate-400 text-[10px]">Tax %</label>
                  <select className="input-field" {...register(`items.${idx}.tax_rate`)}>
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>

                <div className="flex justify-end pb-3 md:col-span-1">
                  <Button variant="danger" size="sm" onClick={() => remove(idx)} disabled={fields.length === 1}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            <Button
              variant="secondary"
              size="sm"
              onClick={() => append({ product_id: '', description: '', qty: 1, unit_price: 0, tax_rate: 0 })}
            >
              Add Line Item
            </Button>
          </div>

          <div className="divider" />

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 form-group">
              <label className="form-label">Notes</label>
              <textarea rows={3} className="input-field" placeholder="Delivery instructions, terms, etc..." {...register('notes')} />
            </div>

            <div className="md:col-span-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-500">Subtotal:</span>
                <span className="text-slate-800 dark:text-slate-200">{formatCurrency(subtotal, company?.currency_code)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-500">Tax Amount:</span>
                <span className="text-slate-800 dark:text-slate-200">{formatCurrency(taxAmount, company?.currency_code)}</span>
              </div>
              <div className="divider my-2" />
              <div className="flex justify-between font-bold text-sm text-indigo-500">
                <span>Grand Total:</span>
                <span>{formatCurrency(grandTotal, company?.currency_code)}</span>
              </div>
              <p className="text-[10px] text-slate-400 pt-1">Final totals are recalculated server-side on save.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Create Purchase Order
            </Button>
          </div>
        </form>
      </Modal>

      {/* View PO Modal */}
      <Modal
        isOpen={viewOpen}
        onClose={() => setViewOpen(false)}
        title={selectedPO ? `Purchase Order #${selectedPO.po_no}` : 'Purchase Order'}
        size="lg"
      >
        {selectedPO && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Supplier</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{selectedPO.supplier_name || 'Unknown Supplier'}</div>
                {selectedPO.supplier_email && <div className="text-slate-500">{selectedPO.supplier_email}</div>}
                {selectedPO.supplier_phone && <div className="text-slate-500">{selectedPO.supplier_phone}</div>}
              </div>
              <div>
                <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Status</div>
                <Badge status={selectedPO.status} />
                <div className="text-slate-500 mt-2">Order Date: {formatDate(selectedPO.date)}</div>
                {selectedPO.expected_date && <div className="text-slate-500">Expected: {formatDate(selectedPO.expected_date)}</div>}
              </div>
            </div>

            <div className="divider" />

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Qty Ordered</th>
                    <th>Qty Received</th>
                    <th>Unit Cost</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedPO.items || []).map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}{item.product_sku && <span className="text-[10px] text-slate-400 ml-1">({item.product_sku})</span>}</td>
                      <td>{item.qty}</td>
                      <td>{item.received_qty}</td>
                      <td>{formatCurrency(item.unit_price, company?.currency_code)}</td>
                      <td className="font-semibold">{formatCurrency(item.total, company?.currency_code)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <div className="w-full max-w-xs space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Subtotal:</span>
                  <span>{formatCurrency(selectedPO.subtotal, company?.currency_code)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax:</span>
                  <span>{formatCurrency(selectedPO.tax_amount, company?.currency_code)}</span>
                </div>
                <div className="flex justify-between font-bold text-indigo-500">
                  <span>Total:</span>
                  <span>{formatCurrency(selectedPO.total, company?.currency_code)}</span>
                </div>
              </div>
            </div>

            {selectedPO.notes && (
              <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                {selectedPO.notes}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel Confirmation */}
      <ConfirmDialog
        isOpen={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={handleCancel}
        title="Cancel Purchase Order"
        message={
          selectedPO?.status === 'received'
            ? 'This purchase order was already received. Cancelling will reverse the stock increase it created.'
            : 'Are you sure you want to cancel this purchase order?'
        }
        confirmText="Yes, cancel order"
        isLoading={saving}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Purchase Order"
        message="Are you sure you want to delete this purchase order? This cannot be undone."
        confirmText="Yes, delete order"
        isLoading={saving}
      />
    </div>
  )
}
