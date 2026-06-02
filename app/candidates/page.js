'use client'

import { Suspense, useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ScanFace,
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  LogOut,
  Mail,
  Menu,
  X,
  Calendar,
  ExternalLink,
  Sparkles,
} from 'lucide-react'

function scoreColor(score) {
  if (score >= 7) return 'bg-green-100 text-green-700'
  if (score >= 4) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function CandidatesInner() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialFilter = searchParams.get('filter') === 'completed' ? 'completed' : 'invited'

  const [tab, setTab] = useState(initialFilter)
  const [selectedRole, setSelectedRole] = useState('All')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [invited, setInvited] = useState([])
  const [completed, setCompleted] = useState([])
  const [scoreMap, setScoreMap] = useState({})
  const [roleList, setRoleList] = useState([])

  useEffect(() => {
    async function load() {
      const [rolesRes, stagesRes, interviewsRes, scoresRes] = await Promise.all([
        supabase.from('roles').select('id, title'),
        supabase.from('stages').select('id, role_id, name'),
        supabase.from('interviews').select('stage_id, speaker, candidate_name, candidate_email, invited_at, created_at'),
        supabase.from('scores').select('candidate_name, score, status, stage_id'),
      ])

      const roles = rolesRes.data || []
      const stages = stagesRes.data || []
      const interviews = interviewsRes.data || []
      const scores = scoresRes.data || []

      const sm = {}
      scores.forEach((s) => { sm[`${s.stage_id}|${s.candidate_name}`] = { score: s.score, status: s.status } })
      setScoreMap(sm)

      const stageInfo = {}
      stages.forEach((s) => {
        const role = roles.find((r) => r.id === s.role_id)
        stageInfo[s.id] = { name: s.name || 'Untitled stage', roleTitle: role?.title || 'Unknown role' }
      })

      // Invited
      const inviteMap = new Map()
      interviews.filter((r) => r.speaker === 'invite' && r.candidate_email).forEach((r) => {
        const key = `${r.candidate_email.toLowerCase()}|${r.stage_id}`
        const existing = inviteMap.get(key)
        if (!existing || new Date(r.invited_at || 0) > new Date(existing.invited_at || 0)) {
          inviteMap.set(key, {
            email: r.candidate_email,
            stage_id: r.stage_id,
            stageName: stageInfo[r.stage_id]?.name || 'Unknown stage',
            roleTitle: stageInfo[r.stage_id]?.roleTitle || 'Unknown role',
            invited_at: r.invited_at,
          })
        }
      })
      const invitedList = Array.from(inviteMap.values()).sort((a, b) => new Date(b.invited_at || 0) - new Date(a.invited_at || 0))
      setInvited(invitedList)

      // Completed
      const compMap = new Map()
      interviews.filter((r) => r.speaker !== 'invite' && r.candidate_name).forEach((r) => {
        const key = `${r.stage_id}|${r.candidate_name}`
        const existing = compMap.get(key)
        if (!existing) {
          compMap.set(key, {
            candidate_name: r.candidate_name,
            stage_id: r.stage_id,
            stageName: stageInfo[r.stage_id]?.name || 'Unknown stage',
            roleTitle: stageInfo[r.stage_id]?.roleTitle || 'Unknown role',
            latest: r.created_at,
          })
        } else if (new Date(r.created_at) > new Date(existing.latest)) {
          existing.latest = r.created_at
        }
      })
      const completedList = Array.from(compMap.values()).sort((a, b) => new Date(b.latest || 0) - new Date(a.latest || 0))
      setCompleted(completedList)

      // Unique role titles across all candidates
      const allRoles = [...new Set([...invitedList, ...completedList].map((c) => c.roleTitle))].sort()
      setRoleList(allRoles)

      setLoading(false)
    }
    load()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function setFilter(next) {
    setTab(next)
    setSelectedRole('All')
    router.replace(`/candidates?filter=${next}`)
  }

  const baseList = tab === 'invited' ? invited : completed
  const filteredList = selectedRole === 'All' ? baseList : baseList.filter((c) => c.roleTitle === selectedRole)

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-soft flex-col">
        <div className="p-6 border-b border-gray-soft">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={18} aria-hidden="true" />
            </div>
            <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1" aria-label="Main navigation">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
            <LayoutDashboard size={18} aria-hidden="true" /> Dashboard
          </Link>
          <Link href="/roles" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
            <Briefcase size={18} aria-hidden="true" /> Roles
          </Link>
          <Link href="/candidates" aria-current="page" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-lavender text-ink font-medium text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
            <Users size={18} aria-hidden="true" /> Candidates
          </Link>
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
            <Settings size={18} aria-hidden="true" /> Settings
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-soft">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
            <LogOut size={18} aria-hidden="true" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile slide-out */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-soft flex flex-col" aria-label="Mobile navigation">
            <div className="p-6 border-b border-gray-soft flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
                  <ScanFace className="text-yellow" size={18} aria-hidden="true" />
                </div>
                <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="text-gray-mid focus:outline-none focus-visible:ring-2 focus-visible:ring-violet rounded" aria-label="Close navigation menu">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <LayoutDashboard size={18} aria-hidden="true" /> Dashboard
              </Link>
              <Link href="/roles" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <Briefcase size={18} aria-hidden="true" /> Roles
              </Link>
              <Link href="/candidates" onClick={() => setMobileNavOpen(false)} aria-current="page" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-lavender text-ink font-medium text-sm">
                <Users size={18} aria-hidden="true" /> Candidates
              </Link>
              <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <Settings size={18} aria-hidden="true" /> Settings
              </Link>
            </nav>
            <div className="p-4 border-t border-gray-soft">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <LogOut size={18} aria-hidden="true" /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-soft">
          <button onClick={() => setMobileNavOpen(true)} className="text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-violet rounded" aria-label="Open navigation menu" aria-expanded={mobileNavOpen}>
            <Menu size={22} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={16} aria-hidden="true" />
            </div>
            <span className="font-heading font-bold text-ink">Recrewt AI</span>
          </div>
          <div className="w-6" />
        </div>

        <div className="p-6 lg:p-10">
          {/* Header */}
          <div className="mb-6">
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-ink">Candidates</h1>
            <p className="text-sm text-gray-mid mt-1">Everyone you&apos;ve invited and everyone who&apos;s finished.</p>
          </div>

          {/* Invited / Completed tabs */}
          <div className="inline-flex bg-white border border-gray-soft rounded-xl p-1 mb-5" role="tablist" aria-label="Candidate filter">
            <button role="tab" aria-selected={tab === 'invited'} onClick={() => setFilter('invited')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${tab === 'invited' ? 'bg-violet text-white' : 'text-gray-mid hover:text-ink'}`}>
              Invited ({invited.length})
            </button>
            <button role="tab" aria-selected={tab === 'completed'} onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${tab === 'completed' ? 'bg-violet text-white' : 'text-gray-mid hover:text-ink'}`}>
              Completed ({completed.length})
            </button>
          </div>

          {/* Role filter pills */}
          {!loading && roleList.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6" aria-label="Filter by role">
              <button
                onClick={() => setSelectedRole('All')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${
                  selectedRole === 'All'
                    ? 'bg-ink text-white border-ink'
                    : 'bg-white text-gray-mid border-gray-soft hover:border-ink hover:text-ink'
                }`}
              >
                All
              </button>
              {roleList.map((role) => {
                const count = baseList.filter((c) => c.roleTitle === role).length
                return (
                  <button
                    key={role}
                    onClick={() => setSelectedRole(role)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${
                      selectedRole === role
                        ? 'bg-violet text-white border-violet'
                        : 'bg-white text-gray-mid border-gray-soft hover:border-violet hover:text-violet'
                    }`}
                  >
                    {role} <span className="opacity-60">({count})</span>
                  </button>
                )
              })}
            </div>
          )}

          {/* List */}
          {loading ? (
            <div className="text-center text-sm text-gray-mid py-20">Loading…</div>
          ) : filteredList.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-soft p-16 text-center">
              <p className="font-medium text-ink">
                {selectedRole !== 'All' ? `No ${tab} candidates for ${selectedRole}` : tab === 'invited' ? 'No invites sent yet' : 'No completed interviews yet'}
              </p>
              <p className="text-sm text-gray-mid mt-1">
                {selectedRole !== 'All' ? 'Try selecting a different role or All.' : tab === 'invited' ? 'Invite candidates from a role to see them here.' : 'Completed interviews show up here automatically.'}
              </p>
              {selectedRole === 'All' && (
                <Link href="/roles" className="mt-4 inline-flex items-center gap-2 bg-violet text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                  <Briefcase size={14} aria-hidden="true" /> Go to Roles
                </Link>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-soft overflow-hidden">
              <ul className="divide-y divide-gray-soft">
                {filteredList.map((c, idx) => {
                  const scoreKey = `${c.stage_id}|${c.candidate_name}`
                  const scored = tab === 'completed' ? scoreMap[scoreKey] : null
                  const transcriptUrl = `/interview/${c.stage_id}/transcript`

                  return (
                    <li key={idx} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-lavender text-violet font-heading font-semibold text-xs flex items-center justify-center shrink-0">
                        {tab === 'invited' ? <Mail size={16} aria-hidden="true" /> : initials(c.candidate_name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-ink truncate">
                          {tab === 'invited' ? c.email : c.candidate_name}
                        </div>
                        <div className="text-xs text-gray-mid truncate">
                          {c.roleTitle} · {c.stageName}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {tab === 'invited' ? (
                          <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-mid">
                            <Calendar size={12} aria-hidden="true" />
                            {formatDate(c.invited_at)}
                          </span>
                        ) : scored?.score ? (
                          <>
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${scoreColor(scored.score)}`}>
                              {scored.score}/10
                            </span>
                            <Link href={transcriptUrl}
                              className="inline-flex items-center gap-1 text-xs font-medium text-violet hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-violet rounded">
                              View
                            </Link>
                          </>
                        ) : (
                          <Link href={transcriptUrl}
                            className="inline-flex items-center gap-1.5 text-xs font-medium bg-violet text-white px-3 py-1.5 rounded-lg hover:bg-violet-dark transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
                            <Sparkles size={12} aria-hidden="true" /> Score Now
                          </Link>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <CandidatesInner />
    </Suspense>
  )
}