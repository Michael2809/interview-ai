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
  Mail,
  Menu,
  X,
  Calendar,
  Clock,
  ChevronRight,
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

const VALID_TABS = ['completed', 'ongoing', 'invited']

export default function CandidatesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [tab, setTab] = useState('completed')
  const [selectedRole, setSelectedRole] = useState('All')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [invited, setInvited] = useState([])
  const [ongoing, setOngoing] = useState([])
  const [completed, setCompleted] = useState([])
  const [scoreMap, setScoreMap] = useState({})
  const [roleList, setRoleList] = useState([])

  // Read ?filter= from the URL the safe way (no useSearchParams, so no Suspense crash)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const f = params.get('filter')
    if (VALID_TABS.includes(f)) setTab(f)
  }, [])

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

      // --- Invited: one row per invited email + stage ---
      const inviteMap = new Map()
      interviews
        .filter((r) => r.speaker === 'invite' && r.candidate_email)
        .forEach((r) => {
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
      const invitedList = Array.from(inviteMap.values())
        .sort((a, b) => new Date(b.invited_at || 0) - new Date(a.invited_at || 0))

      // --- Completed: one row per candidate_name + stage who actually answered ---
      const answerRows = interviews.filter(
        (r) => r.speaker !== 'invite' && r.speaker !== 'audio' && r.candidate_name
      )
      const compMap = new Map()
      answerRows.forEach((r) => {
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
      const completedList = Array.from(compMap.values())
        .sort((a, b) => new Date(b.latest || 0) - new Date(a.latest || 0))

      // --- Ongoing: invited people who haven't finished yet ---
      // Someone counts as finished if their email shows up on an answer row.
      const finishedEmails = new Set(
        answerRows.filter((r) => r.candidate_email).map((r) => r.candidate_email.toLowerCase())
      )
      const ongoingList = invitedList.filter((c) => !finishedEmails.has(c.email.toLowerCase()))

      setInvited(invitedList)
      setCompleted(completedList)
      setOngoing(ongoingList)

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
    window.history.replaceState(null, '', `/candidates?filter=${next}`)
  }

  const baseList = tab === 'completed' ? completed : tab === 'ongoing' ? ongoing : invited
  const filteredList = selectedRole === 'All' ? baseList : baseList.filter((c) => c.roleTitle === selectedRole)

  const tabLabel = tab === 'completed' ? 'completed' : tab === 'ongoing' ? 'in-progress' : 'invited'

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
            <p className="text-sm text-gray-mid mt-1">Everyone you&apos;ve invited, who&apos;s still going, and who&apos;s finished.</p>
          </div>

          {/* Tabs */}
          <div className="inline-flex bg-white border border-gray-soft rounded-xl p-1 mb-5" role="tablist" aria-label="Candidate filter">
            <button role="tab" aria-selected={tab === 'completed'} onClick={() => setFilter('completed')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${tab === 'completed' ? 'bg-violet text-white' : 'text-gray-mid hover:text-ink'}`}>
              Completed ({completed.length})
            </button>
            <button role="tab" aria-selected={tab === 'ongoing'} onClick={() => setFilter('ongoing')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${tab === 'ongoing' ? 'bg-violet text-white' : 'text-gray-mid hover:text-ink'}`}>
              Ongoing ({ongoing.length})
            </button>
            <button role="tab" aria-selected={tab === 'invited'} onClick={() => setFilter('invited')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${tab === 'invited' ? 'bg-violet text-white' : 'text-gray-mid hover:text-ink'}`}>
              Invited ({invited.length})
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
                {selectedRole !== 'All'
                  ? `No ${tabLabel} candidates for ${selectedRole}`
                  : tab === 'completed'
                  ? 'No completed interviews yet'
                  : tab === 'ongoing'
                  ? 'Nobody in progress right now'
                  : 'No invites sent yet'}
              </p>
              <p className="text-sm text-gray-mid mt-1">
                {selectedRole !== 'All'
                  ? 'Try a different role or All.'
                  : tab === 'completed'
                  ? 'Completed interviews show up here automatically.'
                  : tab === 'ongoing'
                  ? 'People you invited who have not finished yet will show here.'
                  : 'Invite candidates from a role to see them here.'}
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

                  // COMPLETED: whole row is a clickable link to the transcript
                  if (tab === 'completed') {
                    const scored = scoreMap[`${c.stage_id}|${c.candidate_name}`]
                    const transcriptUrl = `/interview/${c.stage_id}/transcript`
                    return (
                      <li key={idx}>
                        <Link
                          href={transcriptUrl}
                          className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet"
                        >
                          <div className="w-10 h-10 rounded-full bg-lavender text-violet font-heading font-semibold text-xs flex items-center justify-center shrink-0">
                            {initials(c.candidate_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-sm text-ink truncate">{c.candidate_name}</div>
                            <div className="text-xs text-gray-mid truncate">{c.roleTitle} · {c.stageName}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {scored?.score != null ? (
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${scoreColor(scored.score)}`}>
                                {scored.score}/10
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-violet">Score now</span>
                            )}
                            <ChevronRight size={16} className="text-gray-mid" aria-hidden="true" />
                          </div>
                        </Link>
                      </li>
                    )
                  }

                  // ONGOING + INVITED: show the email
                  return (
                    <li key={idx} className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-lavender text-violet flex items-center justify-center shrink-0">
                        <Mail size={16} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm text-ink truncate">{c.email}</div>
                        <div className="text-xs text-gray-mid truncate">{c.roleTitle} · {c.stageName}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {tab === 'ongoing' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
                            <Clock size={12} aria-hidden="true" /> In progress
                          </span>
                        )}
                        <span className="hidden sm:flex items-center gap-1.5 text-xs text-gray-mid">
                          <Calendar size={12} aria-hidden="true" />
                          {formatDate(c.invited_at)}
                        </span>
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