'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ScanFace,
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Save,
  Mail,
  Bell,
  Building2,
  User,
  KeyRound,
  ShieldAlert,
} from 'lucide-react'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // Auth
  const [userEmail, setUserEmail] = useState('')
  const [userId, setUserId] = useState('')

  // Form fields
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyWebsite, setCompanyWebsite] = useState('')
  const [notifyOnCompletion, setNotifyOnCompletion] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email)
      setUserId(user.id)

      const { data } = await supabase
        .from('settings')
        .select()
        .eq('user_id', user.id)
        .single()

      if (data) {
        setFullName(data.full_name || '')
        setCompanyName(data.company_name || '')
        setCompanyWebsite(data.company_website || '')
        setNotifyOnCompletion(data.notify_on_completion ?? true)
      }
      setLoading(false)
    }
    load()
  }, [])

  function flashMessage(msg) { setError(''); setMessage(msg) }
  function flashError(msg) { setMessage(''); setError(msg) }

  async function saveSettings() {
    setSaving(true)
    const { error: err } = await supabase.from('settings').upsert({
      user_id: userId,
      full_name: fullName || null,
      company_name: companyName || null,
      company_website: companyWebsite || null,
      notify_on_completion: notifyOnCompletion,
    }, { onConflict: 'user_id' })
    setSaving(false)
    if (err) return flashError('Failed to save: ' + err.message)
    flashMessage('Settings saved successfully.')
  }

  async function sendPasswordReset() {
    const { error: err } = await supabase.auth.resetPasswordForEmail(userEmail, {
      redirectTo: window.location.origin + '/login',
    })
    if (err) return flashError('Failed to send reset email: ' + err.message)
    setResetSent(true)
    flashMessage('Password reset email sent to ' + userEmail)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-soft flex-col">
        <div className="p-6 border-b border-gray-soft">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={18} />
            </div>
            <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/roles" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
            <Briefcase size={18} /> Roles
          </Link>
          <Link href="/candidates" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
            <Users size={18} /> Candidates
          </Link>
          <Link href="/settings" aria-current="page" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-lavender text-ink font-medium text-sm">
            <Settings size={18} /> Settings
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-soft">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile slide-out */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-soft flex flex-col">
            <div className="p-6 border-b border-gray-soft flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
                  <ScanFace className="text-yellow" size={18} />
                </div>
                <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="text-gray-mid"><X size={20} /></button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <LayoutDashboard size={18} /> Dashboard
              </Link>
              <Link href="/roles" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <Briefcase size={18} /> Roles
              </Link>
              <Link href="/candidates" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <Users size={18} /> Candidates
              </Link>
              <Link href="/settings" onClick={() => setMobileNavOpen(false)} aria-current="page" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-lavender text-ink font-medium text-sm">
                <Settings size={18} /> Settings
              </Link>
            </nav>
            <div className="p-4 border-t border-gray-soft">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <LogOut size={18} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-soft">
          <button onClick={() => setMobileNavOpen(true)} className="text-ink"><Menu size={22} /></button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={16} />
            </div>
            <span className="font-heading font-bold text-ink">Recrewt AI</span>
          </div>
          <div className="w-6" />
        </div>

        <div className="p-6 lg:p-10 max-w-2xl">
          <div className="mb-8">
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-ink">Settings</h1>
            <p className="text-sm text-gray-mid mt-1">Manage your profile, company, and account preferences.</p>
          </div>

          {(error || message) && (
            <div className="mb-6">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              {message && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</p>}
            </div>
          )}

          {loading ? (
            <div className="text-center text-sm text-gray-mid py-20">Loading…</div>
          ) : (
            <div className="space-y-6">

              {/* Profile */}
              <section className="bg-white rounded-2xl border border-gray-soft p-6">
                <div className="flex items-center gap-2 mb-5">
                  <User size={18} className="text-violet" />
                  <h2 className="font-heading font-semibold text-ink">Profile</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Michael Rokkala"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Email</label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-soft bg-gray-50 text-gray-mid text-sm">
                      <Mail size={14} />
                      {userEmail}
                    </div>
                    <p className="text-xs text-gray-mid mt-1">Email cannot be changed here.</p>
                  </div>
                </div>
              </section>

              {/* Company */}
              <section className="bg-white rounded-2xl border border-gray-soft p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Building2 size={18} className="text-violet" />
                  <h2 className="font-heading font-semibold text-ink">Company</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Company Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Recrewt AI"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1">Website</label>
                    <input
                      type="url"
                      placeholder="e.g. https://recrewtai.com"
                      value={companyWebsite}
                      onChange={(e) => setCompanyWebsite(e.target.value)}
                      className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                    />
                  </div>
                </div>
              </section>

              {/* Notifications */}
              <section className="bg-white rounded-2xl border border-gray-soft p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Bell size={18} className="text-violet" />
                  <h2 className="font-heading font-semibold text-ink">Notifications</h2>
                </div>
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="text-sm font-medium text-ink">Candidate completion alerts</div>
                    <div className="text-xs text-gray-mid mt-0.5">Get an email when a candidate finishes their interview</div>
                  </div>
                  <button
                    onClick={() => setNotifyOnCompletion(!notifyOnCompletion)}
                    className={`relative w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${notifyOnCompletion ? 'bg-violet' : 'bg-gray-200'}`}
                    aria-checked={notifyOnCompletion}
                    role="switch"
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifyOnCompletion ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </label>
              </section>

              {/* Save */}
              <button
                onClick={saveSettings}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-violet text-white font-medium px-5 py-2.5 rounded-lg hover:bg-violet-dark transition-colors disabled:opacity-60"
              >
                <Save size={16} />
                {saving ? 'Saving…' : 'Save Settings'}
              </button>

              {/* Password */}
              <section className="bg-white rounded-2xl border border-gray-soft p-6">
                <div className="flex items-center gap-2 mb-2">
                  <KeyRound size={18} className="text-violet" />
                  <h2 className="font-heading font-semibold text-ink">Password</h2>
                </div>
                <p className="text-sm text-gray-mid mb-4">
                  We'll send a password reset link to <span className="font-medium text-ink">{userEmail}</span>.
                </p>
                <button
                  onClick={sendPasswordReset}
                  disabled={resetSent}
                  className="inline-flex items-center gap-2 bg-white border border-gray-soft text-ink text-sm font-medium px-4 py-2 rounded-lg hover:border-violet hover:text-violet transition-colors disabled:opacity-60"
                >
                  <Mail size={14} />
                  {resetSent ? 'Reset email sent' : 'Send password reset email'}
                </button>
              </section>

              {/* Danger zone */}
              <section className="bg-white rounded-2xl border border-red-100 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert size={18} className="text-red-500" />
                  <h2 className="font-heading font-semibold text-ink">Danger Zone</h2>
                </div>
                <p className="text-sm text-gray-mid mb-4">
                  To delete your account and all associated data, email us at{' '}
                  <a href="mailto:support@recrewtai.com" className="text-violet hover:underline font-medium">
                    support@recrewtai.com
                  </a>. We'll process it within 48 hours.
                </p>
              </section>

            </div>
          )}
        </div>
      </main>
    </div>
  )
}