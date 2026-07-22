'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Briefcase,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  Copy,
  PauseCircle,
  Archive,
  ArchiveRestore,
  Trash2,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { getWorkspaceEntitlements, isUnlimited, PLAN_KEYS } from '@/lib/subscription'
import {
  Button,
  Drawer,
  Modal,
  EmptyState,
  Spinner,
  TextField,
  Select,
} from '@/components/ui'

/* ─────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────── */

const JOB_CATEGORIES = {
  'Digital Marketing': [
    'SEO', 'Google Ads', 'Meta Ads', 'Email Marketing', 'Content Marketing',
    'Affiliate Marketing', 'Influencer Marketing', 'Social Media Management',
  ],
  'Engineering': [
    'Frontend', 'Backend', 'Full Stack', 'DevOps', 'Mobile (iOS)',
    'Mobile (Android)', 'Data Engineering', 'QA / Testing', 'Security',
  ],
  'Design': [
    'UI/UX', 'Graphic Design', 'Product Design', 'Motion Design',
    'Brand Design', 'Illustration',
  ],
  'Sales': [
    'Inside Sales', 'Account Executive', 'SDR / BDR',
    'Business Development', 'Sales Operations', 'Enterprise Sales',
  ],
  'Product': ['Product Manager', 'Product Analyst', 'Growth', 'Product Operations'],
  'Data & Analytics': [
    'Data Analyst', 'Data Scientist', 'Business Intelligence',
    'Machine Learning Engineer', 'AI Engineer',
  ],
  'Finance': ['Accounting', 'Financial Analysis', 'Payroll', 'Audit', 'Tax'],
  'Human Resources': ['Recruitment', 'HR Operations', 'L&D', 'Compensation & Benefits'],
  'Customer Success': ['Customer Support', 'Account Management', 'Onboarding', 'Technical Support'],
  'Operations': ['Project Management', 'Business Operations', 'Supply Chain', 'Logistics', 'Office Management'],
  'Other': [],
}

/**
 * Legacy hardcoded role limits used to live here. Roles now read
 * their limit from the plan row via getWorkspaceEntitlements — the
 * limit for the workspace lands in trialData.roleLimit (null → unlimited).
 */

const SESSION_KEYS = {
  search: 'recrewt:roles:search',
  status: 'recrewt:roles:status',
  department: 'recrewt:roles:department',
  sort: 'recrewt:roles:sort',
}

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────── */

function readSession(key, fallback) {
  if (typeof window === 'undefined') return fallback
  try {
    const v = window.sessionStorage.getItem(key)
    return v == null ? fallback : v
  } catch { return fallback }
}

function writeSession(key, value) {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(key, value ?? '') } catch {}
}

function normalizeDept(dept) {
  if (!dept) return null
  return dept.split('—')[0].split('-')[0].trim() || null
}

function relativeTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  const days = Math.floor(s / 86400)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function contextualAction(role) {
  const base = `/roles/${role.id}`
  if (role.waiting > 0)   return { label: 'Review candidates',   variant: 'primary',   href: `${base}#candidates`, iconRight: true }
  if (role.ongoing > 0)   return { label: 'Continue reviewing',  variant: 'secondary', href: `${base}#candidates`, iconRight: true }
  if (role.invited > 0)   return { label: 'Invite more',         variant: 'secondary', href: `${base}#invite`,     iconLeft:  true }
  if (role.invited === 0) return { label: 'Send first invites',  variant: 'secondary', href: `${base}#invite`,     iconLeft:  true }
  return { label: 'View role', variant: 'ghost', href: base, iconRight: true }
}

function employmentLabel(v) {
  return { 'full-time': 'Full-time', 'part-time': 'Part-time', 'contract': 'Contract' }[v] || v
}

function experienceLabel(v) {
  return { entry: 'Entry', mid: 'Mid', senior: 'Senior', lead: 'Lead' }[v] || v
}

/* ─────────────────────────────────────────────────────────────
 * Presentational primitives
 * ────────────────────────────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
      {children}
    </div>
  )
}

function SectionHeading({ children, className = '' }) {
  return (
    <h2
      className={
        'text-[26px] md:text-[30px] leading-[1.15] font-semibold tracking-[-0.028em] text-[color:var(--color-rc-ink)] ' +
        className
      }
      style={{ fontFamily: 'var(--font-editorial), inherit' }}
    >
      {children}
    </h2>
  )
}

function LoadingBlock() {
  return (
    <div className="rounded-[18px] bg-white border border-[color:var(--color-rc-line)] py-16 grid place-items-center [box-shadow:0_1px_2px_rgba(17,17,17,0.02)]">
      <div className="text-[color:var(--color-rc-muted)]">
        <Spinner size={18} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * SummaryStrip — 4 compact metrics beneath the page heading
 * ────────────────────────────────────────────────────────── */

