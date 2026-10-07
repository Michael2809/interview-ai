'use client'

/**
 * Clients — the top of the agency hierarchy.
 *
 *   client -> roles -> candidates
 *
 * Agencies hire for several companies at once, often for the same job
 * title. This page lists those companies; opening one shows only its
 * roles (/roles?client=<id>).
 *
 * A client is just a name. "About" is optional and only feeds the
 * candidate Q&A, so it lives behind a fold in the add dialog.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, Building2, ChevronRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { dropUnfinished } from '@/lib/transcript'
import { awaitingDecision } from '@/lib/decisions'
import AppShell from '@/components/AppShell'
import { SkeletonLine } from '@/components/AppShell/Skeleton'
import { Button, Modal, EmptyState, TextField, Toast } from '@/components/ui'

const NAME_MAX = 120
const ABOUT_MAX = 1500

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`
}

/* ── Loading skeleton ───────────────────────────────────── */

function LoadingBlock({ rows = 4 }) {
  return (
    <div aria-hidden="true" className="grid divide-y divide-[color:var(--color-rc-line)] border-y border-[color:var(--color-rc-line)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-5 px-3 rc-skeleton">
          <SkeletonLine className="w-9" height="h-9" />
          <div className="min-w-0 flex-1">
            <SkeletonLine className={i % 2 ? 'w-48' : 'w-40'} height="h-4" />
            <SkeletonLine className="mt-2 w-28" height="h-2.5" />
          </div>
          <SkeletonLine className="w-20 hidden md:block" height="h-3" />
          <SkeletonLine className="w-6" height="h-3" />
        </div>
      ))}
    </div>
  )
}

/* ── One client row ─────────────────────────────────────── */

function Stat({ value, label }) {
  return (
    <div className="text-right min-w-[84px]">
      <div
        className="text-[18px] leading-none font-semibold tabular-nums text-[color:var(--color-rc-ink)]"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] uppercase tracking-[0.12em] font-semibold text-[color:var(--color-rc-warm)]">
        {label}
      </div>
    </div>
  )
}

function ClientRow({ client }) {
  const initials = client.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

  return (
    <Link
      href={`/roles?client=${client.id}`}
      className={
        'group flex items-center gap-4 py-4 px-3 -mx-3 rounded-[10px] ' +
        'hover:bg-[color:var(--color-rc-soft)] transition-colors ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
      }
    >
      <div
        aria-hidden="true"
        className="h-10 w-10 shrink-0 grid place-items-center rounded-[10px] border border-[color:var(--color-rc-line)] bg-white text-[13px] font-semibold text-[color:var(--color-rc-ink)]"
      >
        {initials || <Building2 size={16} />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-medium text-[color:var(--color-rc-ink)] truncate">
          {client.name}
        </div>
        <div className="mt-0.5 text-[13px] text-[color:var(--color-rc-muted)] truncate">
          {client.activeRoles > 0
            ? `${plural(client.activeRoles, 'open role', 'open roles')}`
            : client.roles > 0 ? 'No open roles' : 'No roles yet'}
          {client.waiting > 0 && (
            <span className="text-[color:var(--color-rc-ink)]">
              {' · '}{client.waiting} waiting for review
            </span>
          )}
        </div>
      </div>

      <div className="hidden md:flex items-center gap-6">
        <Stat value={client.roles} label="Roles" />
        <Stat value={client.candidates} label="Candidates" />
      </div>

      <ChevronRight
        size={18}
        aria-hidden="true"
        className="shrink-0 text-[color:var(--color-rc-muted)] group-hover:text-[color:var(--color-rc-ink)] transition-colors"
      />
    </Link>
  )
}

/* ── Add client dialog ──────────────────────────────────── */

function AddClientModal({ open, onClose, onSave, saving, existingNames }) {
  const [name, setName] = useState('')
  const [about, setAbout] = useState('')
  const [showAbout, setShowAbout] = useState(false)
  const [error, setError] = useState('')

  function submit(e) {
    e?.preventDefault()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (!clean) { setError('Enter the client’s name.'); return }
    if (clean.length > NAME_MAX) { setError(`Keep it under ${NAME_MAX} characters.`); return }
    if (existingNames.has(clean.toLowerCase())) { setError('You already have a client with that name.'); return }
    onSave({ name: clean, about: about.trim() || null })
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Add client"
      description="The company you’re hiring for. You’ll add its roles next."
      size="sm"
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving}>Save client</Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="Client name"
          placeholder="Northwind Studio"
          value={name}
          maxLength={NAME_MAX}
          autoFocus
          error={error}
          onChange={(e) => { setName(e.target.value); if (error) setError('') }}
        />

        {showAbout ? (
          <div>
            <label htmlFor="client-about" className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)]">
              About the company <span className="font-normal text-[color:var(--color-rc-muted)]">(optional)</span>
            </label>
            <textarea
              id="client-about"
              rows={4}
              maxLength={ABOUT_MAX}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Consumer electronics company, around 300 people, founded in 2009."
              className={
                'w-full rounded-[10px] border border-[color:var(--color-rc-line)] bg-white px-3 py-2.5 ' +
                'text-[14px] leading-relaxed text-[color:var(--color-rc-ink)] placeholder:text-[color:var(--color-rc-muted)] ' +
                'hover:border-[color:var(--color-rc-muted)] focus:border-[color:var(--color-rc-ink)] focus:outline-none resize-y'
              }
            />
            <p className="mt-1.5 text-[12.5px] text-[color:var(--color-rc-muted)]">
              Only things that are true for every role at this company. Hours, pay and anything role-specific go in each role&rsquo;s JD.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAbout(true)}
            className="text-[13px] font-medium text-[color:var(--color-rc-ink)] underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 hover:decoration-[3px]"
          >
            + Add a line about the company
          </button>
        )}
      </form>
    </Modal>
  )
}

