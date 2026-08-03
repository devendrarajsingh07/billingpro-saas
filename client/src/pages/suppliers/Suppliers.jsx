import React, { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Search, Mail, Phone, Eye, FileText, Download, CreditCard } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import api from '../../services/api'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Pagination from '../../components/ui/Pagination'
import EmptyState from '../../components/ui/EmptyState'

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Details & Payments state
  const [detailsSupplier, setDetailsSupplier]     = useState(null)
  const [purchaseHistory, setPurchaseHistory]     = useState(null)
  const [paymentsLog, setPaymentsLog]             = useState([])
  const [historyLoading, setHistoryLoading]       = useState(false)
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false)
  const [recordingPayment, setRecordingPayment]   = useState(false)

  const { register: regPay, handleSubmit: handlePaySubmit, reset: resetPay } = useForm()

  const viewDetails = async (sup) => {
    setDetailsSupplier(sup)
    setHistoryLoading(true)
    try {
      const [histRes, payRes] = await Promise.all([
        api.get(`/api/v1/suppliers/${sup.id}/purchase-history`),
        api.get(`/api/v1/suppliers/${sup.id}/payments`),
      ])
      setPurchaseHistory(histRes.data?.data)
      setPaymentsLog(payRes.data?.data || [])
    } catch {
      toast.error('Failed to load supplier logs.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleRecordPayment = async (data) => {
    setRecordingPayment(true)
    try {
      const payload = {
        amount: Number(data.amount),
        method: data.method,
        reference_no: data.reference_no,
        notes: data.notes,
        paid_at: data.paid_at,
      }
      await api.post(`/api/v1/suppliers/${detailsSupplier.id}/payments`, payload)
      toast.success('Supplier payment recorded successfully!')
      setRecordPaymentOpen(false)
      resetPay()
      // Reload logs
      viewDetails(detailsSupplier)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to record supplier payment.')
    } finally {
      setRecordingPayment(false)
    }
  }

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const loadSuppliers = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/suppliers?page=${page}&search=${search}&limit=10`)
      setSuppliers(res.data.data || [])
      setTotal(res.data.meta?.total || 0)
    } catch (err) {
      toast.error('Failed to load suppliers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSuppliers()
  }, [page, search])

  const openCreateModal = () => {
    setEditingSupplier(null)
    reset({
      name: '',
      email: '',
      phone: '',
      gstin: '',
      address: '',
      notes: '',
    })
    setModalOpen(true)
  }

  const openEditModal = (sup) => {
    setEditingSupplier(sup)
    reset({
      name: sup.name,
      email: sup.email || '',
      phone: sup.phone || '',
      gstin: sup.gstin || '',
      address: sup.address || '',
      notes: sup.notes || '',
    })
    setModalOpen(true)
  }

  const openDeleteDialog = (id) => {
    setSelectedSupplierId(id)
    setDeleteOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (editingSupplier) {
        await api.put(`/api/v1/suppliers/${editingSupplier.id}`, data)
        toast.success('Supplier updated successfully.')
      } else {
        await api.post('/api/v1/suppliers', data)
        toast.success('Supplier created successfully.')
      }
      setModalOpen(false)
      loadSuppliers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save supplier.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await api.delete(`/api/v1/suppliers/${selectedSupplierId}`)
      toast.success('Supplier deleted successfully.')
      setDeleteOpen(false)
      loadSuppliers()
    } catch (err) {
      toast.error('Failed to delete supplier.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Banner */}
      <div className="page-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="page-banner-title">Suppliers Directory</h1>
          <p className="page-banner-sub">Manage vendors used for purchase orders and procurement</p>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={openCreateModal}>
            <Plus size={14} /> Add Supplier
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
              placeholder="Search suppliers by name, email, phone..."
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
        ) : suppliers.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact Info</th>
                  <th>GSTIN</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((sup) => (
                  <tr key={sup.id}>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{sup.name}</div>
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Mail className="h-3.5 w-3.5 text-slate-400" /> {sup.email || 'N/A'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" /> {sup.phone || 'N/A'}
                      </div>
                    </td>
                    <td>
                      {sup.gstin
                        ? <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-mono">{sup.gstin}</span>
                        : <span className="text-xs text-slate-400">N/A</span>}
                    </td>
                    <td>
                      <Badge variant={sup.is_active ? 'success' : 'slate'}>
                        {sup.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => viewDetails(sup)} className="btn-icon-only text-indigo-500" title="Purchase History & Payments">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEditModal(sup)} className="btn-icon-only" title="Edit Supplier">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => openDeleteDialog(sup.id)} className="btn-icon-only text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20" title="Delete Supplier">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
            title="No suppliers registered"
            description="You don't have any suppliers saved in this workspace yet."
            actionText="Add Supplier"
            onAction={openCreateModal}
          />
        )}
      </div>

      {/* Save Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Supplier Name"
              placeholder="Acme Distributors Pvt Ltd"
              required
              error={errors.name?.message}
              {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Name must be at least 2 characters.' } })}
            />
            <Input
              label="Email Address"
              placeholder="orders@supplier.com"
              type="email"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Phone Number"
              placeholder="+91 9999999999"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="GSTIN Number (Optional)"
              placeholder="29AAAAA0000A1Z5"
              error={errors.gstin?.message}
              {...register('gstin')}
            />
          </div>

          <div className="divider" />

          <div className="form-group">
            <label className="form-label">Address</label>
            <textarea
              rows={3}
              className="input-field"
              placeholder="Warehouse / registered office address"
              {...register('address')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              rows={2}
              className="input-field"
              placeholder="Payment terms, contact person, delivery notes..."
              {...register('notes')}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Save Supplier
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message="Are you sure you want to delete this supplier? Purchase orders referencing this supplier will keep their history."
        confirmText="Yes, delete supplier"
        isLoading={saving}
      />

      {/* Details & Payments Modal */}
      <Modal
        isOpen={Boolean(detailsSupplier)}
        onClose={() => setDetailsSupplier(null)}
        title={`Supplier Details — ${detailsSupplier?.name || ''}`}
        size="lg"
      >
        {detailsSupplier && (
          <div className="space-y-6">
            {/* Quick Metrics */}
            {purchaseHistory && (
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total PO Amount</div>
                  <div className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1">
                    ₹ {Number(purchaseHistory.summary.total_amount).toFixed(2)}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Received</div>
                  <div className="text-lg font-black text-emerald-500 mt-1">
                    ₹ {Number(purchaseHistory.summary.total_received).toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end">
              <Button
                variant="primary"
                size="sm"
                icon={CreditCard}
                onClick={() => {
                  resetPay({
                    amount: '',
                    method: 'cash',
                    reference_no: '',
                    notes: '',
                    paid_at: new Date().toISOString().split('T')[0]
                  })
                  setRecordPaymentOpen(true)
                }}
              >
                Record Supplier Payment
              </Button>
            </div>

            {/* Tabs / Logs Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Purchase History */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase Orders</h3>
                {historyLoading ? (
                  <div className="p-4 text-center"><div className="spinner mx-auto" /></div>
                ) : purchaseHistory?.items?.length > 0 ? (
                  <div className="table-container max-h-[250px] overflow-y-auto">
                    <table className="data-table text-[11px]">
                      <thead>
                        <tr>
                          <th>PO No</th>
                          <th>Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {purchaseHistory.items.map(po => (
                          <tr key={po.id}>
                            <td className="font-semibold">#{po.po_no}</td>
                            <td>₹ {Number(po.total).toFixed(2)}</td>
                            <td><Badge status={po.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-4 text-center">No POs logged.</p>
                )}
              </div>

              {/* Payments log */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Payments Made</h3>
                {historyLoading ? (
                  <div className="p-4 text-center"><div className="spinner mx-auto" /></div>
                ) : paymentsLog.length > 0 ? (
                  <div className="table-container max-h-[250px] overflow-y-auto">
                    <table className="data-table text-[11px]">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Method</th>
                          <th>Ref</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentsLog.map(p => (
                          <tr key={p.id}>
                            <td>{p.paid_at}</td>
                            <td className="font-semibold text-rose-500">₹ {Number(p.amount).toFixed(2)}</td>
                            <td className="uppercase">{p.method}</td>
                            <td className="text-slate-500">{p.reference_no || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-4 text-center">No payouts logged.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Sub-modal */}
      <Modal
        isOpen={recordPaymentOpen}
        onClose={() => setRecordPaymentOpen(false)}
        title="Record Supplier Payout"
        size="sm"
      >
        <form onSubmit={handlePaySubmit(handleRecordPayment)} className="space-y-4">
          <Input
            label="Amount (INR)"
            type="number"
            placeholder="0.00"
            required
            {...regPay('amount', { required: 'Amount is required' })}
          />

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="input-field" required {...regPay('method', { required: 'Method is required' })}>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </div>

          <Input
            label="Payment Date"
            type="date"
            required
            {...regPay('paid_at', { required: 'Date is required' })}
          />

          <Input
            label="Reference No"
            placeholder="Txn ID, Cheque No, etc."
            {...regPay('reference_no')}
          />

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              rows={2}
              className="input-field"
              placeholder="Internal notes..."
              {...regPay('notes')}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setRecordPaymentOpen(false)} disabled={recordingPayment}>
              Cancel
            </Button>
            <Button type="submit" isLoading={recordingPayment}>
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
