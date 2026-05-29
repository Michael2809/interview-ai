'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
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
  Plus,
  Menu,
  X,
  ArrowRight,
  Briefcase as BriefcaseIcon,
} from 'lucide-react'

export default function RolesPage() {
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const authClient = createClient()
  const router = useRouter()

  async function loadRoles() {
    const { data } = await supabase
      .from('roles')
      .select()
      .order('created_at', { ascending: false })
    if (data) setRoles(data)
  }

  useEffect(() => {
    loadRoles()
  }, [])

  async function saveRole() {
    setError('')
    setMessage('')
    if (!title) {
      setError('Please type a job title first.')
      return
    }
    setLoading(true)
    const { error: insertError } = await supabase.from('roles').insert({ title })
    setLoading(false)
    if (insertError) {
      setError('Something went wrong: ' + insertError.message)
    } else {
      setMessage(`Saved! Role "${title}" was added.`)
      setTitle('')
      loadRoles()
    }
  }

  async function handleLogout() {
    await authClient.auth.signOut()
    router.push('/login')
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') saveRole()
  }

  const navLinks = (
    <>
      <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
        <LayoutDashboard size={18} /> Dashboard
      </Link>
      <Link href="/roles" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-lavender text-ink font-medium text-sm">
        <Briefcase size={18} /> Roles
      </Link>
      <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
        <Users size={18} /> Candidates
      </Link>
      <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
        <Settings size={18} /> Settings
      </Link>
    </>
  )

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
        <nav className="flex-1 p-4 space-y-1">{navLinks}</nav>
        <div className="p-4 border-t border-gray-soft">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile slide-out menu */}
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
              <button onClick={() => setMobileNavOpen(false)} className="text-gray-mid">
                <X size={20} />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">{navLinks}</nav>
            <div className="p-4 border-t border-gray-soft">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-soft">
          <button onClick={() => setMobileNavOpen(true)} className="text-ink">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={16} />
            </div>
            <span className="font-heading font-bold text-ink">Recrewt AI</span>
          </div>
          <div className="w-6" />
        </div>

        <div className="p-6 lg:p-10 max-w-4xl">
          {/* Header */}
          <div className="mb-8">
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-ink">Roles</h1>
            <p className="text-sm text-gray-mid mt-1">Create job roles. We'll draft tailored interview questions for each.</p>
          </div>

          {/* Create Role Card */}
          <div className="bg-white rounded-2xl border border-gray-soft p-6 mb-8">
            <h2 className="font-heading font-semibold text-lg text-ink mb-4">Create a new role</h2>
            <label className="block text-sm font-medium text-ink mb-1">Job title</label>
            <input
              type="text"
              placeholder="e.g. Junior Backend Developer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
            />

            {error && (
              <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
            {message && (
              <p className="mt-3 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</p>
            )}

            <button
              onClick={saveRole}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 bg-violet text-white font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors disabled:opacity-60"
            >
              <Plus size={16} />
              {loading ? 'Saving…' : 'Create Role'}
            </button>
          </div>

          {/* Your Roles */}
          <h2 className="font-heading font-semibold text-lg text-ink mb-4">Your roles</h2>

          {roles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-soft p-10 text-center">
              <div className="w-12 h-12 bg-lavender rounded-xl flex items-center justify-center mx-auto mb-3">
                <BriefcaseIcon className="text-violet" size={20} />
              </div>
              <p className="font-medium text-ink">No roles yet</p>
              <p className="text-sm text-gray-mid mt-1">Create your first role above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <Link
                  key={role.id}
                  href={'/roles/' + role.id}
                  className="flex items-center justify-between bg-white rounded-2xl border border-gray-soft p-5 hover:border-violet transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-lavender rounded-xl flex items-center justify-center shrink-0">
                      <Briefcase className="text-violet" size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate">{role.title}</div>
                      <div className="text-xs text-gray-mid">Open role</div>
                    </div>
                  </div>
                  <ArrowRight className="text-gray-mid shrink-0" size={18} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}