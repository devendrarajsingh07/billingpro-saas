import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import axios from 'axios'

const CompanyContext = createContext()

export function CompanyProvider({ children }) {
  const { company, token } = useAuth()
  const [settings, setSettings] = useState(null)
  const [currencies, setCurrencies] = useState([])
  const [loading, setLoading] = useState(false)

  // Load company settings & currencies when authenticated
  useEffect(() => {
    async function loadCompanyDetails() {
      if (!token || !company) return
      setLoading(true)
      try {
        // Since we don't have separate settings endpoint, we use default fallback details
        setSettings({
          invoice_prefix: 'INV',
          po_prefix: 'PO',
          timezone: 'Asia/Kolkata',
          date_format: 'DD/MM/YYYY',
          gst_number: '',
          vat_number: '',
          tax_rate: 18, // Default 18% GST
        })
        setCurrencies([
          { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
          { code: 'USD', symbol: '$', name: 'US Dollar' },
          { code: 'EUR', symbol: '€', name: 'Euro' },
          { code: 'GBP', symbol: '£', name: 'British Pound' }
        ])
      } catch (err) {
        console.error('[CompanyContext] Failed to load company settings:', err)
      } finally {
        setLoading(false)
      }
    }
    loadCompanyDetails()
  }, [company, token])

  const value = {
    settings,
    currencies,
    loading,
    currencySymbol: currencies.find(c => c.code === company?.currency_code)?.symbol || '₹'
  }

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export const useCompany = () => {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompany must be used inside CompanyProvider')
  return ctx
}
