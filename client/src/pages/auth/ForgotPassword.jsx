import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react'

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const res = await api.post('/api/v1/auth/forgot-password', { email: data.email })
      if (res.data.success) {
        setSubmitted(true)
        toast.success('Reset link generated successfully!')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to request reset link.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-4">
        <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
        <h1 className="auth-title">Check Console</h1>
        <p className="auth-subtitle mb-6">
          If the email exists, a password reset link has been logged in the backend server console.
        </p>
        <Link to="/login" className="btn btn-secondary w-full">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Sign In
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="auth-title">Reset Password</h1>
        <p className="auth-subtitle">Enter your email and we'll send you a password reset link</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <label className="auth-label">Email Address</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="email"
              placeholder="name@company.com"
              className={`auth-input pl-10 ${errors.email ? 'error' : ''}`}
              {...register('email', {
                required: 'Email is required',
                pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' }
              })}
            />
          </div>
          {errors.email && <p className="text-rose-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition cursor-pointer"
        >
          {loading ? 'Sending link...' : 'Send Reset Link'}
        </button>
      </form>

      <p className="text-center text-xs text-slate-400 mt-6">
        <Link to="/login" className="font-bold text-indigo-400 hover:text-indigo-300 flex items-center justify-center gap-1">
          <ArrowLeft className="h-3 w-3" /> Back to Sign In
        </Link>
      </p>
    </div>
  )
}