function SummaryMetric({ label, value, highlight = false }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span
          className="text-[26px] md:text-[28px] leading-none font-semibold tracking-[-0.03em] text-[color:var(--color-rc-ink)] tabular-nums"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
        >
          {value}
        </span>
        {highlight && value > 0 && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]"
          />
        )}
      </div>
    </div>
  )
}

function SummaryStrip({ activeRoles, interviewsRunning, waiting, totalCandidates }) {
  return (
    <div className="mt-8 pt-6 border-t border-[color:var(--color-rc-line)] grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
      <SummaryMetric label="Active roles" value={activeRoles} />
      <SummaryMetric label="Interviews running" value={interviewsRunning} />
      <SummaryMetric label="Waiting for review" value={waiting} highlight />
      <SummaryMetric label="Total candidates" value={totalCandidates} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * FilterBar — search + status + department + sort
 * ────────────────────────────────────────────────────────── */

function FilterBar({
  search, onSearch,
  status, onStatus,
  dept,   onDept,   departments,
  sort,   onSort,
}) {
  return (
    <div className="mt-10 mb-8 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
      <div className="relative flex-1 min-w-0">
        <Search
          size={15}
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-rc-muted)] pointer-events-none"
        />
        <input
          type="search"
          role="searchbox"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search roles by title or department"
          aria-label="Search roles"
          className="w-full h-11 pl-9 pr-3 bg-white text-[14.5px] text-[color:var(--color-rc-ink)] border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0"
        />
      </div>

      <div className="grid grid-cols-3 gap-3 md:flex md:items-center md:gap-3 md:w-auto">
        <Select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => onStatus(e.target.value)}
          fullWidth={false}
          className="min-w-[140px]"
          options={[
            { value: 'all',      label: 'All status'  },
            { value: 'active',   label: 'Active'      },
            { value: 'paused',   label: 'Paused'      },
            { value: 'archived', label: 'Archived'    },
          ]}
        />
        <Select
          aria-label="Filter by department"
          value={dept}
          onChange={(e) => onDept(e.target.value)}
          fullWidth={false}
          className="min-w-[160px]"
          options={[
            { value: 'all', label: 'All departments' },
            ...departments.map((d) => ({ value: d, label: d })),
          ]}
        />
        <Select
          aria-label="Sort roles"
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          fullWidth={false}
          className="min-w-[170px]"
          options={[
            { value: 'priority', label: 'Sort: Priority'     },
            { value: 'recent',   label: 'Sort: Most active'  },
            { value: 'newest',   label: 'Sort: Newest'       },
            { value: 'oldest',   label: 'Sort: Oldest'       },
            { value: 'title',    label: 'Sort: Title A–Z'    },
          ]}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * PulseMeta — icon + count for each of "waiting", "in progress",
 * "invited".  Yellow reserved for the waiting attention indicator.
 * ────────────────────────────────────────────────────────── */

function PulseMeta({ waiting, ongoing, invited, lastActivity }) {
  return (
    <div className="mt-3 flex items-center flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-[color:var(--color-rc-muted)]">
      {waiting > 0 && (
        <span className="inline-flex items-center gap-1.5 text-[color:var(--color-rc-warm)] font-medium">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]"
          />
          <span className="sr-only">Attention required. </span>
          {waiting} waiting on you
        </span>
      )}
      <span className="inline-flex items-center gap-1.5">
        <Clock size={13} strokeWidth={1.75} aria-hidden="true" />
        {ongoing} in progress
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Users size={13} strokeWidth={1.75} aria-hidden="true" />
        {invited} invited
      </span>
      {lastActivity && (
        <span className="hidden sm:inline text-[color:var(--color-rc-muted)]">
          · updated {lastActivity}
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * RoleActionMenu — overflow menu on each row
 * ────────────────────────────────────────────────────────── */

function RoleActionMenu({ role, onDuplicate, onSetStatus, onDelete, hasStatusColumn = true }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (!menuRef.current?.contains(e.target)) setOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const status = role.status || 'active'
  // Lifecycle actions require the roles.status column to exist in the DB.
  // Before the migration runs, hide them entirely so we don't offer
  // actions the DB can't fulfil.
  const canPause     = hasStatusColumn && status === 'active'
  const canResume    = hasStatusColumn && status === 'paused'
  const canArchive   = hasStatusColumn && status !== 'archived'
  const canUnarchive = hasStatusColumn && status === 'archived'

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Actions for ${role.title}`}
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-9 w-9 grid place-items-center rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-52 z-20 rounded-[12px] bg-white border border-[color:var(--color-rc-line)] [box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)] py-1.5"
        >
          <Link
            href={`/roles/${role.id}`}
            role="menuitem"
            className="block px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]"
            onClick={() => setOpen(false)}
          >
            Open role
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDuplicate(role) }}
            className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
          >
            <Copy size={13} aria-hidden="true" /> Duplicate
          </button>
          {canPause && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onSetStatus(role, 'paused') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <PauseCircle size={13} aria-hidden="true" /> Pause hiring
            </button>
          )}
          {canResume && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onSetStatus(role, 'active') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <ArchiveRestore size={13} aria-hidden="true" /> Resume hiring
            </button>
          )}
          {canArchive && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onSetStatus(role, 'archived') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <Archive size={13} aria-hidden="true" /> Archive
            </button>
          )}
          {canUnarchive && (
            <button
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); onSetStatus(role, 'active') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <ArchiveRestore size={13} aria-hidden="true" /> Restore to Active
            </button>
          )}
          <div className="my-1 h-px bg-[color:var(--color-rc-line)]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => { setOpen(false); onDelete(role) }}
            className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-red)] hover:bg-[rgb(199_75_58_/_0.06)] flex items-center gap-2"
          >
            <Trash2 size={13} aria-hidden="true" /> Delete role
          </button>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * RoleRow — one editorial row
 * ────────────────────────────────────────────────────────── */

function RoleRow({ role, onDuplicate, onSetStatus, onDelete, hasStatusColumn = true }) {
  const cta = contextualAction(role)
  const status = role.status || 'active'
  const isMuted = status !== 'active'
  const primaryHref = `/roles/${role.id}`

  const statusPill =
    status === 'paused' ? (
      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[color:var(--color-rc-soft)] text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
        <PauseCircle size={10} aria-hidden="true" /> Paused
      </span>
    ) : status === 'archived' ? (
      <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full bg-[color:var(--color-rc-soft)] text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-muted)]">
        <Archive size={10} aria-hidden="true" /> Archived
      </span>
    ) : null

  return (
    <div
      className={
        'p-5 md:p-6 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] ' +
        '[box-shadow:0_1px_2px_rgba(17,17,17,0.015),0_20px_36px_-34px_rgba(17,17,17,0.06)] ' +
        'transition-[transform,box-shadow,border-color] duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)] ' +
        'hover:-translate-y-0.5 hover:border-[color:var(--color-rc-line-hover)] ' +
        'hover:[box-shadow:0_2px_4px_rgba(17,17,17,0.02),0_28px_48px_-34px_rgba(17,17,17,0.1)] ' +
        (isMuted ? 'opacity-80 ' : '')
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href={primaryHref}
              className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded min-w-0"
            >
              <h3
                className="text-[19px] md:text-[20px] leading-tight font-semibold tracking-[-0.022em] text-[color:var(--color-rc-ink)] truncate"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                {role.title}
              </h3>
            </Link>
            {statusPill}
          </div>
          <p className="mt-1.5 text-[13px] text-[color:var(--color-rc-muted)] truncate">
            {[
              role.department || 'Unassigned department',
              role.employment_type ? employmentLabel(role.employment_type) : null,
              role.experience_level ? experienceLabel(role.experience_level) : null,
            ].filter(Boolean).join(' · ')}
          </p>
          <PulseMeta
            waiting={role.waiting}
            ongoing={role.ongoing}
            invited={role.invited}
            lastActivity={role.lastActivityAt ? relativeTime(role.lastActivityAt) : null}
          />
        </div>
        <RoleActionMenu
          role={role}
          onDuplicate={onDuplicate}
          onSetStatus={onSetStatus}
          onDelete={onDelete}
          hasStatusColumn={hasStatusColumn}
        />
      </div>

      <div className="mt-5 flex justify-end">
        <Button
          as="a"
          href={cta.href}
          variant={cta.variant}
          size="sm"
          iconLeft={cta.iconLeft ? <Plus size={14} /> : undefined}
          iconRight={cta.iconRight ? <ChevronRight size={14} /> : undefined}
        >
          {cta.label}
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * RoleGroup — a section (Active default-open; Paused/Archived
 * default-collapsed accordion header)
 * ────────────────────────────────────────────────────────── */

function RoleGroup({ label, count, rows, defaultExpanded, ...rowProps }) {
  const [expanded, setExpanded] = useState(!!defaultExpanded)
  const contentId = `role-group-${label.toLowerCase()}`
  return (
    <section className="mb-10">
      {label === 'Active' ? (
        <div className="mb-5 flex items-baseline gap-3">
          <SectionLabel>Active ({count})</SectionLabel>
        </div>
      ) : (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={() => setExpanded((v) => !v)}
          className="mb-5 flex items-center gap-2 text-[color:var(--color-rc-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
        >
          <ChevronDown
            size={16}
            aria-hidden="true"
            className={
              'transition-transform duration-150 text-[color:var(--color-rc-muted)] ' +
              (expanded ? 'rotate-0' : '-rotate-90')
            }
          />
          <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
            {label} ({count})
          </span>
        </button>
      )}

      {(label === 'Active' || expanded) && (
        <div id={contentId} className="grid gap-4">
          {rows.map((r) => (
            <RoleRow key={r.id} role={r} {...rowProps} />
          ))}
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
 * CreateRoleDrawer — form moved out of the page
 * ────────────────────────────────────────────────────────── */

function CreateRoleDrawer({ open, onClose, onCreated, plan, roleLimit, currentCount, prefill }) {
  const supabase = createClient()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [employmentType, setEmploymentType] = useState('full-time')
  const [experienceLevel, setExperienceLevel] = useState('mid')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    // Pre-fill when duplicating; otherwise reset
    if (prefill) {
      setTitle((prefill.title || '') + ' (copy)')
      setDescription(prefill.description || '')
      const dep = prefill.department || ''
      const [cat, sub] = dep.split('—').map((s) => s.trim())
      setCategory(cat || '')
      setSubcategory(sub || '')
      setEmploymentType(prefill.employment_type || 'full-time')
      setExperienceLevel(prefill.experience_level || 'mid')
    } else {
      setTitle('')
      setDescription('')
      setCategory('')
      setSubcategory('')
      setEmploymentType('full-time')
      setExperienceLevel('mid')
    }
    setError('')
  }, [open, prefill])

  const subcategories = category ? JOB_CATEGORIES[category] || [] : []
  const unlimited = isUnlimited(roleLimit)
  const limit = unlimited ? Infinity : roleLimit
  const overLimit = !unlimited && currentCount >= limit
  const canSubmit = !!title.trim() && !saving && !overLimit

  async function submit() {
    if (!title.trim()) { setError('Please enter a job title.'); return }
    if (overLimit) {
      setError(`You have reached the ${limit}-role limit on your ${plan} plan. Upgrade to unlock more roles.`)
      return
    }
    setError('')
    setSaving(true)
    // Note: we do NOT send `status: 'active'` here.  Once the
    // 2026-07-18_add_roles_status.sql migration is run the column
    // will exist with DEFAULT 'active', and every new row gets it
    // for free.  Sending the value explicitly would break inserts
    // when the column hasn't been added yet.
    const { error: insertError } = await supabase.from('roles').insert({
      title: title.trim(),
      description: description.trim() || null,
      department: category
        ? (subcategory ? `${category} — ${subcategory}` : category)
        : null,
      employment_type: employmentType,
      experience_level: experienceLevel,
    })
    setSaving(false)
    if (insertError) {
      setError('Failed to create: ' + insertError.message)
      return
    }
    onCreated?.(title.trim())
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="clamp(360px,48vw,560px)"
      title={prefill ? 'Duplicate role' : 'Create role'}
      description="Recrewt will draft the interview questions for you once the role is saved."
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={submit} loading={saving} disabled={!canSubmit}>
            {prefill ? 'Duplicate role' : 'Create role'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <TextField
          label="Job title"
          required
          placeholder="e.g. Junior Backend Developer"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />

        <div>
          <label className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]">
            Job description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Briefly describe the role and responsibilities."
            className="w-full block bg-white text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3.5 py-2.5 text-[14.5px] transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0 resize-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Department"
            placeholder="Choose a category"
            value={category}
            onChange={(e) => { setCategory(e.target.value); setSubcategory('') }}
            options={Object.keys(JOB_CATEGORIES).map((c) => ({ value: c, label: c }))}
          />
          {category === 'Other' ? (
            <TextField
              label="Specialisation"
              placeholder="e.g. Legal, PR, Research"
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
            />
          ) : (
            <Select
              label="Specialisation"
              placeholder={category ? `Any ${category}` : 'Pick a department first'}
              value={subcategory}
              onChange={(e) => setSubcategory(e.target.value)}
              disabled={!category}
              options={subcategories.map((s) => ({ value: s, label: s }))}
            />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Employment"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
            options={[
              { value: 'full-time', label: 'Full-time' },
              { value: 'part-time', label: 'Part-time' },
              { value: 'contract',  label: 'Contract'  },
            ]}
          />
          <Select
            label="Experience"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            options={[
              { value: 'entry',  label: 'Entry level'  },
              { value: 'mid',    label: 'Mid level'    },
              { value: 'senior', label: 'Senior'       },
              { value: 'lead',   label: 'Lead'         },
            ]}
          />
        </div>

        {error && (
          <p className="text-[13px] text-[color:var(--color-rc-red)] bg-[rgb(199_75_58_/_0.06)] rounded px-3 py-2">
            {error}
          </p>
        )}

        {plan === 'trial' && Number.isFinite(limit) && (
          <p className="text-[12.5px] text-[color:var(--color-rc-muted)]">
            {Math.max(0, limit - currentCount)} of {limit} role slots remaining on your trial.{' '}
            <Link href="/upgrade" className="text-[color:var(--color-rc-ink)] font-medium underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4">
              Upgrade &rarr;
            </Link>
          </p>
        )}
      </div>
    </Drawer>
  )
}

/* ─────────────────────────────────────────────────────────────
 * RolesPage — the page
 * ────────────────────────────────────────────────────────── */

export default function RolesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  // Error toast primitive — sibling to setMessage. Never surfaces raw
  // backend text; callers pass a user-safe string and log the real
  // error with console.error for debugging.
  const [errorMsg, setErrorMsg] = useState('')
  const [hasStatusColumn, setHasStatusColumn] = useState(true)

  // Data
  const [rawRoles, setRawRoles] = useState([])  // roles + computed counts
  const [totals, setTotals] = useState({
    interviewsRunning: 0,
    waiting: 0,
    totalCandidates: 0,
  })
  const [trialData, setTrialData] = useState(null)

  // Filter state (session-persisted)
  const [search, setSearch]   = useState(() => readSession(SESSION_KEYS.search,     ''))
  const [status, setStatus]   = useState(() => readSession(SESSION_KEYS.status,     'active'))
  const [dept,   setDept]     = useState(() => readSession(SESSION_KEYS.department, 'all'))
  const [sort,   setSort]     = useState(() => readSession(SESSION_KEYS.sort,       'priority'))

  useEffect(() => { writeSession(SESSION_KEYS.search,     search) }, [search])
  useEffect(() => { writeSession(SESSION_KEYS.status,     status) }, [status])
  useEffect(() => { writeSession(SESSION_KEYS.department, dept)   }, [dept])
  useEffect(() => { writeSession(SESSION_KEYS.sort,       sort)   }, [sort])

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerPrefill, setDrawerPrefill] = useState(null)

  // Delete modal
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  /* ── Data loader ─────────────────────────────────────── */

  const loadData = useCallback(async () => {
    setLoading(true)

    // Try the full roles query first (includes `status`).  If the
    // migration hasn't been run yet, the column doesn't exist and the
    // whole query 400s.  Retry without `status` and default to 'active'
    // in JS.  This lets the page render correctly both pre- and
    // post-migration.
    async function loadRolesResilient() {
      const withStatus = await supabase
        .from('roles')
        .select('id, title, description, department, employment_type, experience_level, status, created_at')
        .order('created_at', { ascending: false })
      if (!withStatus.error) {
        setHasStatusColumn(true)
        return withStatus
      }
      const looksLikeMissingColumn =
        /column|status|schema/i.test(withStatus.error.message || '')
      if (!looksLikeMissingColumn) return withStatus
      // Column doesn't exist yet — hide lifecycle actions in the UI.
      setHasStatusColumn(false)
      return supabase
        .from('roles')
        .select('id, title, description, department, employment_type, experience_level, created_at')
        .order('created_at', { ascending: false })
    }

    const [rolesRes, stagesRes, interviewsRes, scoresRes, settingsRes] = await Promise.all([
      loadRolesResilient(),
      supabase.from('stages').select('id, role_id'),
      supabase.from('interviews').select('stage_id, speaker, candidate_name, candidate_email, invited_at'),
      supabase.from('scores').select('candidate_name, score, status, created_at'),
      (async () => {
        try {
          const { data: userData } = await supabase.auth.getUser()
          if (!userData?.user?.id) return { data: null }
          const ent = await getWorkspaceEntitlements(supabase, userData.user.id)
          return {
            data: {
              planKey:   ent.subscription.plan_key,
              roleLimit: ent.roles.limit,       // null → unlimited
              periodEnd: ent.period.end,
              interviewsRemaining: ent.candidates.remaining,
            },
          }
        } catch (err) {
          console.error('roles entitlements load:', err)
          return { data: null }
        }
      })(),
    ])

    if (settingsRes.data) setTrialData(settingsRes.data)

    const roles       = rolesRes.data       || []
    const stages      = stagesRes.data      || []
    const interviews  = interviewsRes.data  || []
    const scores      = scoresRes.data      || []

    const stageRole = {}
    stages.forEach((s) => { stageRole[s.id] = s.role_id })

    const invites     = interviews.filter((r) => r.speaker === 'invite')
    const transcripts = interviews.filter((r) => r.speaker !== 'invite' && r.candidate_name)

    // Per-role rollup
    const roleMap = {}
    roles.forEach((r) => {
      roleMap[r.id] = {
        ...r,
        status: r.status || 'active',
        invited: new Set(),
        completed: new Set(),
        completedCandidates: [],
        lastActivityAt: r.created_at || null,
      }
    })
    invites.forEach((r) => {
      const rid = stageRole[r.stage_id]
      if (rid && roleMap[rid] && r.candidate_email) {
        roleMap[rid].invited.add(r.candidate_email.toLowerCase())
        if (r.invited_at && (!roleMap[rid].lastActivityAt || new Date(r.invited_at) > new Date(roleMap[rid].lastActivityAt))) {
          roleMap[rid].lastActivityAt = r.invited_at
        }
      }
    })
    transcripts.forEach((r) => {
      const rid = stageRole[r.stage_id]
      if (rid && roleMap[rid] && r.candidate_name) {
        const key = `${r.stage_id}|${r.candidate_name}`
        if (!roleMap[rid].completed.has(key)) {
          roleMap[rid].completed.add(key)
          const scoreRow = scores.find((s) => s.candidate_name === r.candidate_name)
          roleMap[rid].completedCandidates.push({
            name: r.candidate_name,
            status: scoreRow?.status ?? null,
            created_at: scoreRow?.created_at ?? null,
          })
          if (scoreRow?.created_at && new Date(scoreRow.created_at) > new Date(roleMap[rid].lastActivityAt)) {
            roleMap[rid].lastActivityAt = scoreRow.created_at
          }
        }
      }
    })

    const rolesArr = Object.values(roleMap).map((r) => {
      const invitedCount   = r.invited.size
      const completedCount = r.completed.size
      const waitingCount   = r.completedCandidates.filter((c) => !c.status).length
      return {
        id: r.id,
        title: r.title,
        description: r.description,
        department: r.department,
        employment_type: r.employment_type,
        experience_level: r.experience_level,
        status: r.status,
        created_at: r.created_at,
        lastActivityAt: r.lastActivityAt,
        invited:  invitedCount,
        completed: completedCount,
        ongoing:  Math.max(invitedCount - completedCount, 0),
        waiting:  waitingCount,
      }
    })

    setRawRoles(rolesArr)

    // Global summary strip (across all Active roles only — waiting/running
    // are meaningless once a role is paused/archived)
    const activeOnly = rolesArr.filter((r) => (r.status || 'active') === 'active')
    setTotals({
      interviewsRunning: activeOnly.reduce((n, r) => n + r.ongoing, 0),
      waiting:           activeOnly.reduce((n, r) => n + r.waiting, 0),
      totalCandidates:   activeOnly.reduce((n, r) => n + r.invited, 0),
    })

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /* ── Handlers ────────────────────────────────────────── */

  async function handleSetStatus(role, next) {
    const prev = role.status || 'active'
    // Optimistic update
    setRawRoles((rs) => rs.map((r) => (r.id === role.id ? { ...r, status: next } : r)))
    const { error: e } = await supabase.from('roles').update({ status: next }).eq('id', role.id)
    if (e) {
      // Revert local state so we don't drift from the DB.
      setRawRoles((rs) => rs.map((r) => (r.id === role.id ? { ...r, status: prev } : r)))
      // Log the real error internally — never leak it to the recruiter.
      console.error('Role status update failed:', e)
      setErrorMsg("Couldn't update this role's status. Please try again.")
      setTimeout(() => setErrorMsg(''), 4200)
      return
    }
    const verb = next === 'paused' ? 'paused' : next === 'archived' ? 'archived' : 'active'
    setMessage(`"${role.title}" is now ${verb}.`)
    setTimeout(() => setMessage(''), 3200)
  }

  function handleDuplicate(role) {
    setDrawerPrefill(role)
    setDrawerOpen(true)
  }

  async function confirmDeleteRole() {
    if (!pendingDelete) return
    const roleId = pendingDelete.id
    setDeleting(true)
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
      setPendingDelete(null)
      await loadData()
      setMessage(`Role deleted.`)
      setTimeout(() => setMessage(''), 3200)
    } catch (e) {
      // Log real error; keep UI copy generic. Also close the modal so
      // the recruiter isn't stranded with a spinner if the DB fails.
      console.error('Role delete failed:', e)
      setErrorMsg('Unable to delete this role. Please try again.')
      setTimeout(() => setErrorMsg(''), 4200)
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  function handleCreated(newTitle) {
    setDrawerOpen(false)
    setDrawerPrefill(null)
    setMessage(`Role "${newTitle}" created.`)
    setTimeout(() => setMessage(''), 3200)
    loadData()
  }

  /* ── Derived (filter, sort, group) ─────────────────── */

  const departments = useMemo(() => {
    const set = new Set()
    rawRoles.forEach((r) => {
      const d = normalizeDept(r.department)
      if (d) set.add(d)
    })
    return Array.from(set).sort()
  }, [rawRoles])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rawRoles.filter((r) => {
      if (term) {
        const hay = ((r.title || '') + ' ' + (r.department || '')).toLowerCase()
        if (!hay.includes(term)) return false
      }
      if (dept !== 'all') {
        const d = normalizeDept(r.department)
        if (d !== dept) return false
      }
      return true
    })
  }, [rawRoles, search, dept])

  function sortRoles(list) {
    const arr = [...list]
    if (sort === 'priority') {
      arr.sort((a, b) => {
        const pa = a.waiting > 0 ? 0 : a.ongoing > 0 ? 1 : 2
        const pb = b.waiting > 0 ? 0 : b.ongoing > 0 ? 1 : 2
        if (pa !== pb) return pa - pb
        if (b.waiting !== a.waiting) return b.waiting - a.waiting
        if (b.ongoing !== a.ongoing) return b.ongoing - a.ongoing
        return b.invited - a.invited
      })
    } else if (sort === 'recent') {
      arr.sort((a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0))
    } else if (sort === 'newest') {
      arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    } else if (sort === 'oldest') {
      arr.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0))
    } else if (sort === 'title') {
      arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    }
    return arr
  }

  const grouped = useMemo(() => {
    const byStatus = { active: [], paused: [], archived: [] }
    filtered.forEach((r) => {
      const s = r.status || 'active'
      if (byStatus[s]) byStatus[s].push(r)
      else byStatus.active.push(r)
    })
    if (status === 'all') {
      return {
        active:   sortRoles(byStatus.active),
        paused:   sortRoles(byStatus.paused),
        archived: sortRoles(byStatus.archived),
      }
    }
    return {
      active:   status === 'active'   ? sortRoles(byStatus.active)   : [],
      paused:   status === 'paused'   ? sortRoles(byStatus.paused)   : [],
      archived: status === 'archived' ? sortRoles(byStatus.archived) : [],
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, status, sort])

  const activeRolesCount = rawRoles.filter((r) => (r.status || 'active') === 'active').length
  const totalRolesCount  = rawRoles.length
  const pausedCount   = rawRoles.filter((r) => r.status === 'paused').length
  const archivedCount = rawRoles.filter((r) => r.status === 'archived').length

  const plan = trialData?.planKey || PLAN_KEYS.TRIAL
  const rawLimit = trialData?.roleLimit
  const unlimited = isUnlimited(rawLimit)
  const limit = unlimited ? Infinity : rawLimit
  const slotsLeft = unlimited ? Infinity : Math.max(0, limit - totalRolesCount)
  const atLimit  = !unlimited && totalRolesCount >= limit
  const showTrialHint = plan === PLAN_KEYS.TRIAL && !unlimited

  const anyFilters =
    !!search.trim() || status !== 'active' || dept !== 'all' || sort !== 'priority'

  function clearFilters() {
    setSearch('')
    setStatus('active')
    setDept('all')
    setSort('priority')
  }

  const shownRoles =
    grouped.active.length + grouped.paused.length + grouped.archived.length

  return (
    <AppShell>
      <div className="max-w-[1180px] mx-auto">
        {message && (
          <div
            role="status"
            aria-live="polite"
            className="mb-6 rounded-[14px] bg-white border border-[color:var(--color-rc-line)] px-5 py-3 flex items-center gap-3 [box-shadow:0_1px_2px_rgba(17,17,17,0.02)]"
          >
            <CheckCircle2 size={16} className="text-[color:var(--color-rc-green)] shrink-0" aria-hidden="true" />
            <span className="text-[13.5px] text-[color:var(--color-rc-ink)]">{message}</span>
          </div>
        )}
        {errorMsg && (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-6 rounded-[14px] bg-white border border-[color:var(--color-rc-line)] px-5 py-3 flex items-center gap-3 [box-shadow:0_1px_2px_rgba(17,17,17,0.02)]"
          >
            <AlertTriangle size={16} className="text-[color:var(--color-rc-red)] shrink-0" aria-hidden="true" />
            <span className="text-[13.5px] text-[color:var(--color-rc-ink)]">{errorMsg}</span>
          </div>
        )}

        {/* Header */}
        <header className="mb-8">
          <SectionLabel>Roles</SectionLabel>
          <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="min-w-0">
              <h1
                className="text-[34px] md:text-[46px] leading-[1.02] font-semibold tracking-[-0.038em] text-[color:var(--color-rc-ink)] max-w-[22ch]"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                {loading
                  ? 'Your hiring processes.'
                  : activeRolesCount === 0
                    ? 'No hiring processes running.'
                    : (
                      <>
                        You have {activeRolesCount} hiring{' '}
                        process{activeRolesCount === 1 ? '' : 'es'} currently running.
                      </>
                    )}
              </h1>
              {!loading && (pausedCount > 0 || archivedCount > 0) && (
                <p className="mt-3 text-[14px] text-[color:var(--color-rc-muted)]">
                  {pausedCount > 0 && `${pausedCount} paused`}
                  {pausedCount > 0 && archivedCount > 0 && ' · '}
                  {archivedCount > 0 && `${archivedCount} archived`}
                </p>
              )}
              {showTrialHint && (
                <p className="mt-4 text-[13px] text-[color:var(--color-rc-muted)]">
                  {slotsLeft} of {limit} role slots remaining.{' '}
                  <Link href="/upgrade" className="text-[color:var(--color-rc-ink)] font-medium underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 hover:decoration-[3px]">
                    Upgrade &rarr;
                  </Link>
                </p>
              )}
            </div>
            <div className="shrink-0">
              <Button
                variant="primary"
                size="md"
                iconLeft={<Plus size={16} />}
                onClick={() => { setDrawerPrefill(null); setDrawerOpen(true) }}
                disabled={atLimit}
                aria-label={atLimit ? 'Role limit reached — upgrade to create more' : 'Create role'}
              >
                Create role
              </Button>
            </div>
          </div>

          {!loading && (
            <SummaryStrip
              activeRoles={activeRolesCount}
              interviewsRunning={totals.interviewsRunning}
              waiting={totals.waiting}
              totalCandidates={totals.totalCandidates}
            />
          )}
        </header>

        {/* Hide the filter bar until the user has at least one role.
            An empty state doesn't need Search / Status / Department / Sort. */}
        {!loading && totalRolesCount > 0 && (
          <FilterBar
            search={search}     onSearch={setSearch}
            status={status}     onStatus={setStatus}
            dept={dept}         onDept={setDept}
            departments={departments}
            sort={sort}         onSort={setSort}
          />
        )}

        {loading ? (
          <LoadingBlock />
        ) : totalRolesCount === 0 ? (
          <EmptyState
            icon={<Briefcase size={22} />}
            title="Every hire starts with a role."
            description="Describe a position and Recrewt drafts tailored interview questions for it."
            action={
              <Button
                variant="primary"
                iconLeft={<Plus size={16} />}
                onClick={() => { setDrawerPrefill(null); setDrawerOpen(true) }}
              >
                Create your first role
              </Button>
            }
          />
        ) : shownRoles === 0 ? (
          <EmptyState
            icon={<Search size={22} />}
            title="No roles match your filters."
            description={anyFilters
              ? 'Try adjusting the search or filters to widen your results.'
              : 'Nothing to show yet.'}
            action={anyFilters ? (
              <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>
            ) : undefined}
          />
        ) : (
          <>
            {grouped.active.length > 0 && (
              <RoleGroup
                label="Active"
                count={grouped.active.length}
                rows={grouped.active}
                defaultExpanded
                onDuplicate={handleDuplicate}
                onSetStatus={handleSetStatus}
                onDelete={setPendingDelete}
                hasStatusColumn={hasStatusColumn}
              />
            )}
            {grouped.paused.length > 0 && (
              <RoleGroup
                label="Paused"
                count={grouped.paused.length}
                rows={grouped.paused}
                defaultExpanded={status === 'paused'}
                onDuplicate={handleDuplicate}
                onSetStatus={handleSetStatus}
                onDelete={setPendingDelete}
                hasStatusColumn={hasStatusColumn}
              />
            )}
            {grouped.archived.length > 0 && (
              <RoleGroup
                label="Archived"
                count={grouped.archived.length}
                rows={grouped.archived}
                defaultExpanded={status === 'archived'}
                onDuplicate={handleDuplicate}
                onSetStatus={handleSetStatus}
                onDelete={setPendingDelete}
                hasStatusColumn={hasStatusColumn}
              />
            )}
          </>
        )}

        <CreateRoleDrawer
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setDrawerPrefill(null) }}
          onCreated={handleCreated}
          plan={plan}
          roleLimit={rawLimit}
          currentCount={totalRolesCount}
          prefill={drawerPrefill}
        />

        <Modal
          open={!!pendingDelete}
          onClose={() => !deleting && setPendingDelete(null)}
          title="Delete role?"
          description={
            pendingDelete
              ? `"${pendingDelete.title}" and all its interviews, invites, and scores will be permanently removed.`
              : ''
          }
          size="sm"
          dismissible={!deleting}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDeleteRole} loading={deleting}>
                Delete role
              </Button>
            </>
          }
        >
          This can’t be undone. Consider archiving instead — archived roles preserve all data.
        </Modal>
      </div>
    </AppShell>
  )
}
