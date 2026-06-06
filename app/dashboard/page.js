'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ScanFace, LayoutDashboard, Briefcase, Users, Settings, LogOut,
  Plus, Send, Clock, CheckCircle2, Loader, Star, Menu, X, Trash2, Lock, Zap, ChevronRight,
} from 'lucide-react'

function initials(name) {
  return (name || '').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function scoreColor(score) {
  if (score >= 7) return 'bg-green-100 text-green-700'
  if (score >= 4) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

function TrialBanner({ trialData }) {
  if (!trialData || trialData.plan !== 'trial') return null
  const daysLeft = Math.max(0, Math.ceil((new Date(trialData.trial_expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
  const interviewsLeft = Math.max(0, 5 - (trialData.trial_interviews_completed || 0))
  const urgent = daysLeft === 0 || interviewsLeft === 0
  return (
    <div className={`rounded-xl px-5 py-3 flex items-center justify-between gap-4 mb-6 ${urgent ? 'bg-red-50 border border-red-200' : 'bg-lavender border border-violet/20'}`}>
      <div className="flex items-center gap-3 flex-wrap">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${urgent ? 'bg-red-100 text-red-600' : 'bg-violet text-white'}`}>FREE TRIAL</span>
        {daysLeft === 0 ? <span className="text-sm font-medium text-red-600">Your trial has expired</span>
          : interviewsLeft === 0 ? <span className="text-sm font-medium text-red-600">You've used all 5 trial interviews</span>
          : <span className="text-sm text-ink"><strong>{interviewsLeft} interview{interviewsLeft === 1 ? '' : 's'}</strong> remaining · <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong> left</span>}
      </div>
      <Link href="/upgrade" className="shrink-0 bg-violet text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors">Upgrade Now</Link>
    </div>
  )
}

function TrialFeaturePanel() {
  const unlocked = ['AI question generation', 'Video interviews', 'AI scoring & transcripts', 'Full sentiment analysis', 'CSV bulk invites', 'Interview progress dashboard', 'Basic & advanced speech analysis']
  const locked = ['Unlimited roles', '500 interviews / month', '3 team logins', 'Same-day priority support']
  return (
    <section className="mb-8">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-soft p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-heading font-semibold text-ink text-sm">What you have now</span>
            <span className="bg-lavender text-violet text-xs px-2 py-0.5 rounded-full font-medium">Trial</span>
          </div>
          <div className="flex flex-col gap-2">
            {unlocked.map((f) => <div key={f} className="flex items-center gap-2 text-sm text-ink"><CheckCircle2 size={14} className="text-green-500 shrink-0" />{f}</div>)}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-dashed border-gray-soft p-5 opacity-80">
          <div className="flex items-center gap-2 mb-4">
            <span className="font-heading font-semibold text-ink text-sm">Unlock on upgrade</span>
            <span className="bg-yellow text-ink text-xs px-2 py-0.5 rounded-full font-bold">Growth</span>
          </div>
          <div className="flex flex-col gap-2">
            {locked.map((f) => <div key={f} className="flex items-center gap-2 text-sm text-gray-mid"><Lock size={13} className="shrink-0" />{f}</div>)}
          </div>
          <Link href="/upgrade" className="mt-5 w-full flex items-center justify-center gap-2 bg-violet text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-violet-dark transition-colors">
            <Zap size={14} /> Upgrade to unlock
          </Link>
        </div>
      </div>
    </section>
  )
}

function StatCard({ icon: Icon, label, value, accent, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-gray-soft hover:border-violet hover:shadow-sm transition-all block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-violet group"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-mid text-xs uppercase tracking-wide">
          <Icon size={14} /> {label}
        </div>
        <ChevronRight size={14} className="text-gray-mid opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className={`font-heading font-bold text-3xl mt-2 ${accent || 'text-ink'}`}>{value}</div>
    </button>
  )
}

function SlidePanel({ open, onClose, title, children }) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-soft">
          <h2 className="font-heading font-semibold text-lg text-ink">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-mid hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {children}
        </div>
      </div>
    </div>
  )
}

function CandidateRow({ name, email, score, roleTitle, date, stageId }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-lavender/30 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-lavender text-violet font-heading font-semibold text-xs flex items-center justify-center shrink-0">
          {name ? initials(name) : '?'}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-sm text-ink truncate">{name || email}</div>
          {roleTitle && <div className="text-xs text-gray-mid truncate">{roleTitle}</div>}
          {date && <div className="text-xs text-gray-mid">{date}</div>}
        </div>
      </div>
      {score != null && (
        <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ml-2 ${scoreColor(score)}`}>{score}/10</span>
      )}
    </div>
  )
}

function RoleRow({ title, invited, completed, ongoing }) {
  const pct = invited ? Math.min(100, Math.round((completed / invited) * 100)) : 0
  return (
    <div className="p-4 rounded-xl bg-gray-50 hover:bg-lavender/30 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-ink">{title}</span>
        <span className="text-xs bg-lavender text-violet px-2 py-0.5 rounded-full font-medium">{invited} invited</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden mb-2">
        <div className="h-full bg-violet rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-3 text-xs text-gray-mid">
        <span className="flex items-center gap-1"><CheckCircle2 size={11} className="text-green-600" /> {completed} done</span>
        <span className="flex items-center gap-1"><Loader size={11} className="text-violet" /> {ongoing} ongoing</span>
        <span className="ml-auto">{pct}%</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState(null)
  const [trialData, setTrialData] = useState(null)
  const [shortlisted, setShortlisted] = useState([])
  const [onHold, setOnHold] = useState([])
  const [rejected, setRejected] = useState([])
  const [upgraded, setUpgraded] = useState(false)
  const [activePanel, setActivePanel] = useState(null)

  const [invitedList, setInvitedList] = useState([])
  const [completedList, setCompletedList] = useState([])
  const [ongoingList, setOngoingList] = useState([])

  const [stats, setStats] = useState({ activeRoles: 0, invited: 0, completed: 0, ongoing: 0, avgScore: null, invitedThisWeek: 0 })
  const [roleProgress, setRoleProgress] = useState([])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgraded')) setUpgraded(true)
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [rolesRes, stagesRes, interviewsRes, scoresRes, settingsRes] = await Promise.all([
      supabase.from('roles').select('id, title'),
      supabase.from('stages').select('id, role_id, name'),
      supabase.from('interviews').select('stage_id, speaker, candidate_name, candidate_email, invited_at'),
      supabase.from('scores').select('id, candidate_name, score, summary, status').order('score', { ascending: false }),
      supabase.from('settings').select('plan, trial_started_at, trial_expires_at, trial_interviews_completed, onboarding_completed').single(),
    ])

    if (settingsRes.data) setTrialData(settingsRes.data)
    if (!settingsRes.data || !settingsRes.data.onboarding_completed) { router.push('/onboarding'); return }

    const roles = rolesRes.data || []
    const stages = stagesRes.data || []
    const interviews = interviewsRes.data || []
    const scores = scoresRes.data || []

    setShortlisted(scores.filter((s) => s.status === 'shortlisted'))
    setOnHold(scores.filter((s) => s.status === 'on-hold'))
    setRejected(scores.filter((s) => s.status === 'rejected'))

    const stageRole = {}
    stages.forEach((s) => { stageRole[s.id] = s.role_id })

    const roleTitle = {}
    roles.forEach((r) => { roleTitle[r.id] = r.title })

    const invites = interviews.filter((r) => r.speaker === 'invite')
    const transcripts = interviews.filter((r) => r.speaker !== 'invite' && r.candidate_name)

    // Build invited list for panel
    const inviteMap = {}
    invites.forEach((r) => {
      if (!r.candidate_email) return
      const key = r.candidate_email.toLowerCase()
      const rid = stageRole[r.stage_id]
      if (!inviteMap[key] || new Date(r.invited_at || 0) > new Date(inviteMap[key].invited_at || 0)) {
        inviteMap[key] = { email: r.candidate_email, roleTitle: rid ? roleTitle[rid] : null, invited_at: r.invited_at }
      }
    })
    const invitedArr = Object.values(inviteMap).sort((a, b) => new Date(b.invited_at || 0) - new Date(a.invited_at || 0))

    // Build completed list for panel
    const compMap = {}
    transcripts.forEach((r) => {
      const key = `${r.stage_id}|${r.candidate_name}`
      const rid = stageRole[r.stage_id]
      const score = scores.find((s) => s.candidate_name === r.candidate_name)
      if (!compMap[key]) compMap[key] = { name: r.candidate_name, roleTitle: rid ? roleTitle[rid] : null, score: score?.score ?? null, stageId: r.stage_id }
    })
    const completedArr = Object.values(compMap).sort((a, b) => (b.score ?? -1) - (a.score ?? -1))

    // Ongoing = invited but not completed
    const completedEmails = new Set(transcripts.map((r) => r.candidate_name?.toLowerCase()).filter(Boolean))
    const ongoingArr = invitedArr.filter((c) => !completedEmails.has(c.email?.toLowerCase()))

    setInvitedList(invitedArr)
    setCompletedList(completedArr)
    setOngoingList(ongoingArr)

    const roleMap = {}
    roles.forEach((r) => { roleMap[r.id] = { id: r.id, title: r.title || 'Untitled role', invited: new Set(), completed: new Set() } })
    invites.forEach((r) => {
      const rid = stageRole[r.stage_id]
      if (rid && roleMap[rid] && r.candidate_email) roleMap[rid].invited.add(r.candidate_email.toLowerCase())
    })
    transcripts.forEach((r) => {
      const rid = stageRole[r.stage_id]
      if (rid && roleMap[rid] && r.candidate_name) roleMap[rid].completed.add(`${r.stage_id}|${r.candidate_name}`)
    })

    const progress = Object.values(roleMap).map((r) => ({
      id: r.id, title: r.title, invited: r.invited.size, completed: r.completed.size,
      ongoing: Math.max(r.invited.size - r.completed.size, 0),
    })).sort((a, b) => b.invited - a.invited)
    setRoleProgress(progress)

    const distinctInvited = new Set(invites.filter((r) => r.candidate_email).map((r) => r.candidate_email.toLowerCase()))
    const distinctCompleted = new Set(transcripts.map((r) => `${r.stage_id}|${r.candidate_name}`))
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    const invitedThisWeek = invites.filter((r) => r.invited_at && new Date(r.invited_at).getTime() >= weekAgo).length
    const scored = scores.filter((s) => typeof s.score === 'number')
    const avgScore = scored.length ? (scored.reduce((sum, s) => sum + s.score, 0) / scored.length).toFixed(1) : null

    setStats({ activeRoles: roles.length, invited: distinctInvited.size, completed: distinctCompleted.size, ongoing: Math.max(distinctInvited.size - distinctCompleted.size, 0), avgScore, invitedThisWeek })
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function handleLogout() { await supabase.auth.signOut(); router.push('/login') }

  function handleInviteClick(e) {
    if (trialData?.plan === 'trial') {
      const daysLeft = Math.ceil((new Date(trialData.trial_expires_at) - new Date()) / (1000 * 60 * 60 * 24))
      const interviewsLeft = Math.max(0, 5 - (trialData.trial_interviews_completed || 0))
      if (interviewsLeft <= 0 || daysLeft <= 0) { e.preventDefault(); router.push('/upgrade') }
    }
  }

  async function deleteRole(roleId, title) {
    const ok = window.confirm(`Delete "${title}"?\n\nThis permanently removes the role and all its data. Cannot be undone.`)
    if (!ok) return
    setDeletingId(roleId)
    try {
      const { data: stageRows } = await supabase.from('stages').select('id').eq('role_id', roleId)
      const stageIds = (stageRows || []).map((s) => s.id)
      if (stageIds.length > 0) {
        await supabase.from('questions').delete().in('stage_id', stageIds)
        await supabase.from('interviews').delete().in('stage_id', stageIds)
        await supabase.from('scores').delete().in('stage_id', stageIds.map(String))
      }
      await supabase.from('stages').delete().eq('role_id', roleId)
      await supabase.from('roles').delete().eq('id', roleId)
      await loadData()
    } catch (e) { window.alert('Failed to delete: ' + (e?.message || 'Unknown error')) }
    finally { setDeletingId(null) }
  }

  const panelContent = {
    roles: {
      title: `Active Roles (${stats.activeRoles})`,
      content: roleProgress.length === 0
        ? <p className="text-sm text-gray-mid text-center py-8">No roles yet</p>
        : roleProgress.map((r) => <RoleRow key={r.id} {...r} />),
      link: { href: '/roles', label: 'Manage all roles' },
    },
    invited: {
      title: `Candidates Invited (${stats.invited})`,
      content: invitedList.length === 0
        ? <p className="text-sm text-gray-mid text-center py-8">No invites sent yet</p>
        : invitedList.map((c, i) => <CandidateRow key={i} name={null} email={c.email} roleTitle={c.roleTitle} date={c.invited_at ? new Date(c.invited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null} />),
      link: { href: '/candidates?filter=invited', label: 'View all invited' },
    },
    completed: {
      title: `Completed (${stats.completed})`,
      content: completedList.length === 0
        ? <p className="text-sm text-gray-mid text-center py-8">No completed interviews yet</p>
        : completedList.map((c, i) => <CandidateRow key={i} name={c.name} roleTitle={c.roleTitle} score={c.score} stageId={c.stageId} />),
      link: { href: '/candidates?filter=completed', label: 'View all completed' },
    },
    ongoing: {
      title: `Ongoing (${stats.ongoing})`,
      content: ongoingList.length === 0
        ? <p className="text-sm text-gray-mid text-center py-8">No ongoing interviews</p>
        : ongoingList.map((c, i) => <CandidateRow key={i} name={null} email={c.email} roleTitle={c.roleTitle} date={c.invited_at ? new Date(c.invited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null} />),
      link: { href: '/candidates?filter=invited', label: 'View all candidates' },
    },
    score: {
      title: `Top Scored Candidates`,
      content: completedList.filter((c) => c.score != null).length === 0
        ? <p className="text-sm text-gray-mid text-center py-8">No scored candidates yet</p>
        : completedList.filter((c) => c.score != null).map((c, i) => <CandidateRow key={i} name={c.name} roleTitle={c.roleTitle} score={c.score} stageId={c.stageId} />),
      link: { href: '/candidates?filter=completed', label: 'View all scores' },
    },
  }

  const panel = activePanel ? panelContent[activePanel] : null

  const navLinks = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', active: true },
    { href: '/roles', icon: Briefcase, label: 'Roles' },
    { href: '/candidates', icon: Users, label: 'Candidates' },
    { href: '/settings', icon: Settings, label: 'Settings' },
  ]

  const SidebarContent = () => (
    <>
      <div className="p-6 border-b border-gray-soft">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
            <ScanFace className="text-yellow" size={18} />
          </div>
          <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navLinks.map(({ href, icon: Icon, label, active }) => (
          <Link key={href} href={href} onClick={() => setMobileNavOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-violet ${active ? 'bg-lavender text-ink font-medium' : 'text-gray-mid hover:bg-gray-50 hover:text-ink'}`}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
      {trialData?.plan === 'trial' && (
        <div className="mx-4 mb-4 p-3 bg-lavender rounded-xl border border-violet/20">
          <div className="text-xs font-semibold text-violet mb-1">Free Trial</div>
          <div className="text-xs text-ink">{Math.max(0, 5 - (trialData.trial_interviews_completed || 0))} interviews left</div>
          <div className="mt-2 h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
            <div className="h-full bg-violet rounded-full" style={{ width: `${Math.min(100, ((trialData.trial_interviews_completed || 0) / 5) * 100)}%` }} />
          </div>
          <Link href="/upgrade" className="mt-2 block text-xs font-semibold text-violet hover:underline">Upgrade →</Link>
        </div>
      )}
      <div className="p-4 border-t border-gray-soft">
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
          <LogOut size={18} /> Logout
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-slide-in { animation: slideIn 0.25s cubic-bezier(0.32, 0.72, 0, 1); }
      `}</style>

      <aside className="hidden md:flex w-64 bg-white border-r border-gray-soft flex-col">
        <SidebarContent />
      </aside>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-soft flex flex-col">
            <div className="p-6 border-b border-gray-soft flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center"><ScanFace className="text-yellow" size={18} /></div>
                <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="text-gray-mid"><X size={20} /></button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}

      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-soft">
          <button onClick={() => setMobileNavOpen(true)} className="text-ink"><Menu size={22} /></button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center"><ScanFace className="text-yellow" size={16} /></div>
            <span className="font-heading font-bold text-ink">Recrewt AI</span>
          </div>
          <div className="w-6" />
        </div>

        <div className="p-6 lg:p-10">
          {upgraded && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3 flex items-center gap-3 mb-6">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <span className="text-sm font-medium text-green-700">You're upgraded. Welcome to the full Recrewt experience.</span>
            </div>
          )}

          <TrialBanner trialData={trialData} />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="font-heading font-bold text-2xl md:text-3xl text-ink">Dashboard</h1>
              <p className="text-sm text-gray-mid mt-1">Welcome back. Here's your hiring activity at a glance.</p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/roles" onClick={handleInviteClick} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-white border border-ink text-ink font-medium px-4 py-2 rounded-lg hover:bg-ink hover:text-white transition-colors text-sm">
                <Send size={16} /> Invite
              </Link>
              <Link href="/roles" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 bg-violet text-white font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors text-sm">
                <Plus size={16} /> Create Role
              </Link>
            </div>
          </div>

          <section className="mb-8">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={Briefcase}    label="Active Roles"       value={stats.activeRoles}              onClick={() => setActivePanel('roles')} />
              <StatCard icon={Users}        label="Candidates Invited" value={stats.invited}                  onClick={() => setActivePanel('invited')} />
              <StatCard icon={CheckCircle2} label="Completed"          value={stats.completed} accent="text-green-600" onClick={() => setActivePanel('completed')} />
              <StatCard icon={Loader}       label="Ongoing"            value={stats.ongoing}   accent="text-violet"    onClick={() => setActivePanel('ongoing')} />
              <StatCard icon={Star}         label="Avg Score"          value={stats.avgScore ?? '—'}          onClick={() => setActivePanel('score')} />
            </div>
            <p className="text-xs text-gray-mid mt-3 flex items-center gap-1">
              <Clock size={12} />{stats.invitedThisWeek} new invite{stats.invitedThisWeek === 1 ? '' : 's'} this week
            </p>
          </section>

          {trialData?.plan === 'trial' && <TrialFeaturePanel />}

          <section className="mb-8">
            <h2 className="font-heading font-semibold text-lg text-ink mb-4">Interview Progress by Role</h2>
            {loading ? <div className="text-center text-sm text-gray-mid py-12">Loading…</div>
              : roleProgress.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-soft p-12 text-center">
                  <p className="font-medium text-ink">No roles yet</p>
                  <p className="text-sm text-gray-mid mt-1">Create a role to start inviting candidates.</p>
                  <Link href="/roles" className="mt-4 inline-flex items-center gap-2 bg-violet text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors">
                    <Plus size={14} /> Create Role
                  </Link>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {roleProgress.map((r) => {
                    const pct = r.invited ? Math.min(100, Math.round((r.completed / r.invited) * 100)) : 0
                    const isDeleting = deletingId === r.id
                    return (
                      <div key={r.id} className="bg-white rounded-2xl p-5 border border-gray-soft relative">
                        <button onClick={() => deleteRole(r.id, r.title)} disabled={isDeleting}
                          className="absolute top-3 right-3 p-1.5 text-gray-mid hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                          {isDeleting ? <Loader size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                        <div className="flex items-start justify-between gap-3 pr-8">
                          <h3 className="font-heading font-semibold text-ink">{r.title}</h3>
                          <span className="text-xs font-medium bg-lavender text-violet px-2 py-1 rounded-full shrink-0">{r.invited} invited</span>
                        </div>
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-1.5">
                            <span className="text-ink font-medium">{r.completed} of {r.invited} completed</span>
                            <span className="text-gray-mid">{pct}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full bg-violet rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-4 text-xs text-gray-mid">
                          <span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-green-600" /> {r.completed} done</span>
                          <span className="flex items-center gap-1.5"><Loader size={13} className="text-violet" /> {r.ongoing} ongoing</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
          </section>

          <section>
            <h2 className="font-heading font-semibold text-lg text-ink mb-4">Candidate Pipeline</h2>
            {loading ? <div className="text-center text-sm text-gray-mid py-20">Loading pipeline…</div>
              : shortlisted.length + onHold.length + rejected.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-gray-soft p-16 text-center">
                  <p className="font-medium text-ink">No scored candidates yet</p>
                  <p className="text-sm text-gray-mid mt-1">Score a candidate from their transcript and they'll appear here.</p>
                  <Link href="/roles" className="mt-4 inline-flex items-center gap-2 bg-violet text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors">
                    <Briefcase size={14} /> Go to Roles
                  </Link>
                </div>
              ) : (
                <div className="grid lg:grid-cols-3 gap-6">
                  {[
                    { title: 'Shortlisted', dot: 'bg-green-500', badge: 'bg-green-100 text-green-700', list: shortlisted },
                    { title: 'On Hold', dot: 'bg-yellow-400', badge: 'bg-yellow-100 text-yellow-700', list: onHold },
                    { title: 'Rejected', dot: 'bg-red-400', badge: 'bg-red-100 text-red-600', list: rejected },
                  ].map(({ title, dot, badge, list }) => (
                    <section key={title} className="bg-white rounded-2xl border border-gray-soft">
                      <div className="flex items-center gap-2 p-5 border-b border-gray-soft">
                        <div className={`w-2 h-2 rounded-full ${dot}`} />
                        <h3 className="font-heading font-semibold text-ink">{title}</h3>
                        <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${badge}`}>{list.length}</span>
                      </div>
                      <div className="p-4 space-y-2">
                        {list.length === 0 ? <p className="text-sm text-gray-mid text-center py-6">None yet</p>
                          : list.map((c) => (
                            <div key={c.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-lavender/40 transition-colors">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-full bg-lavender text-violet font-heading font-semibold text-xs flex items-center justify-center shrink-0">
                                  {initials(c.candidate_name)}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-medium text-sm text-ink truncate">{c.candidate_name}</div>
                                  <div className="text-xs text-gray-mid truncate">{c.summary?.slice(0, 60)}…</div>
                                </div>
                              </div>
                              <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ml-2 ${scoreColor(c.score)}`}>{c.score}/10</span>
                            </div>
                          ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
          </section>
        </div>
      </main>

      {panel && (
        <SlidePanel open={!!activePanel} onClose={() => setActivePanel(null)} title={panel.title}>
          {panel.content}
          {panel.link && (
            <Link href={panel.link.href} onClick={() => setActivePanel(null)}
              className="flex items-center justify-center gap-2 w-full mt-2 py-2.5 rounded-xl border border-violet text-violet text-sm font-medium hover:bg-lavender transition-colors">
              {panel.link.label} <ChevronRight size={14} />
            </Link>
          )}
        </SlidePanel>
      )}
    </div>
  )
}
