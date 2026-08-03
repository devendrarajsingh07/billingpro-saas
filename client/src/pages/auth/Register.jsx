import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Mail, Lock, User, Briefcase, Eye, EyeOff } from 'lucide-react'
import PasswordRequirements from '../../components/PasswordRequirements'

export default function Register() {
  const { register, handleSubmit, watch, formState: { errors } } = useForm()
  const { register: registerUser } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const passwordValue = watch('password', '')

  const onSubmit = async (data) => {
    setLoading(true)
    const res = await registerUser(data.name, data.email, data.password, data.company_name)
    setLoading(false)
    if (res.success) {
      toast.success('Enterprise account registered successfully!')
      navigate('/dashboard')
    } else {
      toast.error(res.message)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="auth-title">Get Started</h1>
        <p className="auth-subtitle">Create your multi-tenant global SaaS billing account</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="auth-label">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="John Doe"
              className={`auth-input pl-10 ${errors.name ? 'error' : ''}`}
              {...register('name', { required: 'Full name is required' })}
            />
          </div>
          {errors.name && <p className="text-rose-500 text-xs mt-1">{errors.name.message}</p>}
        </div>

        {/* Company Name */}
        <div>
          <label className="auth-label">Company Name</label>
          <div className="relative">
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Acme Corp"
              className={`auth-input pl-10 ${errors.company_name ? 'error' : ''}`}
              {...register('company_name', { required: 'Company name is required' })}
            />
          </div>
          {errors.company_name && <p className="text-rose-500 text-xs mt-1">{errors.company_name.message}</p>}
        </div>

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

        {/* Password */}
        <div>
          <label className="auth-label">Password</label>
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
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-xs text-slate-400 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="font-bold text-indigo-400 hover:text-indigo-300">
          Sign in
        </Link>
      </p>
    </div>
  )
}
