import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setMessage('No verification token found in the link. Please check your email and try again.')
      return
    }
    verifyToken()
  }, [token]) // eslint-disable-line

  const verifyToken = async () => {
    setStatus('loading')
    try {
      const res = await api.post('/api/v1/auth/verify-email', { token })
      if (res.data.success) {
        setStatus('success')
        setMessage(res.data.message || 'Your email has been verified successfully!')
      } else {
        setStatus('error')
        setMessage(res.data.message || 'Verification failed. Please try again.')
      }
    } catch (err) {
      setStatus('error')
      setMessage(err.response?.data?.message || 'This verification link has expired or is invalid. Please request a new one.')
    }
  }

  return (
    <div className="text-center py-4">
      {status === 'loading' && (
        <>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-indigo-50">
              <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />
            </div>
          </div>
          <h1 className="auth-title">Verifying your email…</h1>
          <p className="auth-subtitle">Please wait while we confirm your email address.</p>
        </>
      )}

      {status === 'idle' && (
        <>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-slate-100">
              <Mail className="h-10 w-10 text-slate-500" />
            </div>
          </div>
          <h1 className="auth-title">Check your email</h1>
          <p className="auth-subtitle">We sent a verification link to your inbox.</p>
        </>
      )}

      {status === 'success' && (
        <>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-emerald-50">
              <CheckCircle className="h-10 w-10 text-emerald-500" />
            </div>
          </div>
          <h1 className="auth-title text-emerald-600">Email Verified!</h1>
          <p className="auth-subtitle mb-6">{message}</p>
          <Link
            to="/login"
            className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition"
          >
            Sign in to your account →
          </Link>
        </>
      )}

      {status === 'error' && (
        <>
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-rose-50">
              <XCircle className="h-10 w-10 text-rose-500" />
            </div>
          </div>
          <h1 className="auth-title text-rose-600">Verification Failed</h1>
          <p className="auth-subtitle mb-6">{message}</p>
          <div className="space-y-3">
            <Link
              to="/login"
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition"
            >
              Back to sign in
            </Link>
            <p className="text-xs text-slate-500 mt-2">
              Need help?{' '}
              <Link to="/forgot-password" className="text-indigo-600 hover:underline">
                Contact support
              </Link>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
