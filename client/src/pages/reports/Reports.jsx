import React, { useState } from 'react'
import { BarChart3, Calendar, FileSpreadsheet, Percent, Calculator, Truck, Package, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../services/api'
import { formatCurrency } from '../../utils/formatters'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import { useAuth } from '../../context/AuthContext'

export default function Reports() {
  const { company } = useAuth()
  const [fromDate, setFromDate] = useState('2026-04-01')
  const [toDate, setToDate] = useState('2026-07-31')
  const [loading, setLoading] = useState(false)
  const [reportType, setReportType] = useState('pl') // 'pl' | 'tax' | 'supplier-spend' | 'inventory-valuation' | 'po-aging'

  const [plData, setPlData] = useState(null)
  const [taxData, setTaxData] = useState(null)
  const [supplierSpendData, setSupplierSpendData] = useState(null)
  const [valuationData, setValuationData] = useState(null)
  const [agingData, setAgingData] = useState(null)

  const NO_DATE_RANGE_TYPES = ['inventory-valuation', 'po-aging']

  const generateReport = async () => {
    if (!NO_DATE_RANGE_TYPES.includes(reportType) && (!fromDate || !toDate)) {
      toast.error('Please select both start and end dates.')
      return
    }

    setLoading(true)
    try {
      if (reportType === 'pl') {
        const res = await api.get(`/api/v1/reports/profit-loss?from_date=${fromDate}&to_date=${toDate}`)
        setPlData(res.data.data)
      } else if (reportType === 'tax') {
        const res = await api.get(`/api/v1/reports/tax?from_date=${fromDate}&to_date=${toDate}`)
        setTaxData(res.data.data)
      } else if (reportType === 'supplier-spend') {
        const res = await api.get(`/api/v1/reports/supplier-spend?from_date=${fromDate}&to_date=${toDate}`)
        setSupplierSpendData(res.data.data)
      } else if (reportType === 'inventory-valuation') {
        const res = await api.get('/api/v1/reports/inventory-valuation')
        setValuationData(res.data.data)
      } else if (reportType === 'po-aging') {
        const res = await api.get('/api/v1/reports/po-aging')
        setAgingData(res.data.data)
      }
      toast.success('Report generated successfully!')
    } catch (err) {
      toast.error('Failed to generate report details.')
    } finally {
      setLoading(false)
    }
  }

  const hasAnyReport = plData || taxData || supplierSpendData || valuationData || agingData

  return (
    <div className="space-y-6">
      {/* Page Banner */}
      <div className="page-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 className="page-banner-title">Analytical Reports</h1>
          <p className="page-banner-sub">Generate P&L, tax summaries, supplier spend, and inventory reports</p>
        </div>
      </div>


      {/* Date Filter & Tab Card */}
      <div className="card">
        <div className="card-body flex flex-col md:flex-row gap-4 items-end">
          <div className="form-group flex-1">
            <label className="form-label">Report Module</label>
            <select
              className="input-field"
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value)
                setPlData(null)
                setTaxData(null)
                setSupplierSpendData(null)
                setValuationData(null)
                setAgingData(null)
              }}
            >
              <option value="pl">Profit & Loss Statement</option>
              <option value="tax">Tax Summary (GST/VAT)</option>
              <option value="supplier-spend">Supplier Spend</option>
              <option value="inventory-valuation">Inventory Valuation</option>
              <option value="po-aging">Purchase Order Aging</option>
            </select>
          </div>

          {!NO_DATE_RANGE_TYPES.includes(reportType) && (
            <>
              <Input
                label="Start Date"
                type="date"
                className="flex-1"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />

              <Input
                label="End Date"
                type="date"
                className="flex-1"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </>
          )}

          <Button
            variant="primary"
            className="w-full md:w-auto"
            onClick={generateReport}
            isLoading={loading}
            icon={BarChart3}
          >
            Generate Report
          </Button>
        </div>
      </div>

      {/* Report Render Screen */}
      {plData && reportType === 'pl' && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="card-title">Profit and Loss Statement</h3>
            <span className="text-xs text-slate-400 font-semibold">Period: {fromDate} to {toDate}</span>
          </div>
          <div className="card-body max-w-xl space-y-4">
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total Operating Income (Sales):</span>
              <span className="text-base font-bold text-emerald-500">{formatCurrency(plData.income, company?.currency_code)}</span>
            </div>
            
            <div className="flex justify-between items-center py-2.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total Operating Expenses:</span>
              <span className="text-base font-bold text-rose-500">-{formatCurrency(plData.expenses, company?.currency_code)}</span>
            </div>

            <div className="flex justify-between items-center py-4 bg-indigo-500/5 px-4 rounded-xl">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Net Profit (Income - Expenses):</span>
              <span className={`text-lg font-black ${plData.netProfit >= 0 ? 'text-indigo-500' : 'text-rose-500'}`}>
                {formatCurrency(plData.netProfit, company?.currency_code)}
              </span>
            </div>
          </div>
        </div>
      )}

      {taxData && reportType === 'tax' && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="card-title">Tax (GST) Summary Report</h3>
            <span className="text-xs text-slate-400 font-semibold">Period: {fromDate} to {toDate}</span>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tax Rate (%)</th>
                  <th>Taxable Turnover Amount</th>
                  <th>Total Tax Collected</th>
                </tr>
              </thead>
              <tbody>
                {taxData.taxes?.map((tax, idx) => (
                  <tr key={idx}>
                    <td className="font-bold text-slate-900 dark:text-slate-100">{tax.rate}%</td>
                    <td>{formatCurrency(tax.taxable_amount, company?.currency_code)}</td>
                    <td className="font-bold text-indigo-500">{formatCurrency(tax.tax_collected, company?.currency_code)}</td>
                  </tr>
                ))}
                {(!taxData.taxes || taxData.taxes.length === 0) && (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-400">
                      No tax collected during this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {supplierSpendData && reportType === 'supplier-spend' && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="card-title">Supplier Spend Report</h3>
            <span className="text-xs text-slate-400 font-semibold">Period: {fromDate} to {toDate}</span>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4 text-xs border-b border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
              <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Total Received Orders</div>
              <div className="text-lg font-black text-slate-800 dark:text-slate-200">{supplierSpendData.totalOrders}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
              <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Total Spend</div>
              <div className="text-lg font-black text-indigo-500">{formatCurrency(supplierSpendData.totalSpend, company?.currency_code)}</div>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Orders Received</th>
                  <th>Total Spend</th>
                </tr>
              </thead>
              <tbody>
                {supplierSpendData.suppliers?.map((s) => (
                  <tr key={s.supplier_id}>
                    <td className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5"><Truck className="h-3.5 w-3.5 text-slate-400" /> {s.supplier_name}</td>
                    <td>{s.order_count}</td>
                    <td className="font-bold text-indigo-500">{formatCurrency(s.total_spend, company?.currency_code)}</td>
                  </tr>
                ))}
                {(!supplierSpendData.suppliers || supplierSpendData.suppliers.length === 0) && (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-400">
                      No received purchase orders during this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {valuationData && reportType === 'inventory-valuation' && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="card-title">Inventory Valuation Report</h3>
            <span className="text-xs text-slate-400 font-semibold">As of today</span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-4 text-xs border-b border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
              <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Cost Value</div>
              <div className="text-lg font-black text-slate-800 dark:text-slate-200">{formatCurrency(valuationData.totalCostValue, company?.currency_code)}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
              <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Retail Value</div>
              <div className="text-lg font-black text-slate-800 dark:text-slate-200">{formatCurrency(valuationData.totalRetailValue, company?.currency_code)}</div>
            </div>
            <div className="bg-indigo-500/5 p-3 rounded-xl">
              <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">Potential Profit</div>
              <div className="text-lg font-black text-indigo-500">{formatCurrency(valuationData.potentialProfit, company?.currency_code)}</div>
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Stock</th>
                  <th>Cost Value</th>
                  <th>Retail Value</th>
                </tr>
              </thead>
              <tbody>
                {valuationData.products?.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-slate-400" /> {p.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">SKU: {p.sku || 'N/A'}</div>
                    </td>
                    <td>{p.stock}</td>
                    <td>{formatCurrency(p.cost_value, company?.currency_code)}</td>
                    <td className="font-bold text-indigo-500">{formatCurrency(p.retail_value, company?.currency_code)}</td>
                  </tr>
                ))}
                {(!valuationData.products || valuationData.products.length === 0) && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-400">
                      No tracked inventory items in the catalog.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {agingData && reportType === 'po-aging' && (
        <div className="card">
          <div className="card-header flex justify-between items-center">
            <h3 className="card-title">Purchase Order Aging Report</h3>
            <span className="text-xs text-slate-400 font-semibold">{agingData.totalOpenOrders} open orders</span>
          </div>
          <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs border-b border-slate-100 dark:border-slate-800">
            {agingData.buckets?.map((b) => (
              <div key={b.label} className="bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl">
                <div className="text-slate-400 font-semibold uppercase text-[10px] mb-1">{b.label}</div>
                <div className="text-base font-black text-slate-800 dark:text-slate-200">{b.count} orders</div>
                <div className="text-xs font-semibold text-indigo-500">{formatCurrency(b.value, company?.currency_code)}</div>
              </div>
            ))}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Status</th>
                  <th>Days Open</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {agingData.orders?.map((po) => (
                  <tr key={po.id}>
                    <td className="font-semibold text-slate-900 dark:text-slate-100">#{po.po_no}</td>
                    <td>{po.supplier_name || 'Unknown Supplier'}</td>
                    <td className="capitalize">{po.status}</td>
                    <td className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span className={po.days_open > 60 ? 'text-rose-500 font-bold' : 'text-slate-600 dark:text-slate-300'}>{po.days_open} days</span>
                    </td>
                    <td className="font-bold text-indigo-500">{formatCurrency(po.total, company?.currency_code)}</td>
                  </tr>
                ))}
                {(!agingData.orders || agingData.orders.length === 0) && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      No open purchase orders — everything has been received or cancelled.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!hasAnyReport && (
        <div className="card py-16 text-center text-slate-400">
          <Calculator className="h-10 w-10 text-slate-300 mx-auto mb-4" />
          <h3 className="text-sm font-bold text-slate-500">No report generated</h3>
          <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 leading-normal">
            Select the report module and filter dates above to compile statements.
          </p>
        </div>
      )}
    </div>
  )
}
