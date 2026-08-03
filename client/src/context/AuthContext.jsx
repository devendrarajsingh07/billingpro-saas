import { createContext, useContext, useEffect, useRef, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('bp_access_token'))
  const [loading, setLoading] = useState(true)
  // Track whether initAuth has already populated state to avoid redundant fetches
  const sessionRestored = useRef(false)

  useEffect(() => {
    // Only run once on mount — login/register set state directly, no re-fetch needed
    async function initAuth() {
      const storedToken = localStorage.getItem('bp_access_token')
      if (storedToken) {
        try {
          const res = await axios.get('/api/v1/auth/me', {
            headers: { Authorization: `Bearer ${storedToken}` }
          })
          if (res.data.success) {
            setUser(res.data.data)
            sessionRestored.current = true
            // Fetch the real company profile for this user
            const compRes = await axios.get('/api/v1/company/me', {
              headers: { Authorization: `Bearer ${storedToken}` }
            })
            setCompany(compRes.data.data)
          }
        } catch (err) {
          console.error('[AuthInit] Failed to restore session:', err)
          // Clear stale tokens silently
          localStorage.removeItem('bp_access_token')
          localStorage.removeItem('bp_refresh_token')
          setToken(null)
          setUser(null)
          setCompany(null)
        }
      }
      setLoading(false)
    }
    initAuth()
  }, []) // ← run ONCE on mount only, not on every token state change

  const completeSession = (data) => {
    const { accessToken, refreshToken, user: loggedUser, company: loggedCompany } = data
    localStorage.setItem('bp_access_token', accessToken)
    localStorage.setItem('bp_refresh_token', refreshToken)
    setToken(accessToken)
    setUser(loggedUser)
    setCompany(loggedCompany)
    return { success: true }
  }

  const handleLoginResponse = (data) => {
    if (data.requiresTwoFactor) {
      return { success: false, requiresTwoFactor: true, tempToken: data.tempToken }
    }
    return completeSession(data)
  }

  const login = async (email, password) => {
    setLoading(true)
    try {
      const res = await axios.post('/api/v1/auth/login', { email, password })
      if (res.data.success) {
        return handleLoginResponse(res.data.data)
      }
      return { success: false, message: res.data.message || 'Login failed. Please check your credentials.' }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.'
      return { success: false, message: msg }
    } finally {
      setLoading(false)
    }
  }

  const loginWithGoogle = async (idToken) => {
    setLoading(true)
    try {
      const res = await axios.post('/api/v1/auth/google', { id_token: idToken })
      if (res.data.success) {
        return handleLoginResponse(res.data.data)
      }
      return { success: false, message: res.data.message || 'Google sign-in failed.' }
    } catch (err) {
      const msg = err.response?.data?.message || 'Google sign-in failed.'
      return { success: false, message: msg }
    } finally {
      setLoading(false)
    }
  }

  const register = async (name, email, password, companyName) => {
    setLoading(true)
    try {
      const res = await axios.post('/api/v1/auth/register', {
        name,
        email,
        password,
        company_name: companyName
      })
      if (res.data.success) {
        const { accessToken, refreshToken, user: loggedUser, company: loggedCompany } = res.data.data
        localStorage.setItem('bp_access_token', accessToken)
        localStorage.setItem('bp_refresh_token', refreshToken)
        setToken(accessToken)
        setUser(loggedUser)
        setCompany(loggedCompany)
        return { success: true }
      }
      return { success: false, message: res.data.message || 'Registration failed.' }
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed.'
      return { success: false, message: msg }
    } finally {
      setLoading(false)
    }
  }

  const verifyTwoFactor = async (tempToken, totpToken) => {
    setLoading(true)
    try {
      const res = await axios.post('/api/v1/auth/2fa/verify', { tempToken, totpToken })
      if (res.data.success) return completeSession(res.data.data)
      return { success: false, message: res.data.message || 'Two-factor verification failed.' }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Two-factor verification failed.' }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    const storedToken = localStorage.getItem('bp_access_token')
    if (storedToken) {
      try {
        await axios.post('/api/v1/auth/logout', {}, {
          headers: { Authorization: `Bearer ${storedToken}` }
        })
      } catch (err) {
        console.error('[Logout] Failed on server:', err)
      }
    }
    localStorage.removeItem('bp_access_token')
    localStorage.removeItem('bp_refresh_token')
    setToken(null)
    setUser(null)
    setCompany(null)
  }

  const updateProfile = (updatedUser) => {
    setUser(prev => ({ ...prev, ...updatedUser }))
  }

  const updateCompany = (updatedCompany) => {
    setCompany(prev => ({ ...prev, ...updatedCompany }))
  }

  const loginWithOAuth = async (provider, payload) => {
    setLoading(true)
    try {
      const res = await axios.post(`/api/v1/auth/${provider}`, payload)
      if (res.data.success) {
        return handleLoginResponse(res.data.data)
      }
      return { success: false, message: res.data.message || `${provider} sign-in failed.` }
    } catch (err) {
      const msg = err.response?.data?.message || `${provider} sign-in failed.`
      return { success: false, message: msg }
    } finally {
      setLoading(false)
    }
  }

  const value = {
    user,
    company,
    token,
    loading,
    isAuthenticated: !!user,
    login,
    loginWithGoogle,
    loginWithOAuth,
    verifyTwoFactor,
    register,
    logout,
    updateProfile,
    updateCompany
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
