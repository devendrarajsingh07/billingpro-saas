import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, FileText, Download, CreditCard, Eye, Trash2, Mail, MessageCircle, Copy } from 'lucide-react'
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

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [customers, setCustomers] = useState([])
  const [products, setProducts] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const { company } = useAuth()

  // Modal actions
  const [createOpen, setCreateOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [saving, setSaving] = useState(false)
  const [sendingId, setSendingId] = useState(null)
  const [payingOnline, setPayingOnline] = useState(false)
  const [isNewCustomer, setIsNewCustomer] = useState(false)

  const { register, handleSubmit, control, watch, setValue, reset, formState: { errors } } = useForm({
    defaultValues: {
      customer_id: '',
      date: new Date().toISOString().split('T')[0],
      due_date: '',
      discount_type: 'percentage',
      discount_value: 0,
      is_recurring: false,
      recurring_interval: 'monthly',
      items: [{ product_id: '', description: '', qty: 1, unit_price: 0, tax_rate: 18, total: 0 }],
      subtotal: 0,
      tax_amount: 0,
      grand_total: 0,
    }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchItems = watch('items')
  const watchDiscountType = watch('discount_type')
  const watchDiscountValue = watch('discount_value')
  const watchIsRecurring = watch('is_recurring')

  const { register: regPay, handleSubmit: handlePaySubmit, reset: resetPay } = useForm()

  // Auto-open create modal when navigated here with ?create=true (e.g. from Dashboard)
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      setCreateOpen(true)
      searchParams.delete('create')
      setSearchParams(searchParams, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const loadInvoices = async () => {
    setLoading(true)
    try {
      const [iRes, cRes, pRes] = await Promise.all([
        api.get(`/api/v1/invoices?page=${page}&search=${search}&limit=10`),
        api.get('/api/v1/customers?limit=100'),
        api.get('/api/v1/products?limit=100')
      ])
      setInvoices(iRes.data.data || [])
      setTotal(iRes.data.meta?.total || 0)
      setCustomers(cRes.data.data || [])
      setProducts(pRes.data.data || [])
    } catch (err) {
      toast.error('Failed to load invoice workspaces details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [page, search])

  // Recalculate totals automatically
  useEffect(() => {
    if (!watchItems) return

    let subtotal = 0
    const preparedItems = watchItems.map((item) => {
      const qty = Number(item.qty) || 0
      const price = Number(item.unit_price) || 0
      const taxRate = Number(item.tax_rate) || 0
      const lineBase = qty * price
      subtotal += lineBase
      return { item, lineBase, taxRate }
    })

    const discValue = Number(watchDiscountValue) || 0
    const requestedDiscount = watchDiscountType === 'percentage'
      ? subtotal * (discValue / 100)
      : discValue
    const discAmount = Math.min(Math.max(0, requestedDiscount), subtotal)
    let tax_amount = 0

    preparedItems.forEach(({ item, lineBase, taxRate }, idx) => {
      const allocatedDiscount = subtotal > 0 ? discAmount * (lineBase / subtotal) : 0
      const taxableAmount = Math.max(0, lineBase - allocatedDiscount)
      const taxItem = taxableAmount * (taxRate / 100)
      const currentTotal = Math.round((taxableAmount + taxItem) * 100) / 100
      tax_amount += taxItem
      if (item.total !== currentTotal) {
        setValue(`items.${idx}.total`, currentTotal)
      }
    })

    const grand = Math.max(0, subtotal - discAmount + tax_amount)

    setValue('subtotal', subtotal)
    setValue('tax_amount', tax_amount)
    setValue('grand_total', grand)
  }, [watchItems, watchDiscountType, watchDiscountValue])

  const openCreateModal = () => {
    setIsNewCustomer(false)
    reset({
      customer_id: '',
      new_customer_name: '',
      new_customer_email: '',
      new_customer_phone: '',
      new_customer_gstin: '',
      new_customer_billing_address: '',
      new_customer_shipping_address: '',
      date: new Date().toISOString().split('T')[0],
      due_date: '',
      discount_type: 'percentage',
      discount_value: 0,
      is_recurring: false,
      recurring_interval: 'monthly',
      items: [{ product_id: '', description: '', qty: 1, unit_price: 0, tax_rate: 18, total: 0 }],
      subtotal: 0,
      tax_amount: 0,
      grand_total: 0,
    })
    setCreateOpen(true)
  }

  const openPayModal = (inv) => {
    setSelectedInvoice(inv)
    resetPay({
      amount: inv.amount_due,
      method: 'cash',
      reference_no: '',
      notes: '',
      paid_at: new Date().toISOString().split('T')[0]
    })
    setPayOpen(true)
  }

  const openDeleteDialog = (inv) => {
    setSelectedInvoice(inv)
    setDeleteOpen(true)
  }

  const handleProductChange = (prodId, idx) => {
    const prod = products.find(p => p.id === Number(prodId))
    if (prod) {
      setValue(`items.${idx}.description`, prod.name)
      setValue(`items.${idx}.unit_price`, prod.selling_price)
    }
  }

  const onSubmit = async (data) => {
    setSaving(true)
    try {
      let finalCustomerId = data.customer_id

      if (isNewCustomer) {
        // 1. Create the new customer first
        const custRes = await api.post('/api/v1/customers', {
          name: data.new_customer_name,
          email: data.new_customer_email,
          phone: data.new_customer_phone,
          gstin: data.new_customer_gstin,
          billing_address: data.new_customer_billing_address,
          shipping_address: data.new_customer_shipping_address,
          credit_limit: 0,
          payment_terms: 'net30',
        })
        
        if (custRes.data?.success) {
          finalCustomerId = custRes.data.data.id
          // Refresh customer listing so they show up in other dropdowns
          const cRes = await api.get('/api/v1/customers?limit=100')
          setCustomers(cRes.data.data || [])
        } else {
          throw new Error(custRes.data?.message || 'Failed to register the new customer.')
        }
      }

      // 2. Submit the invoice
      const invoicePayload = {
        ...data,
        customer_id: Number(finalCustomerId),
      }
      
      // Clean up temporary fields
      delete invoicePayload.new_customer_name
      delete invoicePayload.new_customer_email
      delete invoicePayload.new_customer_phone
      delete invoicePayload.new_customer_gstin
      delete invoicePayload.new_customer_billing_address
      delete invoicePayload.new_customer_shipping_address

      await api.post('/api/v1/invoices', invoicePayload)
      toast.success('Invoice created successfully.')
      setCreateOpen(false)
      loadInvoices()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Failed to create invoice.')
    } finally {
      setSaving(false)
    }
  }

  const onSubmitPayment = async (data) => {
    setSaving(true)
    try {
      await api.post('/api/v1/payments', {
        ...data,
        invoice_id: selectedInvoice.id
      })
      toast.success('Payment recorded successfully.')
      setPayOpen(false)
      loadInvoices()
    } catch (err) {
      toast.error('Failed to record payment details.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setSaving(true)
    try {
      await api.delete(`/api/v1/invoices/${selectedInvoice.id}`)
      toast.success('Invoice deleted successfully.')
      setDeleteOpen(false)
      loadInvoices()
    } catch (err) {
      toast.error('Failed to delete invoice.')
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async (invId) => {
    try {
      toast.loading('Duplicating invoice...', { id: 'dup' })
      const res = await api.post(`/api/v1/invoices/${invId}/duplicate`)
      toast.success(res.data?.message || 'Invoice duplicated as a draft!', { id: 'dup' })
      loadInvoices()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to duplicate invoice.', { id: 'dup' })
    }
  }

  const downloadPDF = async (invId, invoiceNo) => {
    toast.loading('Generating invoice PDF...', { id: 'pdf' })
    try {
      const res = await api.get(`/api/v1/invoices/${invId}/pdf`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `Invoice-${invoiceNo}.pdf`
      link.click()
      toast.success('PDF download started!', { id: 'pdf' })
    } catch (err) {
      toast.error('Failed to download invoice PDF.', { id: 'pdf' })
    }
  }

  const handleSendInvoice = async (invId, channel = 'email') => {
    setSendingId(invId)
    try {
      const res = await api.post(`/api/v1/invoices/${invId}/send`, { channel })
      toast.success(res.data.message || 'Invoice sent successfully.')
      loadInvoices()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send invoice.')
    } finally {
      setSendingId(null)
    }
  }

  const loadRazorpayScript = () => new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })

  const handlePayOnline = async () => {
    if (!selectedInvoice) return
    setPayingOnline(true)
    try {
      const scriptLoaded = await loadRazorpayScript()
      if (!scriptLoaded) {
        toast.error('Failed to load the payment gateway. Check your internet connection.')
        return
      }

      const orderRes = await api.post('/api/v1/payment-gateway/razorpay/create-order', {
        invoice_id: selectedInvoice.id,
      })
      const { order_id, amount, currency, key_id, invoice_no } = orderRes.data.data

      const rzp = new window.Razorpay({
        key: key_id,
        amount,
        currency,
        order_id,
        name: company?.name || 'Invoice Payment',
        description: `Payment for Invoice #${invoice_no}`,
        prefill: { email: selectedInvoice.customer_email, contact: selectedInvoice.customer_phone },
        theme: { color: '#6366f1' },
        handler: async (response) => {
          try {
            await api.post('/api/v1/payment-gateway/razorpay/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              invoice_id: selectedInvoice.id,
            })
            toast.success('Payment received and verified successfully!')
            setPayOpen(false)
            loadInvoices()
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment succeeded but verification failed — contact support.')
          } finally {
            setPayingOnline(false)
          }
        },
        modal: {
          ondismiss: () => setPayingOnline(false),
        },
      })

      rzp.open()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start online payment.')
      setPayingOnline(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Banner */}
      <div className="page-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="page-banner-title">Invoice Management</h1>
          <p className="page-banner-sub">Create GST-ready invoices and record customer collections</p>
        </div>
        <div className="page-banner-actions">
          <button className="page-banner-btn" onClick={openCreateModal}>
            <Plus size={14} /> New Invoice
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
              placeholder="Search invoices by invoice number..."
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
        ) : invoices.length > 0 ? (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Customer Name</th>
                  <th>Date</th>
                  <th>Grand Total</th>
                  <th>Amount Due</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td>
                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-slate-400" /> #{inv.invoice_no}
                      </div>
                    </td>
                    <td>{inv.customer_name}</td>
                    <td>{formatDate(inv.date)}</td>
                    <td className="font-semibold">{formatCurrency(inv.grand_total, company?.currency_code)}</td>
                    <td className={`font-semibold ${inv.amount_due > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {formatCurrency(inv.amount_due, company?.currency_code)}
                    </td>
                    <td>
                      <Badge status={inv.status} />
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => downloadPDF(inv.id, inv.invoice_no)}
                          className="btn-icon-only text-indigo-500"
                          title="Download PDF"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {inv.status !== 'cancelled' && (
                          <button
                            onClick={() => handleSendInvoice(inv.id, 'email')}
                            className="btn-icon-only text-sky-500"
                            title="Email Invoice to Customer"
                            disabled={sendingId === inv.id}
                          >
                            <Mail className="h-4 w-4" />
                          </button>
                        )}
                        {inv.status !== 'cancelled' && inv.customer_phone && (
                          <button
                            onClick={() => handleSendInvoice(inv.id, 'whatsapp')}
                            className="btn-icon-only text-emerald-600"
                            title="Send via WhatsApp"
                            disabled={sendingId === inv.id}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDuplicate(inv.id)}
                          className="btn-icon-only text-amber-500"
                          title="Duplicate Invoice"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                        {inv.amount_due > 0 && inv.status !== 'cancelled' && (
                          <button
                            onClick={() => openPayModal(inv)}
                            className="btn-icon-only text-emerald-500"
                            title="Record Payment"
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openDeleteDialog(inv)}
                          className="btn-icon-only text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                          title="Delete Invoice"
                        >
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
            title="No invoices created"
            description="You don't have any billing statements saved in this workspace yet."
            actionText="Create Invoice"
            onAction={openCreateModal}
          />
        )}
      </div>

      {/* Invoice Wizard Modal */}
      <Modal
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Professional Invoice"
        size="xl"
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Customer Mode Selection */}
          <div className="flex gap-4 border-b border-slate-100 dark:border-slate-800 pb-3 mb-2">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-200">
              <input
                type="radio"
                name="customer_mode"
                checked={!isNewCustomer}
                onChange={() => setIsNewCustomer(false)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
              />
              Select Existing Customer
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer text-slate-700 dark:text-slate-200">
              <input
                type="radio"
                name="customer_mode"
                checked={isNewCustomer}
                onChange={() => setIsNewCustomer(true)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
              />
              Create New Customer
            </label>
          </div>

          {!isNewCustomer ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <select className="input-field" {...register('customer_id', { required: !isNewCustomer ? 'Customer is required' : false })}>
                  <option value="">Select Customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {errors.customer_id && <p className="form-error">{errors.customer_id.message}</p>}
              </div>
              <Input
                label="Invoice Date"
                type="date"
                required
                {...register('date', { required: 'Date is required' })}
              />
              <Input
                label="Payment Due Date"
                type="date"
                {...register('due_date')}
              />
            </div>
          ) : (
            <div className="space-y-4 border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 p-4 rounded-xl">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="New Customer Name *"
                  placeholder="Acme Inc."
                  error={errors.new_customer_name?.message}
                  {...register('new_customer_name', { required: isNewCustomer ? 'Name is required' : false })}
                />
                <Input
                  label="Email Address"
                  placeholder="billing@acme.com"
                  type="email"
                  error={errors.new_customer_email?.message}
                  {...register('new_customer_email')}
                />
                <Input
                  label="Phone Number"
                  placeholder="+91 9999999999"
                  error={errors.new_customer_phone?.message}
                  {...register('new_customer_phone')}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="GSTIN Number (Optional)"
                  placeholder="29AAAAA0000A1Z5"
                  error={errors.new_customer_gstin?.message}
                  {...register('new_customer_gstin')}
                />
                <div className="form-group">
                  <label className="form-label">Billing Address</label>
                  <textarea
                    rows={1}
                    className="input-field py-2"
                    placeholder="123 Corporate St, Bengaluru"
                    {...register('new_customer_billing_address')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Shipping Address</label>
                  <textarea
                    rows={1}
                    className="input-field py-2"
                    placeholder="Same as billing"
                    {...register('new_customer_shipping_address')}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Input
                  label="Invoice Date"
                  type="date"
                  required
                  {...register('date', { required: 'Date is required' })}
                />
                <Input
                  label="Payment Due Date"
                  type="date"
                  {...register('due_date')}
                />
              </div>
            </div>
          )}

          <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
              <input type="checkbox" className="h-4 w-4" {...register('is_recurring')} />
              Make this a recurring invoice
            </label>
            {watchIsRecurring && (
              <select className="input-field max-w-[160px]" {...register('recurring_interval')}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </div>

          <div className="divider" />
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Line Items</h3>
          
          <div className="space-y-3">
            {fields.map((field, idx) => (
              <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                <div className="form-group md:col-span-3">
                  <label className="form-label text-slate-400 text-[10px]">Select Product</label>
                  <select
                    className="input-field"
                    {...register(`items.${idx}.product_id`, {
                      onChange: (e) => handleProductChange(e.target.value, idx),
                    })}
                  >
                    <option value="">Select Catalog Item</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <Input
                  label="Description Details"
                  className="md:col-span-3"
                  labelStyle="text-slate-400 text-[10px]"
                  placeholder="Items or consulting description details..."
                  required
                  {...register(`items.${idx}.description`, { required: 'Description details required' })}
                />

                <Input
                  label="Quantity"
                  type="number"
                  className="md:col-span-1"
                  {...register(`items.${idx}.qty`, { required: true })}
                />

                <Input
                  label="Rate / Price"
                  type="number"
                  className="md:col-span-2"
                  {...register(`items.${idx}.unit_price`, { required: true })}
                />

                <div className="form-group md:col-span-1.5">
                  <label className="form-label text-slate-400 text-[10px]">Tax (GST)</label>
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

            <Button variant="secondary" size="sm" onClick={() => append({ product_id: '', description: '', qty: 1, unit_price: 0, tax_rate: 18, total: 0 })}>
              Add Line Item
            </Button>
          </div>

          <div className="divider" />

          {/* Totals Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6 space-y-4">
              <div className="form-group">
                <label className="form-label">Client Notes & Payment details</label>
                <textarea rows={2} className="input-field" placeholder="Mention Bank details, wire instruction, or greetings..." {...register('notes')} />
              </div>
              <div className="form-group">
                <label className="form-label">Terms and Conditions</label>
                <textarea rows={2} className="input-field" placeholder="1. Payment due within invoice cycle. 2. Interest charged for delays..." {...register('terms_conditions')} />
              </div>
            </div>

            <div className="md:col-span-6 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-500">Subtotal:</span>
                <span className="text-slate-800 dark:text-slate-200">{formatCurrency(watch('subtotal'), company?.currency_code)}</span>
              </div>
              
              <div className="flex gap-2 items-center">
                <span className="text-slate-500 font-semibold flex-1">Discount:</span>
                <select className="input-field py-1 max-w-[100px] text-xs" {...register('discount_type')}>
                  <option value="percentage">% Percent</option>
                  <option value="amount">Fixed Amount</option>
                </select>
                <input type="number" className="input-field py-1 max-w-[100px] text-xs text-right" {...register('discount_value')} />
              </div>

              <div className="flex justify-between font-semibold">
                <span className="text-slate-500">Tax Amount (GST):</span>
                <span className="text-slate-800 dark:text-slate-200">{formatCurrency(watch('tax_amount'), company?.currency_code)}</span>
              </div>
              
              <div className="divider my-2" />
              
              <div className="flex justify-between font-bold text-sm text-indigo-500">
                <span>Grand Total:</span>
                <span>{formatCurrency(watch('grand_total'), company?.currency_code)}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Create Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={payOpen}
        onClose={() => setPayOpen(false)}
        title="Record Payment Receipt"
        size="sm"
      >
        <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-xl mb-4 text-xs leading-normal">
          <div className="font-bold text-slate-800 dark:text-slate-200">Invoice #{selectedInvoice?.invoice_no}</div>
          <div className="text-slate-400 mb-3">Total Outstanding: <span className="font-bold text-rose-500">{formatCurrency(selectedInvoice?.amount_due, company?.currency_code)}</span></div>
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={handlePayOnline}
            isLoading={payingOnline}
          >
            Pay Online with Razorpay
          </Button>
          <p className="text-[9px] text-slate-400 mt-1.5">Or record a manually received payment below.</p>
        </div>

        <form onSubmit={handlePaySubmit(onSubmitPayment)} className="space-y-4">
          <Input
            label="Payment Amount Received"
            type="number"
            required
            {...regPay('amount', { required: true })}
          />

          <div className="form-group">
            <label className="form-label">Payment Method</label>
            <select className="input-field" {...regPay('method')}>
              <option value="cash">Cash Handover</option>
              <option value="bank">Bank Wire Transfer</option>
              <option value="upi">UPI / Net Banking</option>
              <option value="stripe">Stripe Gateway</option>
              <option value="razorpay">Razorpay UPI</option>
              <option value="cheque">Company Cheque</option>
            </select>
          </div>

          <Input
            label="Date of Payment"
            type="date"
            required
            {...regPay('paid_at', { required: true })}
          />

          <Input
            label="Transaction Reference No."
            placeholder="TXN9876543210"
            {...regPay('reference_no')}
          />

          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea rows={2} className="input-field" placeholder="Client receipt note..." {...regPay('notes')} />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="secondary" onClick={() => setPayOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Invoice"
        message="Are you sure you want to delete this invoice? This will rollback customer balance allocations."
        confirmText="Yes, delete invoice"
        isLoading={saving}
      />
    </div>
  )
}
