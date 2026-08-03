import React, { useState, useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import api from '../../services/api'

const GOOGLE_CLIENT_ID    = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GITHUB_CLIENT_ID    = import.meta.env.VITE_GITHUB_CLIENT_ID
const MICROSOFT_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID

// ── SVG logos ───────────────────────────────────────────────────
const GithubIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577
      0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7
      3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07
      1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93
      0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267
      1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24
      2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81
      2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
  </svg>
)

const MicrosoftIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
  </svg>
)

export default function Login() {
  const { register, handleSubmit, formState: { errors } } = useForm()
  const { login, loginWithGoogle, verifyTwoFactor } = useAuth()
  const [loading, setLoading]         = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [githubLoading, setGithubLoading] = useState(false)
  const location = useLocation()
  const [tempToken, setTempToken] = useState(location.state?.tempToken || null)
  const [totpToken, setTotpToken] = useState('')
  const navigate   = useNavigate()
  const googleBtnRef = useRef(null)

  // ── Email / password login ─────────────────────────────────────
  const onSubmit = async (data) => {
    setLoading(true)
    const res = await login(data.email, data.password)
    setLoading(false)
    if (res.requiresTwoFactor) {
      setTempToken(res.tempToken)
      toast('Enter the code from your authenticator app.')
    } else if (res.success) {
      toast.success('Welcome back to BillingPro!')
      navigate('/dashboard')
    } else {
      toast.error(res.message)
    }
  }

  const onVerifyTwoFactor = async (e) => {
    e.preventDefault()
    setLoading(true)
    const res = await verifyTwoFactor(tempToken, totpToken)
    setLoading(false)
    if (res.success) {
      toast.success('Welcome back to BillingPro!')
      navigate('/dashboard')
    } else {
      toast.error(res.message)
    }
  }

  // ── Google login ───────────────────────────────────────────────
  const handleGoogleCredential = async (response) => {
    const res = await loginWithGoogle(response.credential)
    if (res.requiresTwoFactor) {
      setTempToken(res.tempToken)
      toast('Enter the code from your authenticator app.')
    } else if (res.success) {
      toast.success('Welcome back to BillingPro!')
      navigate('/dashboard')
    } else {
      toast.error(res.message)
    }
  }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => {
      if (!window.google || !googleBtnRef.current) return
      window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: handleGoogleCredential })
      window.google.accounts.id.renderButton(googleBtnRef.current, { theme: 'outline', size: 'large', width: 320, text: 'signin_with' })
    }
    document.body.appendChild(script)
  }, [])

  // ── GitHub OAuth ───────────────────────────────────────────────
  // Step 1: redirect to GitHub. Step 2: GitHub redirects back with ?code=
  // We intercept the code in the URL and exchange it here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('github_code')
    if (!code || !GITHUB_CLIENT_ID) return

    // Remove the code from the URL immediately so refresh doesn't re-trigger
    window.history.replaceState({}, '', '/login')
    setGithubLoading(true)
    api.post('/auth/github', { code })
      .then(({ data }) => {
        if (data.success) {
          toast.success('GitHub login successful!')
          navigate('/dashboard')
        } else {
          toast.error(data.message || 'GitHub login failed.')
        }
      })
      .catch(err => toast.error(err?.response?.data?.message || 'GitHub login failed.'))
      .finally(() => setGithubLoading(false))
  }, [])

  const handleGithubLogin = () => {
    if (!GITHUB_CLIENT_ID) { toast.error('GitHub OAuth is not configured.'); return }
    const redirectUri = `${window.location.origin}/auth/github/callback`
    const scope = 'read:user user:email'
    window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`
  }

  // ── Microsoft OAuth ────────────────────────────────────────────
  const handleMicrosoftLogin = () => {
    if (!MICROSOFT_CLIENT_ID) { toast.error('Microsoft OAuth is not configured.'); return }
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/microsoft/callback`)
    const tenant = import.meta.env.VITE_MICROSOFT_TENANT || 'common'
    const scope  = encodeURIComponent('openid profile email')
    window.location.href = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?client_id=${MICROSOFT_CLIENT_ID}&response_type=id_token&redirect_uri=${redirectUri}&scope=${scope}&response_mode=fragment&nonce=${crypto.randomUUID()}`
  }

  if (tempToken) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="auth-title">Verify your identity</h1>
          <p className="auth-subtitle">Enter the six-digit code from your authenticator app.</p>
        </div>
        <form onSubmit={onVerifyTwoFactor} className="space-y-4">
          <input
            autoFocus
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            className="auth-input text-center tracking-[0.5em]"
            value={totpToken}
            onChange={(e) => setTotpToken(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            aria-label="Authenticator code"
            required
          />
          <button type="submit" disabled={loading || totpToken.length !== 6} className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer">
            {loading ? 'Verifying...' : 'Verify and sign in'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Sign in to manage your billing and invoices</p>
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

        {/* Password */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="auth-label mb-0">Password</label>
            <Link to="/forgot-password" className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className={`auth-input pl-10 pr-10 ${errors.password ? 'error' : ''}`}
              {...register('password', {
                required: 'Password is required',
                minLength: { value: 8, message: 'Password must be at least 8 characters' }
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
          <p className="auth-hint">
            Must be 8+ characters, with at least one uppercase letter and one special character.
          </p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition cursor-pointer"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      {/* Social OAuth */}
      <div className="mt-4">
        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-[10px] text-slate-500 uppercase tracking-wider">Or continue with</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        <div className="space-y-2">
          {/* Google button (rendered by Google SDK) */}
          {GOOGLE_CLIENT_ID && (
            <div ref={googleBtnRef} className="flex justify-center" />
          )}

          {/* GitHub */}
          <button
            type="button"
            id="github-login-btn"
            onClick={handleGithubLogin}
            disabled={githubLoading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition disabled:opacity-50"
          >
            <GithubIcon />
            {githubLoading ? 'Signing in with GitHub...' : 'Continue with GitHub'}
          </button>

          {/* Microsoft */}
          <button
            type="button"
            id="microsoft-login-btn"
            onClick={handleMicrosoftLogin}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-white transition"
          >
            <MicrosoftIcon />
            Continue with Microsoft
          </button>
        </div>
      </div>

      <p className="text-center text-xs text-slate-400 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="font-bold text-indigo-400 hover:text-indigo-300">
          Create company account
        </Link>
      </p>
    </div>
  )
}
