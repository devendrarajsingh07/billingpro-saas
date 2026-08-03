import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function OAuthCallback() {
  const navigate = useNavigate()
  const location = useLocation()
  const { loginWithOAuth } = useAuth()
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const path = location.pathname
        const queryParams = new URLSearchParams(location.search)

        if (path.includes('github')) {
          const code = queryParams.get('code')
          if (!code) throw new Error('Authorization code missing from GitHub redirect.')
          const res = await loginWithOAuth('github', { code })
          if (res.requiresTwoFactor) {
            navigate('/login', { state: { tempToken: res.tempToken } })
          } else if (res.success) {
            toast.success('Signed in with GitHub successfully!')
            navigate('/dashboard')
          } else {
            throw new Error(res.message || 'GitHub authentication failed.')
          }
        } else if (path.includes('microsoft')) {
          // Microsoft responds via URL fragment (hash) containing id_token because of response_mode=fragment
          const hashParams = new URLSearchParams(location.hash.substring(1))
          const idToken = hashParams.get('id_token')
          if (!idToken) throw new Error('ID Token missing from Microsoft redirect.')
          const res = await loginWithOAuth('microsoft', { id_token: idToken })
          if (res.requiresTwoFactor) {
            navigate('/login', { state: { tempToken: res.tempToken } })
          } else if (res.success) {
            toast.success('Signed in with Microsoft successfully!')
            navigate('/dashboard')
          } else {
            throw new Error(res.message || 'Microsoft authentication failed.')
          }
        } else {
          throw new Error('Unknown provider callback.')
        }
      } catch (err) {
        setError(err.message)
        toast.error(err.message)
        setTimeout(() => navigate('/login'), 3000)
      }
    }

    handleCallback()
  }, [location, navigate])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-4">
      <div className="card max-w-sm w-full p-6 text-center space-y-4 border border-slate-800 bg-slate-950/40 backdrop-blur-md">
        {!error ? (
          <>
            <Loader2 className="h-10 w-10 text-indigo-500 animate-spin mx-auto" />
            <h2 className="text-lg font-bold">Completing authentication...</h2>
            <p className="text-xs text-slate-400">Please wait while we secure your session.</p>
          </>
        ) : (
          <>
            <div className="h-10 w-10 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto text-lg font-black">
              !
            </div>
            <h2 className="text-lg font-bold text-rose-500">Authentication Failed</h2>
            <p className="text-xs text-slate-400">{error}</p>
            <p className="text-[10px] text-slate-500">Redirecting to login page...</p>
          </>
        )}
      </div>
    </div>
  )
}
