'use client'

import { useState } from 'react'
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
  Send,
  TrendingUp,
  Clock,
  Menu,
  X,
} from 'lucide-react'

const stats = [
  { label: 'Active Roles', value: '3', icon: Briefcase },
  { label: 'Total Candidates', value: '47', icon: Users },
  { label: 'Avg Score', value: '78', icon: TrendingUp },
  { label: 'Interviews This Week', value: '12', icon: Clock },
]

const recentCandidates = [
  { initials: 'JS', name: 'Jordan Smith', role: 'Senior Developer', score: 92, status: 'New' },
  { initials: 'AP', name: 'Aisha Patel', role: 'Product Designer', score: 87, status: 'Reviewed' },
  { initials: 'MK', name: 'Marcus King', role: 'Senior Developer', score: 81, status: 'New' },
  { initials: 'LC', name: 'Lina Chen', role: 'Sales Lead', score: 76, status: 'Reviewed' },
  { initials: 'RB', name: 'Ravi Bhat', role: 'Product Designer', score: 68, status: 'New' },
]

const activeRoles = [
  { title: 'Senior Developer', candidates: 18, toReview: 4 },
  { title: 'Product Designer', candidates: 21, toReview: 7 },
  { title: 'Sales Lead', candidates: 8, toReview: 2 },
]

function scoreColor(score) {
  if (score >= 85) return 'bg-green-100 text-green-700'
  if (score >= 70) return 'bg-yellow/30 text-ink'
  return 'bg-red-100 text-red-700'
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
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

        <div className="p-6 lg:p-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-heading font-bold text-2xl md:text-3xl text-ink">Dashboard</h1>
              <p className="text-sm text-gray-mid mt-1">Welcome back. Here's what's happening with your hiring.</p>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((s) => (
              <div key={s.label} className="bg-white rounded-2xl p-5 border border-gray-soft">
                <div className="flex items-center gap-2 text-gray-mid text-xs uppercase tracking-wide">
                  <s.icon size={14} /> {s.label}
                </div>
                <div className="font-heading font-bold text-3xl text-ink mt-2">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Recent Candidates */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-soft">
              <div className="flex items-center justify-between p-6 border-b border-gray-soft">
                <h2 className="font-heading font-semibold text-lg text-ink">Recent Candidates</h2>
                <Link href="/dashboard" className="text-sm text-violet font-medium hover:text-violet-dark">View all</Link>
              </div>
              <div className="divide-y divide-gray-soft">
                {recentCandidates.map((c) => (
                  <div key={c.name} className="flex items-center justify-between p-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 bg-violet/10 rounded-full flex items-center justify-center text-violet font-heading font-semibold text-sm shrink-0">
                        {c.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-ink truncate">{c.name}</div>
                        <div className="text-xs text-gray-mid truncate">{c.role}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${scoreColor(c.score)}`}>
                        {c.score}/100
                      </span>
                      <span className="hidden sm:inline text-xs text-gray-mid">{c.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Roles */}
            <div className="bg-white rounded-2xl border border-gray-soft">
              <div className="flex items-center justify-between p-6 border-b border-gray-soft">
                <h2 className="font-heading font-semibold text-lg text-ink">Active Roles</h2>
                <Link href="/roles" className="text-sm text-violet font-medium hover:text-violet-dark">Manage</Link>
              </div>
              <div className="divide-y divide-gray-soft">
                {activeRoles.map((r) => (
                  <div key={r.title} className="p-5">
                    <div className="font-medium text-sm text-ink">{r.title}</div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-mid">
                      <span>{r.candidates} candidates</span>
                      <span className="text-violet font-medium">{r.toReview} to review</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-gray-mid mt-10">
            Data shown is sample data for demo purposes.
          </p>
        </div>
      </main>
    </div>
  )
}