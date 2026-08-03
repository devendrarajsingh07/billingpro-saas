import React, { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Search, ArrowRightLeft, AlertCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { formatCurrency } from '../../utils/formatters'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'
import { useAuth } from '../../context/AuthContext'

export default function Products() {
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { company } = useAuth()

  // Modal actions
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()
  const { register: regStock, handleSubmit: handleStockSubmit, reset: resetStock } = useForm()

  const loadProducts = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/products?page=${page}&search=${search}&limit=10`)
      setProducts(res.data.data || [])
      setTotal(res.data.meta?.total || 0)
    } catch (err) {
      toast.error('Failed to load products.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [page, search])

  const openCreateModal = () => {
    setEditingProduct(null)
    reset({
      name: '',
      sku: '',
      barcode: '',
      description: '',
      selling_price: 0,
      purchase_price: 0,
      stock: 0,
      low_stock_threshold: 10,
      unit: 'pcs',
      is_service: 0,
    })
    setModalOpen(true)
  }

  const openEditModal = (prod) => {
    setEditingProduct(prod)
    reset({
      name: prod.name,
      sku: prod.sku || '',
      barcode: prod.barcode || '',
      description: prod.description || '',
      selling_price: prod.selling_price,
      purchase_price: prod.purchase_price || 0,
      stock: prod.stock || 0,
      low_stock_threshold: prod.low_stock_threshold || 10,
      unit: prod.unit || 'pcs',
      is_service: prod.is_service || 0,
    })
    setModalOpen(true)
  }

  const openStockModal = (prod) => {
    setEditingProduct(prod)
    resetStock({
      quantity: 1,
      type: 'in',
      reference: '',
      notes: '',
    })
    setStockOpen(true)
  }

  const openDeleteDialog = (id) => {
    setSelectedProductId(id)
    setDeleteOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (editingProduct) {
        await api.put(`/api/v1/products/${editingProduct.id}`, data)
        toast.success('Product updated successfully.')
      } else {
        await api.post('/api/v1/products', data)
        toast.success('Product created successfully.')
      }
      setModalOpen(false)
      loadProducts()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save product.')
    } finally {
      setSaving(false)
    }
  }

  const onSubmitStockAdjustment = async (data) => {
    setSaving(true)
    try {
      await api.post(`/api/v1/products/${editingProduct.id}/adjust-stock`, data)
      toast.success('Stock adjusted successfully.')
      setStockOpen(false)
      loadProducts()
    } catch (err) {
      toast.error('Failed to adjust stock level.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await api.delete(`/api/v1/products/${selectedProductId}`)
      toast.success('Product deleted successfully.')
      setDeleteOpen(false)
      loadProducts()
    } catch (err) {
      toast.error('Failed to delete product.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Banner */}
      <div className="page-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="page-banner-title">Product Catalog</h1>
          <p className="page-banner-sub">Manage products, stock thresholds, and pricing</p>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={openCreateModal}>
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>


      {/* Filter and Search Bar */}
      <div className="card">
        <div className="filter-bar">
          <div className="search-bar w-full max-w-sm">
            <Search className="input-icon" />
            <input
              type="text"
              placeholder="Search products by name, SKU, barcode..."
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
        ) : products.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product Details</th>
                  <th>SKU / Barcode</th>
                  <th>Prices (Purch / Sell)</th>
                  <th>Current Stock</th>
                  <th>Tracking Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((prod) => {
                  const isLowStock = !prod.is_service && prod.stock <= prod.low_stock_threshold
                  return (
                    <tr key={prod.id}>
                      <td>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{prod.name}</div>
                        <div className="text-[10px] text-slate-400 truncate-text max-w-xs">{prod.description || 'No description.'}</div>
                      </td>
                      <td>
                        <div className="text-xs font-mono text-slate-600 dark:text-slate-300">SKU: {prod.sku || 'N/A'}</div>
                        {prod.barcode && <div className="text-[10px] text-slate-400 font-mono">BC: {prod.barcode}</div>}
                      </td>
                      <td>
                        <div className="text-xs text-slate-500">Buy: {formatCurrency(prod.purchase_price, company?.currency_code)}</div>
                        <div className="text-xs font-bold text-indigo-500">Sell: {formatCurrency(prod.selling_price, company?.currency_code)}</div>
                      </td>
                      <td>
                        {prod.is_service ? (
                          <span className="text-slate-400 font-medium">Service (No stock)</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isLowStock ? 'text-amber-500' : 'text-slate-900 dark:text-slate-100'}`}>
                              {prod.stock} {prod.unit || 'pcs'}
                            </span>
                            {isLowStock && (
                              <Badge variant="warning" className="gap-1 animate-pulse">
                                <AlertCircle className="h-3 w-3" /> Low Stock
                              </Badge>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge variant={prod.is_active ? 'success' : 'slate'}>
                          {prod.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {!prod.is_service && (
                            <button
                              onClick={() => openStockModal(prod)}
                              className="btn-icon-only text-indigo-500"
                              title="Adjust Stock"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </button>
                          )}
                          <button onClick={() => openEditModal(prod)} className="btn-icon-only">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => openDeleteDialog(prod.id)} className="btn-icon-only text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20">
                            <Trash2 className="h-4 w-4" />
                          </button>
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
            title="Catalog is empty"
            description="You don't have any products or services in your catalog yet."
            actionText="Register Product"
            onAction={openCreateModal}
          />
        )}
      </div>

      {/* Save Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Edit Product Details' : 'Register New Product'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Product / Service Name"
              placeholder="Acme Laptop Pro"
              required
              error={errors.name?.message}
              {...register('name', { required: 'Product name is required' })}
            />
            <Input
              label="SKU Code"
              placeholder="LAP-PRO-4K"
              required
              error={errors.sku?.message}
              {...register('sku', { required: 'SKU is required' })}
            />
            <Input
              label="Barcode (Optional)"
              placeholder="8901234567890"
              error={errors.barcode?.message}
              {...register('barcode')}
            />
            <Input
              label="Selling Price"
              placeholder="85000"
              type="number"
              required
              error={errors.selling_price?.message}
              {...register('selling_price', { required: 'Selling price is required' })}
            />
            <Input
              label="Purchase Price"
              placeholder="65000"
              type="number"
              error={errors.purchase_price?.message}
              {...register('purchase_price')}
            />
            <Input
              label="Unit Measurement"
              placeholder="pcs"
              error={errors.unit?.message}
              {...register('unit')}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Item Category</label>
              <select className="input-field" {...register('is_service')}>
                <option value={0}>Physical Inventory Item</option>
                <option value={1}>Service / Consulting Item</option>
              </select>
            </div>
            <Input
              label="Low Stock Threshold Limit"
              placeholder="10"
              type="number"
              error={errors.low_stock_threshold?.message}
              {...register('low_stock_threshold')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Item Description</label>
            <textarea
              rows={2}
              className="input-field"
              placeholder="Product specific specs, warranties, or service agreements."
              {...register('description')}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Save Item
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={stockOpen}
        onClose={() => setStockOpen(false)}
        title="Adjust Inventory Stock Levels"
        size="sm"
      >
        <form onSubmit={handleStockSubmit(onSubmitStockAdjustment)} className="space-y-4">
          <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl mb-2 text-xs">
            <span className="font-bold text-slate-800 dark:text-slate-200">{editingProduct?.name}</span>
            <div className="text-slate-400 mt-0.5">Current Balance: <span className="font-bold">{editingProduct?.stock} {editingProduct?.unit}</span></div>
          </div>
          
          <Input
            label="Adjustment Quantity"
            type="number"
            required
            {...regStock('quantity', { required: true, min: 1 })}
          />

          <div className="form-group">
            <label className="form-label">Adjustment Type</label>
            <select className="input-field" {...regStock('type')}>
              <option value="out">Deduct Stock (adjustment/sale OUT)</option>
              <option value="in">Increase Stock (procurement/return IN)</option>
            </select>
          </div>

          <Input
            label="Reference ID (Optional)"
            placeholder="PO-2026-000001"
            {...regStock('reference')}
          />

          <div className="form-group">
            <label className="form-label">Adjustment Reason / Notes</label>
            <textarea
              rows={2}
              className="input-field"
              placeholder="Physical recount mismatch, manual delivery..."
              {...regStock('notes')}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setStockOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Save Adjustment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Product"
        message="Are you sure you want to delete this product? This will hide the item and its inventory logs from current catalog views."
        confirmText="Yes, delete product"
        isLoading={saving}
      />
    </div>
  )
}
