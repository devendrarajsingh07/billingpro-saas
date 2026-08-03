import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Lock, ArrowLeft, CheckCircle, Eye, EyeOff } from 'lucide-react'
import PasswordRequirements from '../../components/PasswordRequirements'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const navigate = useNavigate()
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const passwordValue = watch('password', '')

  const onSubmit = async (data) => {
    if (!token) {
      toast.error('Reset token is missing from URL.')
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/api/v1/auth/reset-password', {
        token,
        password: data.password
      })
      if (res.data.success) {
        toast.success('Password reset successfully! Please sign in.')
        navigate('/login')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center py-4">
        <h1 className="auth-title">Invalid Link</h1>
        <p className="auth-subtitle mb-6">
          The password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link to="/forgot-password" className="btn btn-primary w-full">
          Request new reset link
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="auth-title">Choose New Password</h1>
        <p className="auth-subtitle">Set a secure password for your account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* New Password */}
        <div>
          <label className="auth-label">New Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className={`auth-input pl-10 pr-10 ${errors.password ? 'error' : ''}`}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' },
                validate: {
                  hasUpper: (v) => /[A-Z]/.test(v) || 'Add an uppercase letter',
                  hasLower: (v) => /[a-z]/.test(v) || 'Add a lowercase letter',
                  hasNumber: (v) => /[0-9]/.test(v) || 'Add a number',
                  hasSpecial: (v) => /[^A-Za-z0-9]/.test(v) || 'Add a special character',
                },
              })}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((v) => !v)}
              className="auth-input-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-rose-500 text-xs mt-1">{errors.password.message}</p>}
          <PasswordRequirements password={passwordValue} />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition cursor-pointer"
        >
          {loading ? 'Updating password...' : 'Update Password'}
        </button>
      </form>
    </div>
  )
}
