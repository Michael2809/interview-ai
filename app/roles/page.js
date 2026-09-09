'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { awaitingDecision } from '@/lib/decisions'
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
  Upload,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { SkeletonRow, SkeletonLine } from '@/components/AppShell/Skeleton'
import { getWorkspaceEntitlements, isUnlimited, PLAN_KEYS } from '@/lib/subscription'
import {
  Button,
  Drawer,
  Modal,
  EmptyState,
  Spinner,
  TextField,
  Select,
  Toast,
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

/**
 * Derive a single "health" signal per role — the recruiter reads
 * one word and knows what to do. Order matters: paused/closed
 * lifecycle wins, then attention-required, then activity health.
 *
 * Returns { key, label, dot } where `dot` is one of the shared
 * StatusDot palette tokens ('amber' | 'red' | 'green' | 'muted').
 */
const STALE_MS = 7 * 24 * 60 * 60 * 1000

function roleHealth(role) {
  const status = role.status || 'active'
  if (status === 'paused')   return { key: 'paused',       label: 'Paused',           dot: 'muted' }
  if (status === 'archived') return { key: 'closed',       label: 'Closed',           dot: 'muted' }
  if (role.waiting > 0)      return { key: 'needs-review', label: 'Needs Review',     dot: 'amber' }
  const now = Date.now()
  const last = role.lastActivityAt ? new Date(role.lastActivityAt).getTime() : null
  const stale = last && (now - last) > STALE_MS
  if ((role.invited > 0) && stale) {
    return { key: 'behind', label: 'Behind Schedule', dot: 'red' }
  }
  if (role.invited === 0) {
    return { key: 'no-invites', label: 'No candidates yet', dot: 'muted' }
  }
  return { key: 'healthy', label: 'Healthy', dot: 'green' }
}

/** Numeric priority for sort — smaller = higher priority. */
function healthPriority(role) {
  const key = roleHealth(role).key
  if (key === 'needs-review') return 0
  if (key === 'behind')       return 1
  // Healthy active roles with in-progress work sit above idle ones.
  if (key === 'healthy' && role.ongoing > 0) return 2
  if (key === 'healthy')      return 3
  if (key === 'no-invites')   return 4
  if (key === 'paused')       return 5
  return 6
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

/**
 * LoadingBlock — row-shaped skeleton stack that matches the roles
 * list layout. Prevents the "spinner card → real rows" layout jump
 * users used to see on this page.
 */
function LoadingBlock({ rows = 5 }) {
  return (
    <div aria-hidden="true" className="grid divide-y divide-[color:var(--color-rc-line)] border-y border-[color:var(--color-rc-line)]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 py-5 px-3 rc-skeleton">
          <div className="min-w-0 flex-1">
            <SkeletonLine className={i % 2 ? 'w-64' : 'w-56'} height="h-4" />
            <div className="mt-2 flex items-center gap-3">
              <SkeletonLine className="w-24" height="h-2.5" />
              <SkeletonLine className="w-32" height="h-2.5" />
            </div>
          </div>
          <SkeletonLine className="w-14 hidden md:block" height="h-3" />
          <SkeletonLine className="w-20 hidden md:block" height="h-3" />
          <SkeletonLine className="w-6" height="h-3" />
        </div>
      ))}
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

function SummaryStrip({ activeRoles, interviewsRunning, waiting, totalCandidates, needsAttention }) {
  return (
    <div className="mt-5 pt-5 border-t border-[color:var(--color-rc-line)] grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-5">
      {/* Attention metric leads — it's the only one that answers
          "What needs my attention today?" */}
      <SummaryMetric label="Waiting for review"   value={waiting} highlight />
      <SummaryMetric label="Roles needing action" value={needsAttention} />
      <SummaryMetric label="Interviews running"   value={interviewsRunning} />
      <SummaryMetric label="Active roles"         value={activeRoles} />
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
    <div className="mt-6 mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
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
 * RoleHealthChip — single-word health signal driven by roleHealth().
 * Same 24px chip shape used across the app; colour maps to the shared
 * status-dot palette so recruiters read the state the same way here
 * as on Dashboard, Candidate List, and Candidate Details.
 * ────────────────────────────────────────────────────────── */

function RoleHealthChip({ health }) {
  const dotClass =
    health.dot === 'green'  ? 'bg-[color:var(--color-rc-green)]' :
    health.dot === 'amber'  ? 'bg-[color:var(--color-rc-yellow)]' :
    health.dot === 'red'    ? 'bg-[color:var(--color-rc-red)]' :
    health.dot === 'blue'   ? 'bg-[color:var(--color-rc-blue)]' :
                              'bg-[color:var(--color-rc-muted)]'
  return (
    <span
      role="status"
      aria-label={`Role health: ${health.label}`}
      className="inline-flex items-center gap-1.5 h-5 pl-1.5 pr-2 rounded-full bg-[color:var(--color-rc-soft)] text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-muted)] whitespace-nowrap"
    >
      <span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full ' + dotClass} />
      {health.label}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
 * PipelineBreakdown — five-column candidate breakdown surfaced on
 * every role row. Recruiters see Awaiting · In Progress · Shortlisted
 * · On Hold · Rejected without opening the role. Muted zero states,
 * ink-black values when there's activity — hierarchy through weight,
 * not colour.
 * ────────────────────────────────────────────────────────── */

function PipelineCell({ label, value }) {
  const isZero = !value || value === 0
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-muted)]">
        {label}
      </div>
      <div
        className={
          'mt-1 text-[15px] tabular-nums leading-none ' +
          (isZero ? 'text-[color:var(--color-rc-muted)]/60 font-normal' : 'text-[color:var(--color-rc-ink)] font-semibold')
        }
      >
        {value ?? 0}
      </div>
    </div>
  )
}

function PipelineBreakdown({ waiting, ongoing, shortlisted, onHold, rejected, lastActivity }) {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-5 gap-x-4 md:gap-x-6">
        <PipelineCell label="Awaiting"    value={waiting} />
        <PipelineCell label="In progress" value={ongoing} />
        <PipelineCell label="Shortlisted" value={shortlisted} />
        <PipelineCell label="On hold"     value={onHold} />
        <PipelineCell label="Rejected"    value={rejected} />
      </div>
      {lastActivity && (
        <div className="mt-2 text-[11.5px] text-[color:var(--color-rc-muted)]">
          Updated {lastActivity}
        </div>
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
  const health = roleHealth(role)

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
            {/* Single health chip subsumes the old status pill — it
                already covers Paused / Closed and adds Needs Review /
                Behind Schedule / Healthy on top. No duplicate signal. */}
            <RoleHealthChip health={health} />
          </div>
          <p className="mt-1.5 text-[13px] text-[color:var(--color-rc-muted)] truncate">
            {[
              role.department || 'Unassigned department',
              role.employment_type ? employmentLabel(role.employment_type) : null,
              role.experience_level ? experienceLabel(role.experience_level) : null,
            ].filter(Boolean).join(' · ')}
          </p>
          <PipelineBreakdown
            waiting={role.waiting}
            ongoing={role.ongoing}
            shortlisted={role.shortlisted}
            onHold={role.onHold}
            rejected={role.rejected}
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

/**
 * How hard the first interview is pitched, from how senior the role is.
 *
 * Kept as an explicit map rather than a clever fallback: an "entry level"
 * role generating advanced questions is the kind of thing nobody notices
 * until a candidate complains.
 */
const STAGE_LEVEL = { entry: 'introductory', mid: 'mid-level', senior: 'advanced', lead: 'advanced' }

/**
 * Same ceiling as the JD reader, for the same reason: six requirements
 * is a nineteen-minute interview, and seven is where candidates quit.
 */
const MAX_CRITERIA = 6

/** Below this a score has nothing to stand on. */
const MIN_CRITERIA = 3

const EXPERIENCE_WORD  = { entry: 'Entry level', mid: 'Mid level', senior: 'Senior', lead: 'Lead' }
const EMPLOYMENT_WORD  = { 'full-time': 'Full-time', 'part-time': 'Part-time', contract: 'Contract', internship: 'Internship' }
const SALARY_WORD      = { hide: "won't discuss pay", defer: 'pay discussed later', show: 'range shared with candidates' }

/* ─────────────────────────────────────────────────────────────
 * Fold — a labelled line that opens into its controls.
 *
 * The drawer used to show every field at once, so confirming a role the
 * AI had already worked out meant scrolling past six controls to check
 * somebody else's typing. Each Fold states its answer in one line and
 * keeps the inputs behind it. Correcting is still one click; reading is
 * now free.
 * ────────────────────────────────────────────────────────── */

function Fold({ label, summary, children, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={'border-t border-[color:var(--color-rc-line)] ' + className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start gap-3 py-3.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
      >
        <span className="shrink-0 w-[92px] pt-px text-[11.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
          {label}
        </span>
        <span className="min-w-0 flex-1 text-[13.5px] leading-relaxed text-[color:var(--color-rc-ink)]">
          {summary}
        </span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={
            'shrink-0 mt-0.5 text-[color:var(--color-rc-muted)] transition-transform duration-200 ' +
            (open ? 'rotate-180' : 'group-hover:translate-y-px')
          }
        />
      </button>
      {open && <div className="pb-5">{children}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * CriteriaList — the requirements pulled out of a job description.
 *
 * Every row carries the phrase from the JD that produced it. That is not
 * decoration: these become what candidates are scored against, and a
 * recruiter cannot sensibly confirm a requirement without seeing where
 * it came from. It also makes a bad extraction obvious at a glance
 * rather than six interviews later.
 * ────────────────────────────────────────────────────────── */

function CriteriaList({ items, onRemove }) {
  return (
    <ul className="grid gap-3.5">
      {items.map((c, i) => (
        <li key={c.label + i} className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[13.5px] font-medium text-[color:var(--color-rc-ink)]">{c.label}</p>
            {c.evidence && (
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)] italic">
                &ldquo;{c.evidence}&rdquo;
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onRemove(i)}
            aria-label={'Remove ' + c.label}
            className="shrink-0 text-[12px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-red)] transition-colors"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
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

  // ── JD-first intake ────────────────────────────────────────────
  // The recruiter uploads a job description and the AI proposes every
  // field below; they correct what is wrong and confirm. Typing the
  // form by hand still works — this only ever pre-fills it.
  const [manualMode, setManualMode] = useState(false)
  const [jdParsing, setJdParsing] = useState(false)
  const [jdError, setJdError] = useState('')
  const [jdText, setJdText] = useState('')
  const [jdFileName, setJdFileName] = useState('')
  const [mustHaves, setMustHaves] = useState([])
  const [niceToHaves, setNiceToHaves] = useState([])
  const [salaryRange, setSalaryRange] = useState('')
  const [salaryVisibility, setSalaryVisibility] = useState('hide')

  // ── The two things the JD never says ───────────────────────────
  // A job description is written to attract applicants, so it lists
  // everything as required and nothing as negotiable. These two answers
  // are the recruiter's actual hiring bar, and they are asked here —
  // while the requirements are on screen — rather than on a setup page
  // nobody reaches. Both are optional; skipping them costs nothing.
  const [flexible, setFlexible] = useState([])
  const [greatVsOkay, setGreatVsOkay] = useState('')
  const [drafting, setDrafting] = useState(false)

  // ── Requirements without a job description ─────────────────────
  // Picking from a list beats typing into an empty box: recruiters will
  // do it, and the result is still theirs because they ticked it. The
  // alternative was the app guessing from the job title and never
  // saying so.
  const [suggestions, setSuggestions] = useState([])
  const [suggesting, setSuggesting] = useState(false)
  const [suggestError, setSuggestError] = useState('')
  const [ownSkill, setOwnSkill] = useState('')
  const suggestedFor = useRef('')

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
    setManualMode(false)
    setJdParsing(false)
    setJdError('')
    setJdText('')
    setJdFileName('')
    setMustHaves([])
    setNiceToHaves([])
    setSalaryRange('')
    setSalaryVisibility('hide')
    setFlexible([])
    setGreatVsOkay('')
    setDrafting(false)
    setSuggestions([])
    setSuggesting(false)
    setSuggestError('')
    setOwnSkill('')
    suggestedFor.current = ''
    setError('')
  }, [open, prefill])

  // Grow the title field to fit whatever the JD gave us.
  //
  // Measured three times, not once. The first pass runs before the
  // editorial webfont has swapped in, so a title that fits on one line in
  // the fallback face needs two in the real one — which is how
  // "Digital Marketing Specialist (SEO, Email & Social)" ended up clipped
  // after "Email &" even with a textarea doing the wrapping.
  const titleRef = useRef(null)
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    const fit = () => {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
    fit()
    let ro
    if (typeof ResizeObserver !== 'undefined' && el.parentElement) {
      ro = new ResizeObserver(fit)
      ro.observe(el.parentElement)
    }
    document.fonts?.ready?.then(fit).catch(() => {})
    return () => ro?.disconnect()
  }, [title, open])

  const subcategories = category ? JOB_CATEGORIES[category] || [] : []
  const unlimited = isUnlimited(roleLimit)
  const limit = unlimited ? Infinity : roleLimit
  const overLimit = !unlimited && currentCount >= limit
  /* Every role must name at least a few things to score on, however it
     was created. This used to read `!manualMode || ...`, so the minimum
     applied only to hand-typed roles. A job description that parsed to
     nothing - a scan, a vague listing, a parse that quietly failed - or
     one whose requirements the recruiter removed, produced a role with
     zero requirements. The questions were then written against a job
     title, every score had no requirement to quote, and nothing on
     screen ever said so. */
  const enoughCriteria = mustHaves.length >= MIN_CRITERIA
  const canSubmit = !!title.trim() && !saving && !overLimit && enoughCriteria

  /**
   * Hand the job description to /api/parse-jd and fill the form with
   * what comes back. Nothing is saved here: this is a proposal the
   * recruiter reviews, which is what makes it fair to score against
   * later — the criteria end up being theirs, not the model's.
   */
  async function parseJobDescription(file) {
    if (!file) return
    setJdParsing(true)
    setJdError('')
    try {
      const fd = new FormData()
      fd.append('jd', file)
      const res = await fetch('/api/parse-jd', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setJdError(data.error || 'Could not read that job description.')
        return
      }
      setJdFileName(file.name || 'job description')
      if (data.title) setTitle(data.title)
      if (data.summary) setDescription(data.summary)
      if (data.department) {
        // Only adopt a department we actually have a category for; a
        // free-text guess would render as a blank Select.
        const match = Object.keys(JOB_CATEGORIES).find(
          (c) => c.toLowerCase() === String(data.department).toLowerCase(),
        )
        if (match) { setCategory(match); setSubcategory('') }
      }
      if (data.employment_type) setEmploymentType(data.employment_type)
      if (data.experience_level) setExperienceLevel(data.experience_level)
      setMustHaves(Array.isArray(data.must_haves) ? data.must_haves : [])
      setNiceToHaves(Array.isArray(data.nice_to_haves) ? data.nice_to_haves : [])
      setSalaryRange(data.salary_range || '')
      setJdText(data.jd_text || '')
    } catch (err) {
      console.error('parse-jd threw:', err)
      setJdError('Could not read that job description. Please try again.')
    } finally {
      setJdParsing(false)
    }
  }

  function removeMustHave(i) {
    const gone = mustHaves[i]?.label
    setMustHaves((list) => list.filter((_, n) => n !== i))
    if (gone) setFlexible((list) => list.filter((l) => l !== gone))
  }
  /**
   * Ask for suggestions once the title has settled.
   *
   * Keyed on title + seniority because those are what change the answer:
   * an entry-level and a lead version of the same title should not get
   * the same list. Debounced so it does not fire on every keystroke, and
   * skipped when we have already asked for this exact combination.
   */
  const suggestRequirements = useCallback(async (force = false) => {
    const title_ = title.trim()
    if (title_.length < 3) return
    const key = `${title_}::${experienceLevel}`
    if (!force && suggestedFor.current === key) return
    suggestedFor.current = key
    setSuggesting(true)
    setSuggestError('')
    try {
      const res = await fetch('/api/suggest-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleTitle: title_,
          experienceLevel,
          employmentType,
          department: category,
          summary: description,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setSuggestError(data.error || 'Could not suggest anything for that title.')
        return
      }
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
    } catch (err) {
      console.error('suggest-requirements threw:', err)
      setSuggestError('Could not suggest anything for that title. Please try again.')
    } finally {
      setSuggesting(false)
    }
  }, [title, experienceLevel, employmentType, category, description])

  useEffect(() => {
    if (!open || !manualMode) return
    const t = setTimeout(() => suggestRequirements(), 900)
    return () => clearTimeout(t)
  }, [open, manualMode, suggestRequirements])

  /** Ticking a suggestion is what makes it a requirement. */
  function toggleSuggestion(label) {
    const on = mustHaves.some((m) => m.label === label)
    if (on) {
      setMustHaves((list) => list.filter((m) => m.label !== label))
      // Un-ticking a requirement has to drop it from "would you bend on
      // this", or the role saves a flexible_criteria entry pointing at a
      // requirement that no longer exists.
      setFlexible((f) => f.filter((l) => l !== label))
      return
    }
    if (mustHaves.length >= MAX_CRITERIA) return
    setMustHaves((list) => [...list, { label }])
  }

  function addOwnSkill() {
    const label = ownSkill.trim().slice(0, 80)
    if (label.length < 8) return
    if (mustHaves.some((m) => m.label.toLowerCase() === label.toLowerCase())) { setOwnSkill(''); return }
    if (mustHaves.length >= MAX_CRITERIA) return
    setMustHaves((list) => [...list, { label }])
    setOwnSkill('')
  }

  function toggleFlexible(label) {
    setFlexible((list) => list.includes(label) ? list.filter((l) => l !== label) : [...list, label])
  }
  function removeNiceToHave(i) { setNiceToHaves((list) => list.filter((_, n) => n !== i)) }

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
    /* Through the API, not straight into the table.
     *
     * A direct browser insert meant the plan's role limit was enforced by
     * a disabled button and nothing else — devtools, or curl with the
     * user's own token, created as many roles as you liked on any plan.
     * The server runs canCreateRole() before it writes anything. */
    const createRes = await fetch('/api/create-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        department: category
          ? (subcategory ? `${category} — ${subcategory}` : category)
          : null,
        employment_type: employmentType,
        experience_level: experienceLevel,
        // JD-first intake. Empty for a hand-typed role, which is fine:
        // question generation falls back to the old behaviour when there
        // are no confirmed criteria.
        jd_text: jdText || null,
        must_haves: mustHaves,
        nice_to_haves: niceToHaves,
        salary_range: salaryRange.trim() || null,
        salary_visibility: salaryVisibility,
        intake_confirmed_at: mustHaves.length ? new Date().toISOString() : null,
        flexible_criteria: flexible,
        great_vs_okay: greatVsOkay.trim() || null,
        calibrated_at: (flexible.length || greatVsOkay.trim()) ? new Date().toISOString() : null,
      }),
    })

    const createBody = await createRes.json().catch(() => ({}))
    if (!createRes.ok || !createBody?.id) {
      setSaving(false)
      setError(createBody?.error || 'Failed to create this role. Please try again.')
      return
    }
    const created = { id: createBody.id }

    // A role with no stage is a dead end — the recruiter lands on the
    // detail page and is told to add one before anything works. There is
    // exactly one sensible first stage, so make it.
    const { data: stage, error: stageError } = await supabase.from('stages').insert({
      role_id: created.id,
      name: 'Screening interview',
      level: STAGE_LEVEL[experienceLevel] || 'mid-level',
      position: 1,
    }).select('id').single()

    if (stageError || !stage) {
      // The role is real and saved. Send them to it rather than losing
      // the work over a stage insert; they can add one there.
      console.error('First stage insert failed:', stageError)
      setSaving(false)
      onCreated?.({ id: created.id, title: title.trim(), stageId: null })
      return
    }

    // Draft the questions before handing over, so the page they land on
    // is finished rather than empty with a button on it. A failure here
    // is not fatal: the stage exists and "Draft with AI" is right there.
    setDrafting(true)
    try {
      const res = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stageName: 'Screening interview',
          level: STAGE_LEVEL[experienceLevel] || 'mid-level',
          topics: null,
          roleTitle: title.trim(),
          mustHaves,
          flexible,
          greatVsOkay: greatVsOkay.trim() || null,
        }),
      })
      const result = await res.json().catch(() => ({}))
      const rows = []
      for (const g of result.groups || []) {
        ;(g.options || []).forEach((o, i) => {
          if (!o?.text) return
          rows.push({
            stage_id: stage.id,
            text: o.text,
            covers: o.covers || g.covers || null,
            approved: i === 0,
            source: 'ai',
          })
        })
      }
      if (rows.length) await supabase.from('questions').insert(rows)
      else console.error('Question drafting returned nothing usable:', result)
    } catch (err) {
      console.error('Question drafting threw:', err)
    } finally {
      setDrafting(false)
      setSaving(false)
    }

    onCreated?.({ id: created.id, title: title.trim(), stageId: stage.id })
  }

  /* Two states, not one long form.
   *
   * Before a JD is read this drawer asks for exactly one thing. After it
   * is read the drawer stops being a form and becomes a read-back: the
   * things Recrewt worked out, stated plainly, with the detail folded
   * away. A recruiter should be able to confirm a role in a glance,
   * not scroll a filled-in form checking somebody else's typing.
   */
  const parsed = !!jdFileName || manualMode

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="clamp(360px,48vw,560px)"
      title={prefill ? 'Duplicate role' : 'New role'}
      description={parsed
        ? 'Check this over. Everything here is editable.'
        : 'Recrewt reads the job description and sets the role up.'}
      dismissible={!saving}
      footer={parsed ? (
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            variant="primary"
            onClick={submit}
            loading={saving}
            disabled={!canSubmit}
            title={enoughCriteria ? undefined : `Choose at least ${MIN_CRITERIA} things to score on first.`}
          >
            {prefill
              ? 'Duplicate role'
              : drafting ? 'Drafting the questions…' : 'Create role and draft the questions'}
          </Button>
        </>
      ) : (
        <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
      )}
    >
      {!parsed ? (
        /* ── Nothing yet: one decision on the whole screen ────────── */
        <div className="py-6">
          <label
            className={
              'group relative flex flex-col items-center justify-center text-center ' +
              'min-h-[260px] px-8 rounded-[18px] cursor-pointer ' +
              'border border-dashed transition-colors duration-200 ' +
              (jdParsing
                ? 'border-[color:var(--color-rc-yellow)] bg-[color:var(--color-rc-soft)]'
                : 'border-[color:var(--color-rc-line)] bg-white hover:border-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]')
            }
          >
            <input
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              className="sr-only"
              disabled={jdParsing}
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                parseJobDescription(f)
              }}
            />
            {jdParsing ? (
              <>
                <Spinner />
                <p className="mt-4 text-[15px] font-medium text-[color:var(--color-rc-ink)]">
                  Reading the job description
                </p>
                <p className="mt-1 text-[13px] text-[color:var(--color-rc-muted)]">
                  About ten seconds.
                </p>
              </>
            ) : (
              <>
                <Upload size={22} className="text-[color:var(--color-rc-muted)]" aria-hidden="true" />
                <p
                  className="mt-4 text-[19px] leading-tight text-[color:var(--color-rc-ink)]"
                  style={{ fontFamily: 'var(--font-editorial), inherit' }}
                >
                  Drop the job description
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[34ch]">
                  PDF, Word or plain text. Recrewt pulls out the role, what it
                  needs, and drafts the questions.
                </p>
              </>
            )}
          </label>

          {jdError && (
            <p className="mt-4 text-[13px] text-[color:var(--color-rc-red)] bg-[rgb(199_75_58_/_0.06)] rounded px-3 py-2">
              {jdError}
            </p>
          )}

          <p className="mt-5 text-center text-[13px] text-[color:var(--color-rc-muted)]">
            No job description?{' '}
            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="text-[color:var(--color-rc-ink)] font-medium underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4"
            >
              Set it up yourself
            </button>
          </p>
        </div>
      ) : (
        /* ── Read-back: what Recrewt worked out ───────────────────── */
        <div>
          {/* A textarea, not an input, because real job titles run long —
              "Digital Marketing Specialist (SEO, Email & Social)" was
              clipped mid-word in a single-line field, so the recruiter
              could not see what they were confirming. */}
          <textarea
            ref={titleRef}
            rows={1}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Job title"
            aria-label="Job title"
            className="w-full block resize-none overflow-hidden bg-transparent text-[24px] leading-[1.2] tracking-[-0.01em] text-[color:var(--color-rc-ink)] placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-60 border-0 border-b border-transparent hover:border-[color:var(--color-rc-line)] focus:outline-none focus:border-[color:var(--color-rc-ink)] transition-colors py-1"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          />

          {description && (
            <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--color-rc-muted)]">
              {description}
            </p>
          )}

          {jdFileName && (
            <p className="mt-3 text-[12.5px] text-[color:var(--color-rc-muted)]">
              Read from {jdFileName}.{' '}
              <label className="cursor-pointer text-[color:var(--color-rc-ink)] font-medium underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4">
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  className="sr-only"
                  disabled={jdParsing || saving}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    e.target.value = ''
                    parseJobDescription(f)
                  }}
                />
                {jdParsing ? 'Reading…' : 'Use a different file'}
              </label>
            </p>
          )}

          {jdError && (
            <p className="mt-4 text-[13px] text-[color:var(--color-rc-red)] bg-[rgb(199_75_58_/_0.06)] rounded px-3 py-2">
              {jdError}
            </p>
          )}

          {/* The promise, then the thing it is a promise about.
              Criteria first and open: they are what the whole product
              does, and a recruiter who reads nothing else on this screen
              should read these. */}
          {(parsed || mustHaves.length > 0) && (
            <div className="mt-7 rounded-[16px] border border-[color:var(--color-rc-line)] bg-white p-4 md:p-5">
              <p
                className="text-[16px] leading-snug text-[color:var(--color-rc-ink)]"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                {manualMode || mustHaves.length < MIN_CRITERIA
                  ? 'Choose what every candidate is interviewed and scored on.'
                  : `Every candidate is interviewed and scored on these ${mustHaves.length} things.`}
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
                {manualMode
                  ? `Tick the ones that matter for this job. Pick at least ${MIN_CRITERIA}, up to ${MAX_CRITERIA}. Every score shows the answer that earned it, quoted against one of these.`
                  : mustHaves.length < MIN_CRITERIA
                    ? `We could not pull enough out of that document. Add what this job really requires — at least ${MIN_CRITERIA}. Without them the questions get written against the job title alone, and no score can show what earned it.`
                    : 'Each score shows the answer that earned it, quoted. Drop anything that is not really required — it only makes the ranking noisier.'}
              </p>

              {manualMode ? (
                <div className="mt-3.5">
                  {suggesting && suggestions.length === 0 && (
                    <div className="flex items-center gap-2.5 py-3">
                      <Spinner />
                      <span className="text-[13px] text-[color:var(--color-rc-muted)]">
                        Working out what matters for a {title.trim() || 'role'}…
                      </span>
                    </div>
                  )}

                  {!suggesting && suggestions.length === 0 && (
                    <p className="py-2 text-[13px] leading-relaxed text-[color:var(--color-rc-muted)]">
                      {title.trim().length < 3
                        ? 'Add a job title above and Recrewt will suggest what to score on.'
                        : suggestError || 'Nothing suggested yet.'}
                    </p>
                  )}

                  {suggestions.length > 0 && (
                    <ul className="grid gap-0.5">
                      {suggestions.map((label) => {
                        const on = mustHaves.some((m) => m.label === label)
                        const full = !on && mustHaves.length >= MAX_CRITERIA
                        return (
                          <li key={label}>
                            <label
                              className={
                                'flex items-start gap-3 px-2.5 py-2 rounded-[10px] transition-colors ' +
                                (full
                                  ? 'opacity-45 cursor-not-allowed'
                                  : 'cursor-pointer hover:bg-[color:var(--color-rc-soft)]')
                              }
                            >
                              <input
                                type="checkbox"
                                checked={on}
                                disabled={full}
                                onChange={() => toggleSuggestion(label)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[color:var(--color-rc-line-hover)] accent-[color:var(--color-rc-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
                              />
                              <span className="text-[13.5px] leading-relaxed text-[color:var(--color-rc-ink)]">
                                {label}
                              </span>
                            </label>
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {/* Anything they ticked that did not come from the list,
                      plus anything they typed. Shown separately so the
                      checkbox list stays the list we offered. */}
                  {mustHaves.filter((m) => !suggestions.includes(m.label)).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[color:var(--color-rc-line)]">
                      <CriteriaList
                        items={mustHaves.filter((m) => !suggestions.includes(m.label))}
                        onRemove={(i) => {
                          const own = mustHaves.filter((m) => !suggestions.includes(m.label))
                          const label = own[i]?.label
                          if (label) toggleSuggestion(label)
                        }}
                      />
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-[color:var(--color-rc-line)]">
                    <label htmlFor="own-skill" className="block text-[12.5px] text-[color:var(--color-rc-muted)]">
                      Something missing? Write it as a thing they have done, e.g.
                      &ldquo;has run month-end close for a client&rdquo;.
                    </label>
                    <div className="mt-2 flex items-start gap-2">
                      <input
                        id="own-skill"
                        type="text"
                        value={ownSkill}
                        maxLength={80}
                        disabled={mustHaves.length >= MAX_CRITERIA}
                        onChange={(e) => setOwnSkill(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOwnSkill() } }}
                        placeholder="Add your own"
                        className="flex-1 min-w-0 bg-white text-[color:var(--color-rc-ink)] border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3 py-2 text-[13.5px] transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] disabled:opacity-45"
                      />
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={addOwnSkill}
                        disabled={ownSkill.trim().length < 8 || mustHaves.length >= MAX_CRITERIA}
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[12.5px] tabular-nums text-[color:var(--color-rc-muted)]">
                      {mustHaves.length} of {MAX_CRITERIA} chosen
                      {mustHaves.length < MIN_CRITERIA ? ` · ${MIN_CRITERIA - mustHaves.length} more to go` : ''}
                    </p>
                    {suggestions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => suggestRequirements(true)}
                        disabled={suggesting}
                        className="text-[12.5px] text-[color:var(--color-rc-ink)] font-medium underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 disabled:opacity-50"
                      >
                        {suggesting ? 'Suggesting…' : 'Suggest a different set'}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3.5">
                  <CriteriaList items={mustHaves} onRemove={removeMustHave} />
                  {/* Remove-only was the whole bug: a document that parsed
                      to nothing left the recruiter with a card they could
                      not fill and a role they could still create. */}
                  {mustHaves.length < MIN_CRITERIA && (
                    <div className={mustHaves.length ? 'mt-3 pt-3 border-t border-[color:var(--color-rc-line)]' : ''}>
                      <label htmlFor="jd-own-skill" className="block text-[12.5px] text-[color:var(--color-rc-muted)]">
                        Write each one as a thing they have done, e.g.
                        &ldquo;has run month-end close for a client&rdquo;.
                      </label>
                      <div className="mt-2 flex items-start gap-2">
                        <input
                          id="jd-own-skill"
                          type="text"
                          value={ownSkill}
                          maxLength={80}
                          onChange={(e) => setOwnSkill(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOwnSkill() } }}
                          placeholder="Add a requirement"
                          className="flex-1 min-w-0 bg-white text-[color:var(--color-rc-ink)] border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3 py-2 text-[13.5px] transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)]"
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={addOwnSkill}
                          disabled={ownSkill.trim().length < 8}
                        >
                          Add
                        </Button>
                      </div>
                      <p className="mt-2 text-[12.5px] tabular-nums text-[color:var(--color-rc-muted)]">
                        {mustHaves.length} of {MIN_CRITERIA} needed
                        {` · ${MIN_CRITERIA - mustHaves.length} more to go`}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Question one: what would you actually bend on? Nothing to
                  bend on until something is chosen. */}
              <div className={'mt-5 pt-4 border-t border-[color:var(--color-rc-line)] ' + (mustHaves.length ? '' : 'hidden')}>
                <p className="text-[13px] font-medium text-[color:var(--color-rc-ink)]">
                  Would you bend on any of them?
                </p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
                  A job description lists everything as required. Tick the ones
                  you would still hire someone without, and they count for half.
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {mustHaves.map((c) => {
                    const on = flexible.includes(c.label)
                    return (
                      <button
                        key={c.label}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleFlexible(c.label)}
                        className={
                          'text-left text-[12.5px] leading-snug px-2.5 py-1.5 rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
                          (on
                            ? 'border-[color:var(--color-rc-ink)] bg-[color:var(--color-rc-ink)] text-white'
                            : 'border-[color:var(--color-rc-line)] text-[color:var(--color-rc-muted)] hover:border-[color:var(--color-rc-ink)] hover:text-[color:var(--color-rc-ink)]')
                        }
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Question two: the bar itself, in their words. */}
              <div className="mt-5 pt-4 border-t border-[color:var(--color-rc-line)]">
                <label
                  htmlFor="great-vs-okay"
                  className="block text-[13px] font-medium text-[color:var(--color-rc-ink)]"
                >
                  What separates a great one from an okay one?
                </label>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
                  One sentence in your own words. Candidates never see this — it
                  aims the questions at ground where the difference shows.
                </p>
                <textarea
                  id="great-vs-okay"
                  value={greatVsOkay}
                  onChange={(e) => setGreatVsOkay(e.target.value)}
                  rows={2}
                  placeholder="e.g. the good ones can say what they'd do differently, not just what they did"
                  className="mt-2.5 w-full block bg-white text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3.5 py-2.5 text-[14px] transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] resize-none"
                />
              </div>
            </div>
          )}

          {/* The four dropdowns, as one readable line until you need them. */}
          <Fold
            className="mt-7"
            summary={[
              experienceLevel && EXPERIENCE_WORD[experienceLevel],
              employmentType && EMPLOYMENT_WORD[employmentType],
              category || null,
            ].filter(Boolean).join('  ·  ') || 'Set the basics'}
            label="Basics"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <Select
                label="Experience"
                value={experienceLevel}
                onChange={(e) => setExperienceLevel(e.target.value)}
                options={[
                  { value: 'entry',  label: 'Entry level' },
                  { value: 'mid',    label: 'Mid level' },
                  { value: 'senior', label: 'Senior' },
                  { value: 'lead',   label: 'Lead' },
                ]}
              />
              <Select
                label="Employment"
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value)}
                options={[
                  { value: 'full-time', label: 'Full-time' },
                  { value: 'part-time', label: 'Part-time' },
                  { value: 'contract',  label: 'Contract' },
                ]}
              />
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
              <div className="sm:col-span-2">
                <label className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)]">
                  Summary
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="One line a recruiter would recognise as this role."
                  className="w-full block bg-white text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3.5 py-2.5 text-[14.5px] transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] resize-none"
                />
              </div>
            </div>
          </Fold>

          {niceToHaves.length > 0 && (
            <Fold
              summary={niceToHaves.map((c) => c.label).join('  ·  ')}
              label="Nice to have"
              defaultOpen={false}
            >
              <p className="pt-1 pb-3 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
                Noted on the candidate&rsquo;s profile, never scored.
              </p>
              <CriteriaList items={niceToHaves} onRemove={removeNiceToHave} />
            </Fold>
          )}

          <Fold
            summary={
              (salaryRange ? salaryRange : 'No range') +
              '  ·  ' + SALARY_WORD[salaryVisibility]
            }
            label="Pay"
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <TextField
                label="Range"
                placeholder="Not stated in the JD"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
              />
              <Select
                label="If a candidate asks"
                value={salaryVisibility}
                onChange={(e) => setSalaryVisibility(e.target.value)}
                options={[
                  { value: 'hide',  label: "Don't discuss it" },
                  { value: 'defer', label: 'Say it comes later' },
                  { value: 'show',  label: 'Tell them the range' },
                ]}
              />
            </div>
            <p className="pt-3 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
              Recrewt never volunteers pay. This only decides what it says when
              a candidate asks.
            </p>
          </Fold>

          {!enoughCriteria && title.trim() && (
            <p className="mt-5 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
              Pick at least {MIN_CRITERIA} things to score on before creating the role.
              Fewer than that and the questions get written against a job title
              instead of against this job.
            </p>
          )}

          {error && (
            <p className="mt-5 text-[13px] text-[color:var(--color-rc-red)] bg-[rgb(199_75_58_/_0.06)] rounded px-3 py-2">
              {error}
            </p>
          )}

          {/* The Free plan, not a trial — nothing is counting down. */}
          {plan === 'trial' && Number.isFinite(limit) && (
            <p className="mt-5 text-[12.5px] text-[color:var(--color-rc-muted)]">
              {Math.max(0, limit - currentCount)} of {limit} role slots on the Free plan. Interviewing candidates needs a paid plan.{' '}
              <Link href="/upgrade" className="text-[color:var(--color-rc-ink)] font-medium underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4">
                Upgrade &rarr;
              </Link>
            </p>
          )}
        </div>
      )}
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
    needsAttention: 0,
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
      const invitedCount     = r.invited.size
      const completedCount   = r.completed.size
      const waitingCount     = r.completedCandidates.filter((c) => awaitingDecision(c.status)).length
      // Verdict breakdown — surfaced on each row so recruiters see
      // the full pipeline shape without opening the role.
      const shortlistedCount = r.completedCandidates.filter((c) => c.status === 'shortlisted').length
      const onHoldCount      = r.completedCandidates.filter((c) => c.status === 'on-hold').length
      const rejectedCount    = r.completedCandidates.filter((c) => c.status === 'rejected').length
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
        invited:     invitedCount,
        completed:   completedCount,
        ongoing:     Math.max(invitedCount - completedCount, 0),
        waiting:     waitingCount,
        shortlisted: shortlistedCount,
        onHold:      onHoldCount,
        rejected:    rejectedCount,
      }
    })

    setRawRoles(rolesArr)

    // Global summary strip — active roles only (waiting/running are
    // meaningless once a role is paused/archived). "Needs attention"
    // counts roles that a recruiter should look at today — the same
    // priority buckets the sort surfaces first.
    const activeOnly = rolesArr.filter((r) => (r.status || 'active') === 'active')
    const needsAttentionCount = activeOnly.filter((r) => {
      const k = roleHealth(r).key
      return k === 'needs-review' || k === 'behind'
    }).length
    setTotals({
      interviewsRunning: activeOnly.reduce((n, r) => n + r.ongoing, 0),
      waiting:           activeOnly.reduce((n, r) => n + r.waiting, 0),
      totalCandidates:   activeOnly.reduce((n, r) => n + r.invited, 0),
      needsAttention:    needsAttentionCount,
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

  /**
   * A new role goes straight to its questions.
   *
   * Landing back on the roles list is the wrong place: the recruiter has
   * just described a job and the next thing they need is to look at the
   * questions it produced. Making them find the row, open it, find the
   * Interviews tab and press "Draft with AI" is four steps of hunting
   * for something we already did for them.
   *
   * Duplicates are the exception — nothing new was drafted, so the list
   * is where they belong.
   */
  function handleCreated(result) {
    const created = typeof result === 'string' ? { title: result } : (result || {})
    setDrawerOpen(false)
    const wasDuplicate = !!drawerPrefill
    setDrawerPrefill(null)
    if (created.id && !wasDuplicate) {
      router.push(`/roles/${created.id}?tab=interviews`)
      return
    }
    setMessage(`Role "${created.title || 'Untitled'}" created.`)
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
      // Priority sort — Needs Review first, then Behind Schedule,
      // then Healthy roles with in-progress work, then everything
      // else. Break ties inside each bucket on waiting count →
      // stale-ness → invited count so the noisiest role always
      // surfaces at the top of its band.
      arr.sort((a, b) => {
        const pa = healthPriority(a)
        const pb = healthPriority(b)
        if (pa !== pb) return pa - pb
        if (b.waiting !== a.waiting) return b.waiting - a.waiting
        const la = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0
        const lb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0
        // For Behind Schedule bucket, oldest activity is most urgent.
        if (healthPriority(a) === 1) return la - lb
        // Everywhere else, most recent activity comes first.
        if (la !== lb) return lb - la
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
  /* Counted against ACTIVE roles, matching getActiveRolesCount() on the
     server. This used to count every role including paused and archived
     ones, so a customer with 5 active and 5 archived was shown "5 of 10"
     on the subscription page and blocked from creating another here —
     two screens in the same product disagreeing about their own plan. */
  const slotsLeft = unlimited ? Infinity : Math.max(0, limit - activeRolesCount)
  const atLimit  = !unlimited && activeRolesCount >= limit
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
        <Toast kind="success" message={message} />
        <Toast kind="error" message={errorMsg} />

        {/* Header — compact application chrome. Title, description
            and Create-Role button sit on one baseline so the first
            role cards appear near the top of the viewport. */}
        <header className="mb-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <h1
              className="text-[26px] md:text-[28px] leading-[1.15] font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
              style={{ fontFamily: 'var(--font-editorial), inherit' }}
            >
              Roles
            </h1>
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
          <p className="mt-1.5 text-[14px] text-[color:var(--color-rc-muted)]">
            Manage all hiring roles across your organisation.
            {!loading && (pausedCount > 0 || archivedCount > 0) && (
              <span className="ml-2 text-[color:var(--color-rc-muted)]/80">
                · {pausedCount > 0 && `${pausedCount} paused`}
                {pausedCount > 0 && archivedCount > 0 && ' · '}
                {archivedCount > 0 && `${archivedCount} archived`}
              </span>
            )}
          </p>
          {showTrialHint && (
            <p className="mt-1.5 text-[13px] text-[color:var(--color-rc-muted)]">
              {slotsLeft} of {limit} role slots remaining.{' '}
              <Link href="/upgrade" className="text-[color:var(--color-rc-ink)] font-medium underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 hover:decoration-[3px]">
                Upgrade &rarr;
              </Link>
            </p>
          )}

          {!loading && (
            <SummaryStrip
              activeRoles={activeRolesCount}
              interviewsRunning={totals.interviewsRunning}
              waiting={totals.waiting}
              totalCandidates={totals.totalCandidates}
              needsAttention={totals.needsAttention}
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
            title="No roles yet"
            description="Create your first hiring role to begin interviewing candidates. Recrewt drafts tailored questions from the role description."
            action={
              <Button
                variant="primary"
                iconLeft={<Plus size={16} />}
                onClick={() => { setDrawerPrefill(null); setDrawerOpen(true) }}
              >
                Create Role
              </Button>
            }
          />
        ) : shownRoles === 0 ? (
          <EmptyState
            icon={<Search size={22} />}
            title={
              anyFilters
                ? 'No roles match these filters.'
                : status === 'archived'
                  ? "You haven't archived any roles yet."
                  : status === 'paused'
                    ? "You haven't paused any roles."
                    : 'No roles here yet.'
            }
            description={
              anyFilters
                ? 'The current search, status, or department filter is hiding every role. Widen the filters to see more.'
                : status === 'archived'
                  ? 'Roles archived from the overflow menu land here. Nothing has been archived so far.'
                  : status === 'paused'
                    ? 'Paused roles stop accepting new invites but keep every candidate. Pause a role from its overflow menu.'
                    : "You have roles but the current filter is showing zero. Switch to All to see them."
            }
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
          currentCount={activeRolesCount}
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