/* ── Page ───────────────────────────────────────────────── */

export default function ClientsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [adding, setAdding] = useState(false)
  // Bumped on every open so the dialog remounts with empty fields.
  const [addKey, setAddKey] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // No setLoading(true) here: the first load starts with loading=true,
  // and a refresh after adding a client should not flash the skeleton.
  const loadData = useCallback(async () => {
    const [clientsRes, rolesRes, stagesRes, interviewsRes, scoresRes] = await Promise.all([
      supabase.from('clients').select('id, name, about, created_at').order('created_at', { ascending: true }),
      supabase.from('roles').select('id, client_id, status'),
      supabase.from('stages').select('id, role_id'),
      supabase.from('interviews').select('stage_id, speaker, candidate_name, session_id, status'),
      supabase.from('scores').select('stage_id, candidate_name, status'),
    ])

    if (clientsRes.error) {
      console.error('clients load:', clientsRes.error)
      setErrorMsg("Couldn't load your clients. Refresh to try again.")
      setLoading(false)
      return
    }

    const roles = rolesRes.data || []
    const stages = stagesRes.data || []
    const scores = scoresRes.data || []
    const interviews = dropUnfinished(interviewsRes.data || [], scores)

    const roleClient = {}
    roles.forEach((r) => { roleClient[r.id] = r.client_id })
    const stageClient = {}
    stages.forEach((s) => { stageClient[s.id] = roleClient[s.role_id] })

    // Scored but nobody has decided yet = waiting for review.
    const scoreStatus = {}
    scores.forEach((s) => {
      scoreStatus[`${s.stage_id}|${String(s.candidate_name || '').toLowerCase()}`] = s.status
    })

    const byClient = {}
    ;(clientsRes.data || []).forEach((c) => {
      byClient[c.id] = { ...c, roles: 0, activeRoles: 0, candidates: new Set(), waiting: new Set() }
    })
    roles.forEach((r) => {
      const c = byClient[r.client_id]
      if (!c) return
      c.roles += 1
      if ((r.status || 'active') === 'active') c.activeRoles += 1
    })
    interviews.forEach((row) => {
      if (row.speaker === 'invite' || !row.candidate_name) return
      const c = byClient[stageClient[row.stage_id]]
      if (!c) return
      const key = `${row.stage_id}|${String(row.candidate_name).toLowerCase()}`
      c.candidates.add(key)
      if (key in scoreStatus && awaitingDecision(scoreStatus[key])) c.waiting.add(key)
    })

    setClients(
      Object.values(byClient).map((c) => ({
        ...c,
        candidates: c.candidates.size,
        waiting: c.waiting.size,
      })),
    )
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!message) return
    const t = setTimeout(() => setMessage(''), 3000)
    return () => clearTimeout(t)
  }, [message])

  useEffect(() => {
    if (!errorMsg) return
    const t = setTimeout(() => setErrorMsg(''), 4000)
    return () => clearTimeout(t)
  }, [errorMsg])

  const existingNames = useMemo(
    () => new Set(clients.map((c) => c.name.toLowerCase())),
    [clients],
  )

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients
    // Clients with work waiting float to the top, then by name.
    return [...list].sort((a, b) => (b.waiting > 0) - (a.waiting > 0) || a.name.localeCompare(b.name))
  }, [clients, search])

  function openAdd() {
    setAddKey((k) => k + 1)
    setAdding(true)
  }

  async function handleSave({ name, about }) {
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData?.user?.id
    if (!userId) {
      setSaving(false)
      setErrorMsg('Your session expired. Log in again.')
      return
    }
    const { error } = await supabase.from('clients').insert({ user_id: userId, name, about })
    setSaving(false)
    if (error) {
      console.error('add client:', error)
      setErrorMsg("Couldn't save the client. Try again.")
      return
    }
    setAdding(false)
    setMessage(`${name} added`)
    loadData()
  }

  return (
    <AppShell>
      <div className="max-w-[1180px] mx-auto">
        <Toast kind="success" message={message} />
        <Toast kind="error" message={errorMsg} />

        <header className="mb-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h1
              className="text-[26px] md:text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
              style={{ fontFamily: 'var(--font-editorial), inherit' }}
            >
              Clients
            </h1>
            <Button variant="primary" size="md" iconLeft={<Plus size={16} />} onClick={openAdd}>
              Add client
            </Button>
          </div>
          <p className="mt-1.5 text-[14px] text-[color:var(--color-rc-muted)]">
            The companies you&rsquo;re hiring for. Open one to see its roles and candidates.
          </p>
        </header>

        {!loading && clients.length > 5 && (
          <div className="mb-4 relative max-w-[340px]">
            <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-rc-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients"
              aria-label="Search clients"
              className={
                'w-full h-10 pl-9 pr-3 rounded-[10px] border border-[color:var(--color-rc-line)] bg-white ' +
                'text-[14px] text-[color:var(--color-rc-ink)] placeholder:text-[color:var(--color-rc-muted)] ' +
                'hover:border-[color:var(--color-rc-muted)] focus:border-[color:var(--color-rc-ink)] focus:outline-none'
              }
            />
          </div>
        )}

        {loading ? (
          <LoadingBlock />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={<Building2 size={22} />}
            title="Add your first client"
            description="Each client keeps its own roles and candidates, so two Graphic Designer roles for two companies never get mixed up."
            action={
              <Button variant="primary" iconLeft={<Plus size={16} />} onClick={openAdd}>
                Add client
              </Button>
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={<Search size={22} />}
            title="No clients match that search"
            description="Check the spelling or clear the search to see every client."
            action={<Button variant="secondary" onClick={() => setSearch('')}>Clear search</Button>}
          />
        ) : (
          <div className="grid divide-y divide-[color:var(--color-rc-line)] border-y border-[color:var(--color-rc-line)]">
            {shown.map((c) => <ClientRow key={c.id} client={c} />)}
          </div>
        )}

        <AddClientModal
          key={addKey}
          open={adding}
          onClose={() => setAdding(false)}
          onSave={handleSave}
          saving={saving}
          existingNames={existingNames}
        />
      </div>
    </AppShell>
  )
}
