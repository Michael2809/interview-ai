'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { supabase } from '../../lib/supabase'
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
  Send,
  TrendingUp,
  Clock,
  Menu,
  X,
  ThumbsUp,
  Minus,
  ThumbsDown,
} from 'lucide-react'

export default function DashboardPage() {
  const authClient = createClient()
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [shortlisted, setShortlisted] = useState([])
  const [onHold, setOnHold] = useState([])
  const [rejected, setRejected] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadScores() {
      const { data } = await supabase
        .from('scores')
        .select()
        .order('score', { ascending: false })
      if (data) {
        setShortlisted(data.filter((s) => s.status === 'shortlisted'))
        setOnHold(data.filter((s) => s.status === 'on-hold'))
        setRejected(data.filter((s) => s.status === 'rejected'))
      }
      setLoading(false)
    }
    loadScores()
  }, [])

  async function handleLogout() {
    await authClient.auth.signOut()
    router.push('/login')
  }

  function initials(name) {
    return (name || '').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  }

  function scoreColor(score) {
    if (score >= 7) return 'bg-green-100 text-green-700'
    if (score >= 4) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  const navLinks = (
    <>
      <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-lavender text-ink font-medium text-sm">
        <LayoutDashboard size={18} /> Dashboard
      </Link>
      <Link href="/roles" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
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

  const CandidateCard = ({ candidate }) => (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-lavender/40 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-lavender text-violet font-heading font-semibold text-xs flex items-center justify-center shrink-0">
          {initials(candidate.candidate_name)}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm text-ink truncate">{candidate.candidate_name}</div>
          <div className="text-xs text-gray-mid truncate">{candidate.summary?.slice(0, 60)}…</div>
        </div>
      </div>
      <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ml-2 ${scoreColor(candidate.score)}`}>
        {candidate.score}/10
      </span>
    </div>
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
            <nav className="flex-1 p-4 space-y-1">{navLinks}</nav>
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
        {/* Mobile top bar */}
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

        <div className="p-6 lg:p-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-heading font-bold text-2xl md:text-3xl text-ink">Dashboard</h1>
              <p className="text-sm text-gray-mid mt-1">Welcome back. Here's your candidate pipeline.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/roles" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-white border border-ink text-ink font-medium px-4 py-2 rounded-lg hover:bg-ink hover:text-white transition-colors text-sm">
                <Send size={16} /> Invite
              </Link>
              <Link href="/roles" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-violet text-white font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors text-sm">
                <Plus size={16} /> Create Role
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 border border-gray-soft">
              <div className="flex items-center gap-2 text-gray-mid text-xs uppercase tracking-wide">
                <ThumbsUp size={14} /> Shortlisted
              </div>
              <div className="font-heading font-bold text-3xl text-green-600 mt-2">{shortlisted.length}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-soft">
              <div className="flex items-center gap-2 text-gray-mid text-xs uppercase tracking-wide">
                <Minus size={14} /> On Hold
              </div>
              <div className="font-heading font-bold text-3xl text-yellow-500 mt-2">{onHold.length}</div>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-gray-soft">
              <div className="flex items-center gap-2 text-gray-mid text-xs uppercase tracking-wide">
                <ThumbsDown size={14} /> Rejected
              </div>
              <div className="font-heading font-bold text-3xl text-red-500 mt-2">{rejected.length}</div>
            </div>
          </div>

          {/* Pipeline */}
          {loading ? (
            <div className="text-center text-sm text-gray-mid py-20">Loading pipeline...</div>
          ) : (shortlisted.length + onHold.length + rejected.length) === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-soft p-16 text-center">
              <p className="font-medium text-ink">No scored candidates yet</p>
              <p className="text-sm text-gray-mid mt-1">Go to a transcript, score a candidate, and they'll appear here automatically.</p>
              <Link href="/roles" className="mt-4 inline-flex items-center gap-2 bg-violet text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors">
                <Briefcase size={14} /> Go to Roles
              </Link>
            </div>
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Shortlisted */}
              <div className="bg-white rounded-2xl border border-gray-soft">
                <div className="flex items-center gap-2 p-5 border-b border-gray-soft">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <h2 className="font-heading font-semibold text-ink">Shortlisted</h2>
                  <span className="ml-auto text-xs font-medium bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{shortlisted.length}</span>
                </div>
                <div className="p-4 space-y-2">
                  {shortlisted.length === 0 ? (
                    <p className="text-sm text-gray-mid text-center py-6">None yet</p>
                  ) : (
                    shortlisted.map((c) => <CandidateCard key={c.id} candidate={c} />)
                  )}
                </div>
              </div>

              {/* On Hold */}
              <div className="bg-white rounded-2xl border border-gray-soft">
                <div className="flex items-center gap-2 p-5 border-b border-gray-soft">
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <h2 className="font-heading font-semibold text-ink">On Hold</h2>
                  <span className="ml-auto text-xs font-medium bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{onHold.length}</span>
                </div>
                <div className="p-4 space-y-2">
                  {onHold.length === 0 ? (
                    <p className="text-sm text-gray-mid text-center py-6">None yet</p>
                  ) : (
                    onHold.map((c) => <CandidateCard key={c.id} candidate={c} />)
                  )}
                </div>
              </div>

              {/* Rejected */}
              <div className="bg-white rounded-2xl border border-gray-soft">
                <div className="flex items-center gap-2 p-5 border-b border-gray-soft">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <h2 className="font-heading font-semibold text-ink">Rejected</h2>
                  <span className="ml-auto text-xs font-medium bg-red-100 text-red-600 px-2 py-0.5 rounded-full">{rejected.length}</span>
                </div>
                <div className="p-4 space-y-2">
                  {rejected.length === 0 ? (
                    <p className="text-sm text-gray-mid text-center py-6">None yet</p>
                  ) : (
                    rejected.map((c) => <CandidateCard key={c.id} candidate={c} />)
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}