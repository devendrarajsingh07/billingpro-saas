import React, { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Search, Mail, Phone, MapPin, Eye, FileText, Download, Calendar } from 'lucide-react'
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

export default function Customers() {
  const [customers, setCustomers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { company } = useAuth()

  // Modals state
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [selectedCustomerId, setSelectedCustomerId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Details & statement state
  const [detailsCustomer, setDetailsCustomer] = useState(null)
  const [purchaseHistory, setPurchaseHistory] = useState(null)
  const [historyLoading, setHistoryLoading]   = useState(false)

  const viewDetails = async (cust) => {
    setDetailsCustomer(cust)
    setHistoryLoading(true)
    try {
      const res = await api.get(`/api/v1/customers/${cust.id}/purchase-history`)
      setPurchaseHistory(res.data?.data)
    } catch {
      toast.error('Failed to load purchase history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  const downloadStatement = async (custId, custName) => {
    toast.loading('Generating account statement...', { id: 'stmt' })
    try {
      const res = await api.get(`/api/v1/customers/${custId}/statement`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `statement-${custName.replace(/\s+/g, '_')}.pdf`
      link.click()
      toast.success('Statement downloaded!', { id: 'stmt' })
    } catch {
      toast.error('Failed to download statement.', { id: 'stmt' })
    }
  }

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm()

  const loadCustomers = async () => {
    setLoading(true)
    try {
      const res = await api.get(`/api/v1/customers?page=${page}&search=${search}&limit=10`)
      setCustomers(res.data.data || [])
      setTotal(res.data.meta?.total || 0)
    } catch (err) {
      toast.error('Failed to load customers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [page, search])

  const openCreateModal = () => {
    setEditingCustomer(null)
    reset({
      name: '',
      email: '',
      phone: '',
      gstin: '',
      billing_address: '',
      shipping_address: '',
      credit_limit: 0,
      payment_terms: 'net30',
    })
    setModalOpen(true)
  }

  const openEditModal = (cust) => {
    setEditingCustomer(cust)
    reset({
      name: cust.name,
      email: cust.email || '',
      phone: cust.phone || '',
      gstin: cust.gstin || '',
      billing_address: cust.billing_address || '',
      shipping_address: cust.shipping_address || '',
      credit_limit: cust.credit_limit || 0,
      payment_terms: cust.payment_terms || 'net30',
    })
    setModalOpen(true)
  }

  const openDeleteDialog = (id) => {
    setSelectedCustomerId(id)
    setDeleteOpen(true)
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      if (editingCustomer) {
        await api.put(`/api/v1/customers/${editingCustomer.id}`, data)
        toast.success('Customer updated successfully.')
      } else {
        await api.post('/api/v1/customers', data)
        toast.success('Customer created successfully.')
      }
      setModalOpen(false)
      loadCustomers()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save customer.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await api.delete(`/api/v1/customers/${selectedCustomerId}`)
      toast.success('Customer deleted successfully.')
      setDeleteOpen(false)
      loadCustomers()
    } catch (err) {
      toast.error('Failed to delete customer.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Banner */}
      <div className="page-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="page-banner-title">Customers Directory</h1>
          <p className="page-banner-sub">Manage customer profiles, balances, and account statements</p>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={openCreateModal}>
            <Plus size={14} /> Add Customer
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
              placeholder="Search customers by name, email, phone..."
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
        ) : customers.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact Info</th>
                  <th>Outstanding Balance</th>
                  <th>Total Invoiced</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((cust) => (
                  <tr key={cust.id}>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{cust.name}</div>
                      {cust.gstin && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded font-mono">GSTIN: {cust.gstin}</span>}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Mail className="h-3.5 w-3.5 text-slate-400" /> {cust.email || 'N/A'}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                        <Phone className="h-3.5 w-3.5 text-slate-400" /> {cust.phone || 'N/A'}
                      </div>
                    </td>
                    <td className="font-semibold text-rose-500">
                      {formatCurrency(cust.outstanding, company?.currency_code)}
                    </td>
                    <td>
                      {formatCurrency(cust.total_invoiced, company?.currency_code)}
                    </td>
                    <td>
                      <Badge variant={cust.is_active ? 'success' : 'slate'}>
                        {cust.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <button onClick={() => viewDetails(cust)} className="btn-icon-only text-indigo-500" title="Purchase History & Statement">
                          <Eye className="h-4 w-4" />
                        </button>
                        <button onClick={() => openEditModal(cust)} className="btn-icon-only" title="Edit Customer">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => openDeleteDialog(cust.id)} className="btn-icon-only text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20" title="Delete Customer">
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
            title="No customers registered"
            description="You don't have any customers saved in this workspace yet."
            actionText="Register Customer"
            onAction={openCreateModal}
          />
        )}
      </div>

      {/* Save Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCustomer ? 'Edit Customer' : 'Add New Customer'}
        size="lg"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Customer Name"
              placeholder="Acme Inc."
              required
              error={errors.name?.message}
              {...register('name', { required: 'Name is required' })}
            />
            <Input
              label="Email Address"
              placeholder="billing@acme.com"
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
            <Input
              label="Credit Limit"
              placeholder="50000"
              type="number"
              error={errors.credit_limit?.message}
              {...register('credit_limit')}
            />
            <div className="form-group">
              <label className="form-label">Payment Terms</label>
              <select className="input-field" {...register('payment_terms')}>
                <option value="net30">Net 30 Days</option>
                <option value="net60">Net 60 Days</option>
                <option value="net90">Net 90 Days</option>
                <option value="immediate">Due on Receipt</option>
              </select>
            </div>
          </div>
          
          <div className="divider" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-group">
              <label className="form-label">Billing Address</label>
              <textarea
                rows={3}
                className="input-field"
                placeholder="123 Corporate St, Bengaluru"
                {...register('billing_address')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Shipping Address</label>
              <textarea
                rows={3}
                className="input-field"
                placeholder="Same as billing"
                {...register('shipping_address')}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Save Customer
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This will hide the customer and all billing statistics from your tables."
        confirmText="Yes, delete customer"
        isLoading={saving}
      />

      {/* Details & Statement Modal */}
      <Modal
        isOpen={Boolean(detailsCustomer)}
        onClose={() => setDetailsCustomer(null)}
        title={`Customer Details — ${detailsCustomer?.name || ''}`}
        size="lg"
      >
        {detailsCustomer && (
          <div className="space-y-6">
            {/* Action Bar */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
              <div>
                <span className="text-xs text-slate-400">Account Statement</span>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Generate complete transaction history ledger</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Download}
                onClick={() => downloadStatement(detailsCustomer.id, detailsCustomer.name)}
              >
                Download Statement PDF
              </Button>
            </div>

            {/* Quick Metrics */}
            {purchaseHistory && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Invoiced</div>
                  <div className="text-lg font-black text-slate-800 dark:text-slate-100 mt-1">
                    {formatCurrency(purchaseHistory.summary.total_billed, company?.currency_code)}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Total Paid</div>
                  <div className="text-lg font-black text-emerald-500 mt-1">
                    {formatCurrency(purchaseHistory.summary.total_paid, company?.currency_code)}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl text-center">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Balance Due</div>
                  <div className="text-lg font-black text-rose-500 mt-1">
                    {formatCurrency(purchaseHistory.summary.total_due, company?.currency_code)}
                  </div>
                </div>
              </div>
            )}

            {/* Invoices List */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Purchase History (Invoices)</h3>

              {historyLoading ? (
                <div className="p-8 text-center"><div className="spinner mx-auto" /></div>
              ) : purchaseHistory?.items?.length > 0 ? (
                <div className="table-container">
                  <table className="data-table text-xs">
                    <thead>
                      <tr>
                        <th>Invoice No</th>
                        <th>Date</th>
                        <th>Grand Total</th>
                        <th>Balance Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseHistory.items.map((inv) => (
                        <tr key={inv.id}>
                          <td className="font-bold flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5 text-slate-400" /> #{inv.invoice_no}
                          </td>
                          <td>{inv.date}</td>
                          <td className="font-semibold">{formatCurrency(inv.grand_total, company?.currency_code)}</td>
                          <td className={`font-semibold ${inv.amount_due > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                            {formatCurrency(inv.amount_due, company?.currency_code)}
                          </td>
                          <td>
                            <Badge status={inv.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-xs text-slate-500 py-6">No purchases logged for this customer.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
