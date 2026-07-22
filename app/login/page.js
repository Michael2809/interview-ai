'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ScanFace, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [next, setNext] = useState('/dashboard')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const n = params.get('next')
    if (n) setNext(n)
  }, [])

  async function handleSubmit() {
    setError('')
    setMessage('')
    if (!email.trim()) { setError('Please enter your email.'); return }
    if (!password) { setError('Please enter your password.'); return }
    setLoading(true)
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) { setLoading(false); return setError(error.message) }
      router.push(next)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) { setLoading(false); return setError(error.message) }
      router.push(next)
    }
  }

  async function handleForgotPassword() {
    setError('')
    setMessage('')
    if (!email) {
      return setError('Enter your email first, then click "Forgot password".')
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) return setError(error.message)
    setMessage('Check your email for a password reset link.')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[color:var(--color-rc-soft)] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5 mb-3">
            <span
              aria-hidden="true"
              className="h-8 w-8 rounded-[8px] bg-[color:var(--color-rc-ink)] grid place-items-center"
            >
              <ScanFace className="text-[color:var(--color-rc-yellow)]" size={16} strokeWidth={2} />
            </span>
            <span
              className="text-[18px] leading-none font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
              style={{ fontFamily: 'var(--font-editorial), inherit' }}
            >
              Recrewt AI
            </span>
          </div>
          <p className="text-[13.5px] text-[color:var(--color-rc-muted)]">
            AI-powered interviews for smarter hiring
          </p>
        </div>

        <div className="rounded-[18px] bg-white p-8 border border-[color:var(--color-rc-line)] [box-shadow:0_30px_60px_-30px_rgba(17,17,17,0.15),0_2px_6px_rgba(17,17,17,0.02)]">
          <h2
            className="text-[24px] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-1.5 text-[13.5px] text-[color:var(--color-rc-muted)]">
            {isSignUp
              ? 'Start screening candidates in minutes.'
              : 'Sign in to your recruiter dashboard.'}
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label htmlFor="login-email" className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full h-11 px-3.5 text-[14.5px] bg-white text-[color:var(--color-rc-ink)] leading-none border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[12px] font-medium text-[color:var(--color-rc-ink)] underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 hover:decoration-[3px]"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full h-11 pl-3.5 pr-10 text-[14.5px] bg-white text-[color:var(--color-rc-ink)] leading-none border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 grid place-items-center rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
                >
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-[color:var(--color-rc-red)] bg-[rgb(199_75_58_/_0.06)] rounded px-3 py-2">
                {error}
              </p>
            )}
            {message && (
              <p className="text-[13px] text-[color:var(--color-rc-green)] bg-[rgb(42_157_87_/_0.08)] rounded px-3 py-2">
                {message}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full h-11 rounded font-medium text-[14.5px] leading-none bg-[color:var(--color-rc-ink)] text-white hover:bg-black transition-colors duration-150 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-2"
            >
              {loading ? 'Please wait…' : isSignUp ? 'Create account' : 'Sign in'}
            </button>
          </div>

          <p className="mt-6 text-center text-[13px] text-[color:var(--color-rc-muted)]">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
              className="ml-1 font-medium text-[color:var(--color-rc-ink)] underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 hover:decoration-[3px]"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-[11.5px] text-[color:var(--color-rc-muted)]">
          © 2026 Recrewt AI. All rights reserved.
        </p>
      </div>
    </div>
  )
}
