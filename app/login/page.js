'use client'

import { useState } from 'react'
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
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit() {
    setError('')
    setMessage('')
    setLoading(true)
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) { setLoading(false); return setError(error.message) }
      router.push('/dashboard')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setLoading(false); return setError(error.message) }
      router.push('/dashboard')
    }
  }

  async function handleForgotPassword() {
    setError('')
    setMessage('')
    if (!email) {
      return setError('Enter your email first, then click "Forgot password".')
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) return setError(error.message)
    setMessage('Check your email for a password reset link.')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-lavender px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={20} />
            </div>
            <span className="font-heading font-bold text-xl tracking-tight text-ink">
              Recrewt AI
            </span>
          </div>
          <p className="text-sm text-gray-mid">
            AI-powered interviews for smarter hiring
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-xl border border-gray-soft">
          <h2 className="font-heading text-2xl font-bold text-ink">
            {isSignUp ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-1 text-sm text-gray-mid">
            {isSignUp
              ? 'Start screening candidates in minutes.'
              : 'Sign in to your recruiter dashboard.'}
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Email
              </label>
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-ink">
                  Password
                </label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-xs font-medium text-violet hover:text-violet-dark transition-colors"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full rounded-lg border border-gray-soft px-3 py-2 pr-10 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-mid hover:text-ink"
                >
                  {showPassword ? <Eye size={18} /> : <EyeOff size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {message && (
              <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
                {message}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full rounded-lg bg-violet px-4 py-2.5 font-heading font-semibold text-white hover:bg-violet-dark transition-colors disabled:opacity-60"
            >
              {loading ? 'Please wait…' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </div>

          <p className="mt-6 text-center text-sm text-gray-mid">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setMessage('') }}
              className="ml-1 font-medium text-violet hover:text-violet-dark transition-colors"
            >
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </button>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-mid">
          © 2026 Recrewt AI. All rights reserved.
        </p>
      </div>
    </div>
  )
}