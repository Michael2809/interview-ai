'use client'

import { memo, useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Search, X, ChevronRight, ChevronDown, Sparkles, MessageSquare, Calendar,
  MoreHorizontal, ArrowRight, Users, Briefcase, AlertTriangle, RefreshCw, CheckCircle2,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { writeReviewQueue, clearReviewQueue } from '@/components/AppShell/ReviewQueue'
import {
  Button, Select, Modal, EmptyState, Spinner, StatusDot, resolveStatus,
  Display, H2, Body, Caption, Eyebrow,
} from '@/components/ui'

/* ─────────────────────────────────────────────────────────────
 * Constants + helpers
 * ────────────────────────────────────────────────────────── */

const SESSION_KEY = 'recrewt:candidates:v6'

const QUICK_FILTERS = [
  { key: 'all',              label: 'All' },
  { key: 'needs-review',     label: 'Needs Review' },
  { key: 'interview-today',  label: 'Interview Today' },
  { key: 'awaiting',         label: 'Awaiting Feedback' },
  { key: 'shortlisted',      label: 'Shortlisted' },
  { key: 'offers',           label: 'Offers' },
  { key: 'rejected',         label: 'Rejected' },
  { key: 'archived',         label: 'Archived' },
]

const SORT_OPTIONS = [
  { value: 'newest',    label: 'Newest' },
  { value: 'oldest',    label: 'Oldest' },
  { value: 'score',     label: 'Highest score' },
  { value: 'needs',     label: 'Needs review' },
  { value: 'updated',   label: 'Recently updated' },
  { value: 'interview', label: 'Interview date' },
]

const HOUR = 60 * 60 * 1000
const DAY  = 24 * HOUR

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

/**
 * Meaningful, recruiter-flavoured time context. Not just "3d ago" —
 * "Applied 20 minutes ago" / "Waiting 4 days" / "Updated yesterday".
 * Prefers relative-day language ("yesterday", "tomorrow") when the
 * gap is small enough to make it more useful than a numeric span.
 */
function timeContext(row) {
  const now = Date.now()
  if (row.kind === 'completed') {
    const t = row.updatedAt || row.completedAt || row.scoredAt
    if (!t) return null
    if (row.awaiting) {
      const waitMs = now - new Date(row.completedAt || t).getTime()
      return `Waiting ${humanize(waitMs)}`
    }
    const delta = now - new Date(t).getTime()
    const yday = yesterdayLabel(delta)
    return yday ? `Updated ${yday}` : `Updated ${humanize(delta)} ago`
  }
  // ongoing / invited
  const t = row.invitedAt
  if (!t) return null
  const delta = now - new Date(t).getTime()
  const yday = yesterdayLabel(delta)
  return yday ? `Applied ${yday}` : `Applied ${humanize(delta)} ago`
}

/**
 * Returns a friendly relative-day label if the delta lands inside
 * one of the "day-precision" windows recruiters care about.
 */
function yesterdayLabel(deltaMs) {
  if (deltaMs == null) return null
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const past = Date.now() - deltaMs
  const yesterdayStart = new Date(dayStart); yesterdayStart.setDate(dayStart.getDate() - 1)
  if (past >= yesterdayStart.getTime() && past < dayStart.getTime()) return 'yesterday'
  return null
}

function humanize(ms) {
  if (ms == null || ms < 0) return 'just now'
  const s = ms / 1000
  if (s < 60)    return 'just now'
  if (s < 3600)  return `${Math.floor(s / 60)} minute${Math.floor(s / 60) === 1 ? '' : 's'} ago`.replace(' ago', '')
  if (s < DAY / 1000) {
    const h = Math.floor(s / 3600)
    return `${h} hour${h === 1 ? '' : 's'}`
  }
  const d = Math.floor(s / (DAY / 1000))
  if (d < 7)  return `${d} day${d === 1 ? '' : 's'}`
  if (d < 30) return `${Math.floor(d / 7)} week${Math.floor(d / 7) === 1 ? '' : 's'}`
  return `${Math.floor(d / 30)} month${Math.floor(d / 30) === 1 ? '' : 's'}`
}

/**
 * Score preview band → { pct, label }. Score arrives as 0-10;
 * we surface it as an integer percent + a short recruiter label.
 * Bands match the spec: 85+ Strong Match, 70+ Recommended,
 * 50+ Needs Review, else Below Bar.
 */
function scorePreview(score) {
  if (score == null || Number.isNaN(Number(score))) return null
  const pct = Math.round(Number(score) * 10)
  let label = 'Below Bar'
  if (pct >= 85) label = 'Strong Match'
  else if (pct >= 70) label = 'Recommended'
  else if (pct >= 50) label = 'Needs Review'
  return { pct, label }
}

/**
 * AI indicator — chooses the most useful label given the row's
 * signals. Returns null when there is no real AI signal to show,
 * so the row never surfaces decorative AI branding.
 */
function aiIndicator(row) {
  if (row.kind !== 'completed') return null
  if (row.score == null && !row.hasSummary) return null
  const pct = row.score != null ? Math.round(row.score * 10) : null
  if (pct != null && pct >= 85) return { icon: '⭐', label: 'Strong Recommendation' }
  if (pct != null && pct < 50)  return { icon: '⚠',  label: 'AI Concern' }
  if (row.hasSummary)           return { icon: '✨', label: 'AI Summary Ready' }
  if (pct != null)              return { icon: '🧠', label: 'Interview Analysed' }
  return null
}

function suggestedFromScore(score) {
  if (score == null) return 'awaiting-review'
  if (score >= 7)    return 'shortlisted'
  if (score >= 4)    return 'awaiting-review'
  return 'action-required'
}

/**
 * Map a unified row's DB status + activity to the shared StatusDot
 * enum. This is the single source of truth for what colour a
 * candidate reads as everywhere in the app.
 */
function statusForRow(row) {
  if (row.dbStatus === 'archived')      return 'archived'
  if (row.kind === 'completed') {
    if (row.dbStatus === 'shortlisted') return 'shortlisted'   // Offer-sent proxy
    if (row.dbStatus === 'rejected')    return 'rejected'
    if (row.dbStatus === 'on-hold')     return 'on-hold'
    if (row.awaiting)                   return 'awaiting-review'
    return 'complete'
  }
  if (row.kind === 'ongoing')  return 'in-progress'
  if (row.kind === 'invited')  return 'interview-scheduled'
  return 'complete'
}

/* ─────────────────────────────────────────────────────────────
 * Session helpers (persist filter/sort per user session)
 * ────────────────────────────────────────────────────────── */

function readSession() {
  if (typeof window === 'undefined') return { search: '', role: 'all', quick: 'all', sort: 'newest' }
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (raw) return { search: '', role: 'all', quick: 'all', sort: 'newest', ...JSON.parse(raw) }
  } catch {}
  return { search: '', role: 'all', quick: 'all', sort: 'newest' }
}
function writeSession(v) {
  if (typeof window === 'undefined') return
  try { window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(v)) } catch {}
}

/* ─────────────────────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────────────────── */

/** Quick-filter chip. Selected state is dark, non-selected is quiet. */
function QuickChip({ label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'inline-flex items-center gap-2 h-8 px-3 rounded-full text-[12.5px] font-medium ' +
        'transition-[background-color,color,border-color] duration-150 ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
        (active
          ? 'bg-[color:var(--color-rc-ink)] text-white'
          : 'bg-transparent text-[color:var(--color-rc-muted)] border border-[color:var(--color-rc-line)]/50 hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]/40 hover:border-[color:var(--color-rc-line)]')
      }
    >
      {label}
      {typeof count === 'number' && (
        <span className={
          'tabular-nums text-[11.5px] ' +
          (active ? 'text-white/70' : 'text-[color:var(--color-rc-muted)]/70')
        }>
          {count}
        </span>
      )}
    </button>
  )
}

/** Search input with instant filtering + clear affordance. */
function SearchField({ value, onChange, placeholder }) {
  return (
    <div className="relative flex-1 min-w-0">
      <Search
        size={14}
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-rc-muted)] pointer-events-none"
      />
      <input
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search name, email, or role'}
        aria-label="Search candidates"
        className={
          'w-full h-9 pl-9 pr-8 bg-white text-[13.5px] text-[color:var(--color-rc-ink)] ' +
          'border border-[color:var(--color-rc-line)] rounded-[8px] ' +
          'placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 ' +
          'transition-colors duration-150 ' +
          'hover:border-[color:var(--color-rc-line-hover)] ' +
          'focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)]'
        }
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 grid place-items-center rounded-[6px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
        >
          <X size={13} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

/**
 * RowMenu — the three-dot overflow menu for a candidate row.
 *
 * Renders the popover via a Portal into document.body so no parent
 * container (table `<ul>`, sticky headers, overflow-hidden cells)
 * can clip it. Position is computed from the anchor button's
 * bounding rect with viewport-edge collision detection: the menu
 * flips above the trigger when there isn't enough room below, and
 * shifts horizontally when it would clip either edge. Positions
 * update on scroll/resize so the menu stays anchored while the
 * page moves under it.
 *
 * Only surfaces *secondary* actions; the row's own Review / Schedule /
 * Email chips remain the way to do the primary work. Menu closes on:
 * outside click, Escape, or an action.
 */

const MENU_WIDTH = 220
const MENU_HEIGHT_ESTIMATE = 288    // 7 items × 32 + dividers + padding
const MENU_OFFSET = 10               // 8–12px spec offset
const VIEWPORT_PAD = 8               // never touch screen edges

function RowMenu({ row, onAction, anchorRef }) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'below' })
  const menuRef = useRef(null)
  const itemsRef = useRef([])

  useEffect(() => setMounted(true), [])

  // Position + collision detection. Runs once on open and again on
  // scroll (capture: true so scrolling *any* ancestor updates the
  // menu) and resize.
  useLayoutEffect(() => {
    if (!open || !anchorRef?.current) return
    function recompute() {
      const trigger = anchorRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const menuH = menuRef.current?.offsetHeight || MENU_HEIGHT_ESTIMATE
      const menuW = menuRef.current?.offsetWidth  || MENU_WIDTH

      // Prefer below the trigger, right-aligned.
      let top = rect.bottom + MENU_OFFSET
      let placement = 'below'
      // Flip above if there isn't room below.
      if (top + menuH > vh - VIEWPORT_PAD && rect.top - MENU_OFFSET - menuH >= VIEWPORT_PAD) {
        top = rect.top - MENU_OFFSET - menuH
        placement = 'above'
      }
      // Right-aligned: the menu's right edge matches the trigger's right edge.
      let left = rect.right - menuW
      // Horizontal collision — nudge in from either edge.
      if (left < VIEWPORT_PAD) left = VIEWPORT_PAD
      if (left + menuW > vw - VIEWPORT_PAD) left = vw - menuW - VIEWPORT_PAD

      setCoords({ top, left, placement })
    }
    recompute()
    window.addEventListener('scroll', recompute, true)
    window.addEventListener('resize', recompute)
    return () => {
      window.removeEventListener('scroll', recompute, true)
      window.removeEventListener('resize', recompute)
    }
  }, [open, anchorRef])

  // Close on outside click + Escape + arrow-key navigation.
  useEffect(() => {
    if (!open) return
    function onDoc(e) {
      if (menuRef.current?.contains(e.target)) return
      if (anchorRef?.current?.contains(e.target)) return
      setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); return }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const list = itemsRef.current.filter(Boolean)
        if (!list.length) return
        const active = document.activeElement
        const cur = list.indexOf(active)
        const dir = e.key === 'ArrowDown' ? 1 : -1
        const nextIdx = (cur < 0 ? 0 : cur + dir + list.length) % list.length
        list[nextIdx]?.focus()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    requestAnimationFrame(() => itemsRef.current.filter(Boolean)[0]?.focus())
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, anchorRef])

  function fire(action) {
    setOpen(false)
    onAction?.(action, row)
  }

  function registerItem(el, i) { itemsRef.current[i] = el }

  const canTranscript = row.kind === 'completed' && !!row.href

  // The popover — rendered outside every parent's stacking context.
  const popover = open && mounted ? createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Candidate actions"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: MENU_WIDTH,
        // z-index 60 sits above the 40-level sticky header and
        // 30-level bulk bar without competing with modals (which
        // manage their own overlays).
        zIndex: 60,
        transformOrigin: coords.placement === 'above' ? 'bottom right' : 'top right',
      }}
      className={
        'rounded-[12px] bg-white border border-[color:var(--color-rc-line)] py-1.5 ' +
        '[box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)] rc-menu-in'
      }
    >
      {/* Only surface actions that actually do something end-to-end.
          Move and Download Resume are omitted until they have real
          backends — a menu item that always says "coming soon" is
          worse than no menu item at all. Delete is completed-only
          because we can't yet delete an invitee row cleanly. */}
      <MenuItem i={0} refCb={registerItem} disabled={!canTranscript} onClick={() => fire('view')}>
        View Candidate
      </MenuItem>
      <MenuItem i={1} refCb={registerItem} disabled={!canTranscript} onClick={() => fire('open-new-tab')}>
        Open in New Tab
      </MenuItem>
      <MenuItem i={2} refCb={registerItem} disabled={!canTranscript} onClick={() => fire('copy-link')}>
        Copy Candidate Link
      </MenuItem>
      {row.dbStatus === 'archived' ? (
        <MenuItem i={3} refCb={registerItem} onClick={() => fire('restore')}>
          Restore Candidate
        </MenuItem>
      ) : (
        <MenuItem i={3} refCb={registerItem} disabled={row.kind !== 'completed'} onClick={() => fire('archive')}>
          Archive Candidate
        </MenuItem>
      )}
      {row.kind === 'completed' && (
        <>
          <div aria-hidden="true" className="my-1 h-px bg-[color:var(--color-rc-line)]" />
          <MenuItem i={4} refCb={registerItem} danger onClick={() => fire('delete')}>
            Delete Candidate
          </MenuItem>
        </>
      )}
    </div>,
    document.body,
  ) : null

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v) }}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center justify-center h-7 w-7 rounded-[6px] text-[color:var(--color-rc-muted)] bg-white border border-[color:var(--color-rc-line)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]/60 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <MoreHorizontal size={13} aria-hidden="true" />
      </button>
      {popover}
    </>
  )
}

function MenuItem({ children, onClick, danger, disabled, i, refCb }) {
  const cls = 'w-full text-left px-3 py-1.5 text-[13px] ' + (
    disabled
      ? ' text-[color:var(--color-rc-muted)]/60 cursor-not-allowed'
      : danger
      ? ' text-[color:var(--color-rc-red)] hover:bg-[color:var(--color-rc-soft)]'
      : ' text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]'
  ) + ' focus:outline-none focus-visible:bg-[color:var(--color-rc-soft)]'
  return (
    <button
      ref={(el) => refCb?.(el, i)}
      role="menuitem"
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cls}
    >
      {children}
    </button>
  )
}

/**
 * SelectAllCheckbox — tri-state header checkbox. Uses a ref to
 * drive the DOM `indeterminate` property since React doesn't
 * expose it as a JSX attribute.
 */
function SelectAllCheckbox({ checked, indeterminate, onChange, label }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked
  }, [indeterminate, checked])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={!!checked}
      onChange={onChange}
      className={
        'h-4 w-4 rounded-[4px] border border-[color:var(--color-rc-line)] ' +
        'accent-[color:var(--color-rc-ink)] cursor-pointer ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
      }
    />
  )
}

/**
 * ErrorCard — calm, editorial failure surface. Never leaks the raw
 * error message; classifies into a small set of user-recognisable
 * conditions so the copy is honest without being technical.
 */
function ErrorCard({ kind, onRetry }) {
  const spec = kind === 'network'
    ? {
        title: 'Network unavailable.',
        body:  "Your candidates couldn't be reached. Check your connection and try again — nothing has been lost.",
      }
    : kind === 'permission'
    ? {
        title: "You don't have access here.",
        body:  "Your session may have expired. Sign in again to see your pipeline.",
      }
    : {
        title: 'Something went wrong loading candidates.',
        body:  'We logged the details. Try again — if it keeps happening, we can look into it together.',
      }
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pt-6 border-t border-[color:var(--color-rc-line)]"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 h-8 w-8 rounded-full grid place-items-center bg-[color:var(--color-rc-soft)] text-[color:var(--color-rc-muted)]"
        >
          <AlertTriangle size={15} />
        </span>
        <div className="min-w-0">
          <H2>{spec.title}</H2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[54ch]">
            {spec.body}
          </p>
          <div className="mt-5">
            <Button variant="secondary" size="sm" onClick={onRetry} iconLeft={<RefreshCw size={14} />}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Unified chip primitives — every chip on the row shares these
 * dimensions (height, padding, radius, type) so alignment stays
 * pixel-perfect and the audit item stays satisfied.
 */
const CHIP_BASE =
  'inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[10.5px] uppercase ' +
  'tracking-[0.14em] font-semibold whitespace-nowrap tabular-nums'

/**
 * StatusChip — dot + label. Slightly brightens on group-hover so it
 * reinforces the row's live state.
 */
function StatusChip({ spec }) {
  return (
    <span
      className={
        CHIP_BASE + ' text-[color:var(--color-rc-muted)] ' +
        'group-hover:text-[color:var(--color-rc-ink)] transition-colors duration-150'
      }
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full transition-transform duration-150 group-hover:scale-[1.3]"
        style={{ backgroundColor: spec.color }}
      />
      {spec.label}
    </span>
  )
}

/**
 * ScorePreview — subtle triage aid. Shows "92% · Strong Match".
 * Same chip dimensions as StatusChip so columns stay aligned.
 * Returns null when no score is available.
 */
function ScorePreview({ score }) {
  const p = scorePreview(score)
  if (!p) return null
  return (
    <span
      className={CHIP_BASE + ' bg-[color:var(--color-rc-soft)] text-[color:var(--color-rc-muted)]'}
      title={`${p.pct}% · ${p.label}`}
    >
      <span className="text-[color:var(--color-rc-ink)]">{p.pct}%</span>
      <span className="opacity-50">·</span>
      {p.label}
    </span>
  )
}

/**
 * AIIndicator — small inline badge only when there's real AI signal.
 * Never shown for invited / ongoing rows (they have no AI output yet).
 */
function AIIndicator({ row }) {
  const ai = aiIndicator(row)
  if (!ai) return null
  return (
    <span
      className={CHIP_BASE + ' bg-[color:var(--color-rc-soft)] text-[color:var(--color-rc-muted)] normal-case tracking-normal text-[11.5px] font-medium px-2'}
      title={ai.label}
    >
      <span aria-hidden="true" className="text-[13px] leading-none">{ai.icon}</span>
      {ai.label}
    </span>
  )
}

/**
 * Candidate row — the enriched first-column anatomy.
 *
 *   [check] [dot] [Name + role · time + ai]              [score] [status] [chev]
 *
 * Row height unchanged. The identity block carries name + a single
 * secondary line that packs role, applied-time, and (when present)
 * the AI indicator so the recruiter reads the whole story left-to-right
 * without scanning columns. Right side carries the score preview and
 * status chip. Quick Actions fade over the score/status on hover.
 */
function CandidateRowImpl({ row, selected, onToggleSelect, onMessage, onMenuAction }) {
  const menuAnchorRef = useRef(null)
  // Note: every derivation here is cheap and depends only on `row`.
  // Because the component is wrapped in React.memo below with a
  // custom equality function, this body only re-runs when the row's
  // identity fields or the selected flag change — hovering, sorting,
  // or selecting a *different* row does not trigger a re-render here.
  const spec = resolveStatus(statusForRow(row))
  const time = timeContext(row)
  const rowHref = row.href
  const ai = aiIndicator(row)
  const displayName = row.name || row.email || 'Anonymous candidate'
  const secondary = (row.roleTitle || 'Unassigned role') + (time ? ` · ${time}` : '')
  const stopLink = (e) => { e.stopPropagation() }

  return (
    <li className="relative group">
      <Link
        href={rowHref || '#'}
        aria-label={`Open ${displayName}`}
        className={
          'grid grid-cols-[28px_10px_minmax(0,1fr)_auto_auto_18px] items-center gap-x-4 md:gap-x-5 ' +
          'py-3 px-3 -mx-3 rounded-[10px] cursor-pointer ' +
          'hover:bg-[color:var(--color-rc-soft)]/70 hover:-translate-y-[1px] ' +
          'transition-[background-color,transform] duration-150 ease-[cubic-bezier(.22,.61,.36,1)] ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
      >
        {/* Selection checkbox — inline so recruiters never leave the row */}
        <span
          onClick={(e) => { stopLink(e); e.preventDefault() }}
          className="flex items-center justify-center"
        >
          <input
            type="checkbox"
            aria-label={`Select ${displayName}`}
            checked={!!selected}
            onChange={() => onToggleSelect(row.id)}
            onClick={stopLink}
            className={
              'h-4 w-4 rounded-[4px] border border-[color:var(--color-rc-line)] ' +
              'accent-[color:var(--color-rc-ink)] cursor-pointer ' +
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
            }
          />
        </span>

        {/* Status dot — brightens on group-hover */}
        <span
          role="img"
          aria-label={spec.label}
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0 transition-transform duration-150 group-hover:scale-[1.35]"
          style={{ backgroundColor: spec.color }}
        />

        {/* Identity block — name on line 1, packed meta on line 2.
            title= on truncated text so long names/roles/emails are
            fully recoverable on hover. */}
        <div className="min-w-0">
          <div
            className="text-[14.5px] leading-tight font-semibold tracking-[-0.01em] text-[color:var(--color-rc-ink)] truncate"
            title={displayName}
          >
            {displayName}
          </div>
          <div className="mt-0.5 text-[12.5px] leading-[1.4] text-[color:var(--color-rc-muted)] flex items-center gap-1.5 min-w-0">
            <span className="truncate" title={secondary}>
              {secondary}
            </span>
            {ai && (
              <span
                className="hidden md:inline-flex items-center gap-1 shrink-0 text-[11.5px] text-[color:var(--color-rc-muted)] whitespace-nowrap"
                title={ai.label}
              >
                <span aria-hidden="true" className="text-[color:var(--color-rc-muted)]/50">·</span>
                <span aria-hidden="true">{ai.icon}</span>
                <span>{ai.label}</span>
              </span>
            )}
          </div>
        </div>

        {/* Score preview — subtle triage aid (only when scored) */}
        <span className="hidden lg:inline-flex">
          <ScorePreview score={row.score} />
        </span>

        {/* Status chip — never colour-only, fades out as Quick Actions fade in */}
        <span className="hidden md:inline-flex group-hover:opacity-0 group-focus-within:opacity-0 transition-opacity duration-150">
          <StatusChip spec={spec} />
        </span>

        {/* Chevron — fades in on hover */}
        <ChevronRight
          size={15}
          aria-hidden="true"
          className="text-[color:var(--color-rc-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 transition-[opacity,transform] duration-150"
        />
      </Link>

      {/* Quick-Actions overlay — floats over the status chip on hover.
          Only Email (a real mailto) and the overflow menu remain.
          Schedule was removed because it navigated to the role page
          instead of actually scheduling; sequential review lives on
          Candidate Details. The whole row is still a Link. */}
      <div
        role="group"
        aria-label="Quick actions"
        className={
          'pointer-events-none group-hover:pointer-events-auto ' +
          'absolute right-9 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-1 ' +
          'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ' +
          'transition-opacity duration-150'
        }
      >
        <button
          type="button"
          onClick={(e) => { stopLink(e); onMessage?.(row) }}
          className="inline-flex items-center h-7 px-2 rounded-[6px] text-[11.5px] font-medium text-[color:var(--color-rc-muted)] bg-white border border-[color:var(--color-rc-line)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]/60 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
        >
          Email
        </button>
        <span onClick={stopLink} className="relative">
          <RowMenu row={row} onAction={onMenuAction} anchorRef={menuAnchorRef} />
        </span>
      </div>
    </li>
  )
}

/**
 * Custom shallow-equality for the row.
 *
 * We only care about row identity, the selected flag, and the two
 * callback references — which are memoized upstream via useCallback.
 * Comparing scalar fields on `row` directly avoids deep equality
 * and lets React skip re-rendering unrelated rows on every state
 * change (hover of another row, filter change that keeps this row,
 * etc.).
 */
const CandidateRow = memo(CandidateRowImpl, (prev, next) => {
  if (prev.selected !== next.selected) return false
  if (prev.onToggleSelect !== next.onToggleSelect) return false
  if (prev.onMessage !== next.onMessage) return false
  if (prev.onMenuAction !== next.onMenuAction) return false
  const a = prev.row, b = next.row
  return (
    a === b || (
      a.id === b.id &&
      a.name === b.name &&
      a.email === b.email &&
      a.roleTitle === b.roleTitle &&
      a.stageName === b.stageName &&
      a.dbStatus === b.dbStatus &&
      a.score === b.score &&
      a.awaiting === b.awaiting &&
      a.hasSummary === b.hasSummary &&
      a.completedAt === b.completedAt &&
      a.updatedAt === b.updatedAt &&
      a.invitedAt === b.invitedAt &&
      a.kind === b.kind &&
      a.href === b.href &&
      a.roleHref === b.roleHref
    )
  )
})

/**
 * Sticky bulk-action bar — appears when at least one row is selected.
 * Selection count is set apart with a small warm-yellow badge so it
 * reads first. Primary action ("Move stage") is a filled warm-yellow
 * button so it's visually strongest; secondary actions are ghost
 * text buttons; danger actions live at the far right past a divider
 * so recruiters never fat-finger them.
 */
function BulkActionBar({ count, onClear, onAction, disabled }) {
  if (count <= 0) return null
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className={
        'fixed z-30 left-1/2 -translate-x-1/2 bottom-6 ' +
        'flex items-center gap-1 h-12 pl-2 pr-1.5 rounded-[14px] ' +
        'bg-[color:var(--color-rc-ink)] text-white ' +
        '[box-shadow:0_24px_48px_-20px_rgba(17,17,17,0.4)] ' +
        'rc-bulk-bar-in whitespace-nowrap ' +
        (disabled ? 'opacity-70 pointer-events-none' : '')
      }
    >
      {/* Selection count — prominent yellow pill */}
      <span
        className="inline-flex items-center gap-1.5 h-8 pl-2 pr-2.5 rounded-[10px] bg-[color:var(--color-rc-yellow)] text-[color:var(--color-rc-ink)] mr-1"
      >
        <span className="text-[13px] font-semibold tabular-nums">{count}</span>
        <span className="text-[11px] uppercase tracking-[0.14em] font-semibold">
          selected
        </span>
      </span>

      {/* Only actions with real end-to-end implementations. Delete and
          Archive route through per-row logic scaled across the whole
          selection. Move / Reject / Schedule / Compare / Export ship
          when their per-row versions exist. */}
      <BulkBtn primary onClick={() => onAction('archive')}>Archive</BulkBtn>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
      <BulkBtn onClick={() => onAction('delete')} danger>Delete</BulkBtn>

      <button
        type="button"
        onClick={onClear}
        aria-label="Clear selection"
        className="ml-1 h-8 w-8 grid place-items-center rounded-[10px] text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}

function BulkBtn({ children, onClick, primary, danger }) {
  const base =
    'inline-flex items-center h-8 px-3 rounded-[10px] text-[12.5px] font-medium ' +
    'transition-colors duration-150 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
  const tone = primary
    ? ' bg-white text-[color:var(--color-rc-ink)] hover:bg-white/90'
    : danger
    ? ' text-[color:#FFB4A6] hover:text-white hover:bg-white/10'
    : ' text-white/85 hover:text-white hover:bg-white/10'
  return (
    <button type="button" onClick={onClick} className={base + tone}>
      {children}
    </button>
  )
}

/**
 * Skeleton row — matches the CandidateRow grid exactly so loading
 * reads as the list assembling itself, not a generic placeholder card.
 *
 * Placeholders (spec order): avatar-substitute (the checkbox+dot
 * cluster), name, role, timestamp, score chip, status chip.
 * Widths vary per row so the skeleton feels like real data, not a
 * uniform bar.
 */
const SKELETON_WIDTHS = [
  { name: 'w-40', role: 'w-56', ts: 'w-24' },
  { name: 'w-32', role: 'w-64', ts: 'w-20' },
  { name: 'w-48', role: 'w-52', ts: 'w-28' },
  { name: 'w-36', role: 'w-60', ts: 'w-16' },
  { name: 'w-44', role: 'w-48', ts: 'w-24' },
  { name: 'w-40', role: 'w-56', ts: 'w-20' },
]

function SkeletonRow({ i = 0 }) {
  const w = SKELETON_WIDTHS[i % SKELETON_WIDTHS.length]
  return (
    <li
      aria-hidden="true"
      className="grid grid-cols-[28px_10px_minmax(0,1fr)_auto_auto_18px] items-center gap-x-4 md:gap-x-5 py-3 px-3 rc-skeleton"
    >
      {/* Avatar-substitute: the checkbox slot */}
      <span className="h-4 w-4 rounded-[4px] bg-[color:var(--color-rc-soft)] justify-self-center" />
      {/* Status dot slot */}
      <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-soft)]" />
      {/* Name + role · timestamp */}
      <div className="min-w-0">
        <div className={`h-3.5 rounded bg-[color:var(--color-rc-soft)] ${w.name}`} />
        <div className="mt-2 flex items-center gap-2">
          <div className={`h-2.5 rounded bg-[color:var(--color-rc-soft)] ${w.role}`} />
          <div className={`h-2.5 rounded bg-[color:var(--color-rc-soft)]/70 ${w.ts} hidden sm:block`} />
        </div>
      </div>
      {/* Score chip */}
      <div className="h-6 w-28 rounded-full bg-[color:var(--color-rc-soft)] hidden lg:block" />
      {/* Status chip */}
      <div className="h-6 w-28 rounded-full bg-[color:var(--color-rc-soft)] hidden md:block" />
      {/* Chevron slot */}
      <div className="h-3 w-3 rounded bg-[color:var(--color-rc-soft)]/70" />
    </li>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Main page
 * ────────────────────────────────────────────────────────── */

export default function CandidatesPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)   // null | 'network' | 'permission' | 'unknown'
  const initial = readSession()
  const [search, setSearch] = useState(initial.search)
  const [role, setRole] = useState(initial.role)
  const [quick, setQuick] = useState(initial.quick)
  const [sort, setSort] = useState(initial.sort)
  const [selected, setSelected] = useState(() => new Set())

  const [rows, setRows] = useState([])         // unified row list
  const [roleList, setRoleList] = useState([])

  // Persist filters/sort (not selection)
  useEffect(() => { writeSession({ search, role, quick, sort }) }, [search, role, quick, sort])

  // Persist the current filtered queue so opening a transcript
  // preserves filter/search/sort order across Prev/Next navigation.
  // Only completed rows have transcript URLs, so we filter to those.

  // Deep-link support: quick filter + role
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const q = params.get('quick') || params.get('filter')
    if (q && QUICK_FILTERS.some((f) => f.key === q)) setQuick(q)
    const r = params.get('role')
    if (r) setRole(r)
    const term = params.get('q')
    if (term) setSearch(term)
    // Back-compat: legacy verdict param maps to quick chip
    const v = params.get('verdict')
    if (v === 'shortlisted') setQuick('shortlisted')
    if (v === 'rejected')    setQuick('rejected')
    if (v === 'pending')     setQuick('needs-review')
  }, [])

  // Reflect quick filter in URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    url.searchParams.set('quick', quick)
    window.history.replaceState({}, '', url.toString())
  }, [quick])

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    let rolesRes, stagesRes, interviewsRes, scoresRes
    try {
      [rolesRes, stagesRes, interviewsRes, scoresRes] = await Promise.all([
        supabase.from('roles').select('id, title'),
        supabase.from('stages').select('id, role_id, name'),
        supabase.from('interviews').select('stage_id, speaker, candidate_name, candidate_email, invited_at, created_at'),
        supabase.from('scores').select('candidate_name, score, status, stage_id, created_at, summary'),
      ])
    } catch (err) {
      // Network layer failure — `fetch` never left the machine.
      // We never leak the raw error to the UI; a friendly card
      // with a retry lands instead.
      const isNetwork = err instanceof TypeError && /failed to fetch/i.test(err.message || '')
      if (isNetwork) {
        console.warn('Candidates: network unavailable')
        setLoadError('network')
      } else {
        console.error('Candidates load error:', err)
        setLoadError('unknown')
      }
      setLoading(false)
      return
    }

    // Supabase surfaces auth/RLS errors on each response rather than
    // throwing. Detect the first non-transport error and classify it.
    const supErr = (rolesRes.error || stagesRes.error || interviewsRes.error || scoresRes.error)
    if (supErr) {
      console.error('Candidates supabase error:', supErr)
      // 42501 = insufficient privilege (RLS); PGRST301 = JWT missing/expired
      if (supErr.code === '42501' || supErr.code === 'PGRST301') setLoadError('permission')
      else setLoadError('unknown')
      setLoading(false)
      return
    }

    const roles = rolesRes.data || []
    const stages = stagesRes.data || []
    const interviews = interviewsRes.data || []
    const scores = scoresRes.data || []

    const stageInfo = {}
    stages.forEach((s) => {
      const roleRow = roles.find((r) => r.id === s.role_id)
      stageInfo[s.id] = {
        name: s.name || 'Untitled stage',
        roleTitle: roleRow?.title || 'Unassigned role',
        roleId: roleRow?.id,
      }
    })

    const scoresByKey = {}
    scores.forEach((s) => {
      const k = `${s.stage_id}|${(s.candidate_name || '').toLowerCase()}`
      scoresByKey[k] = {
        score: s.score,
        status: s.status,
        createdAt: s.created_at,
        hasSummary: !!s.summary,
      }
    })

    // ── Invites (superset of ongoing) ───────────────────────
    const inviteMap = new Map()
    interviews
      .filter((r) => r.speaker === 'invite' && r.candidate_email)
      .forEach((r) => {
        const key = `${r.candidate_email.toLowerCase()}|${r.stage_id}`
        const existing = inviteMap.get(key)
        if (!existing || new Date(r.invited_at || 0) > new Date(existing.invited_at || 0)) {
          const info = stageInfo[r.stage_id] || {}
          inviteMap.set(key, {
            email: r.candidate_email,
            stage_id: r.stage_id,
            stageName: info.name || 'Unknown stage',
            roleTitle: info.roleTitle || 'Unassigned role',
            roleId: info.roleId,
            invited_at: r.invited_at,
          })
        }
      })

    // ── Completed candidates ────────────────────────────────
    const contentSpeakers = new Set(['invite', 'audio', 'video', 'analysis', 'session_start'])
    const answerRows = interviews.filter(
      (r) => !contentSpeakers.has(r.speaker) && r.candidate_name,
    )
    const compMap = new Map()
    answerRows.forEach((r) => {
      const key = `${r.stage_id}|${(r.candidate_name || '').toLowerCase()}`
      const existing = compMap.get(key)
      if (!existing) {
        const info = stageInfo[r.stage_id] || {}
        compMap.set(key, {
          candidate_name: r.candidate_name,
          stage_id: r.stage_id,
          stageName: info.name || 'Unknown stage',
          roleTitle: info.roleTitle || 'Unassigned role',
          roleId: info.roleId,
          firstAt: r.created_at,
          latest: r.created_at,
        })
      } else if (new Date(r.created_at) > new Date(existing.latest)) {
        existing.latest = r.created_at
      }
    })

    // Which invites have already produced a completed session?
    const finishedByStage = new Set(
      answerRows.map((r) => `${r.stage_id}|${(r.candidate_name || '').toLowerCase()}`),
    )

    // ── Unified row list ────────────────────────────────────
    const unified = []

    for (const c of compMap.values()) {
      const key = `${c.stage_id}|${(c.candidate_name || '').toLowerCase()}`
      const s = scoresByKey[key] || {}
      const awaiting = s.score != null && (!s.status || s.status === '')
      unified.push({
        id: 'c:' + key,
        kind: 'completed',
        name: c.candidate_name,
        email: null,
        roleTitle: c.roleTitle,
        stageName: c.stageName,
        stageId: c.stage_id,
        roleId: c.roleId,
        dbStatus: s.status || null,
        score: s.score,
        completedAt: c.latest,
        scoredAt: s.createdAt,
        updatedAt: s.createdAt || c.latest,
        invitedAt: null,
        awaiting,
        // Structured signals — the AI indicator + score preview are
        // derived at render time from these fields.
        hasSummary: !!s.hasSummary,
        href: `/interview/${c.stage_id}/transcript?candidate=${encodeURIComponent(c.candidate_name || '')}`,
        roleHref: c.roleId ? `/roles/${c.roleId}` : null,
      })
    }

    for (const c of inviteMap.values()) {
      // If this invite has produced a session, skip — the completed row covers it.
      const prefix = c.email.split('@')[0].toLowerCase()
      const covered = Array.from(finishedByStage).some((k) => {
        const [sid, nm] = k.split('|')
        return String(sid) === String(c.stage_id) && (nm === prefix || nm === c.email.toLowerCase())
      })
      if (covered) continue
      const ageMs = c.invited_at ? Date.now() - new Date(c.invited_at).getTime() : Infinity
      // Anything older than 3 days without a session → in-progress (stale).
      // Fresher invites read as "interview scheduled".
      unified.push({
        id: 'i:' + c.email + '|' + c.stage_id,
        kind: ageMs > 3 * DAY ? 'ongoing' : 'invited',
        name: c.email,
        email: c.email,
        roleTitle: c.roleTitle,
        stageName: c.stageName,
        stageId: c.stage_id,
        roleId: c.roleId,
        dbStatus: null,
        score: null,
        invitedAt: c.invited_at,
        updatedAt: c.invited_at,
        awaiting: false,
        hasSummary: false,
        href: c.roleId ? `/roles/${c.roleId}` : null,
        roleHref: c.roleId ? `/roles/${c.roleId}` : null,
      })
    }

    setRows(unified)
    setRoleList([...new Set(unified.map((r) => r.roleTitle))].sort())
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  /* ── Derived: counts per quick filter ───────────── */

  const counts = useMemo(() => {
    const c = {
      all: 0, 'needs-review': 0, 'interview-today': 0, awaiting: 0,
      shortlisted: 0, offers: 0, rejected: 0, archived: 0,
    }
    const today = new Date(); today.setHours(0, 0, 0, 0)
    for (const r of rows) {
      // Archived rows only count toward the Archived chip. Every other
      // chip — including "All" — excludes them so recruiters see a
      // clean active-pipeline view by default.
      if (r.dbStatus === 'archived') { c.archived++; continue }
      c.all++
      if (r.kind === 'completed' && r.awaiting) c['needs-review']++
      if (r.kind === 'invited'   && r.invitedAt && new Date(r.invitedAt) >= today) c['interview-today']++
      if (r.kind === 'ongoing')  c.awaiting++
      if (r.dbStatus === 'shortlisted') { c.shortlisted++; c.offers++ }
      if (r.dbStatus === 'rejected') c.rejected++
    }
    return c
  }, [rows])

  /* ── Derived: filtered + sorted list ─────────────── */

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const today = new Date(); today.setHours(0, 0, 0, 0)
    let out = rows.filter((r) => {
      // Archived rows are only visible on the Archived chip.
      const isArchived = r.dbStatus === 'archived'
      if (quick === 'archived' && !isArchived) return false
      if (quick !== 'archived' && isArchived)  return false

      if (role !== 'all' && r.roleTitle !== role) return false
      if (term) {
        const hay = [r.name, r.email, r.roleTitle, r.stageName].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(term)) return false
      }
      switch (quick) {
        case 'all': return true
        case 'needs-review':     return r.kind === 'completed' && r.awaiting
        case 'interview-today':  return r.kind === 'invited'   && r.invitedAt && new Date(r.invitedAt) >= today
        case 'awaiting':         return r.kind === 'ongoing'
        case 'shortlisted':      return r.dbStatus === 'shortlisted'
        case 'offers':           return r.dbStatus === 'shortlisted'
        case 'rejected':         return r.dbStatus === 'rejected'
        case 'archived':         return true
        default:                 return true
      }
    })
    out.sort((a, b) => {
      const ta = new Date(a.updatedAt || a.invitedAt || 0).getTime()
      const tb = new Date(b.updatedAt || b.invitedAt || 0).getTime()
      switch (sort) {
        case 'oldest':    return ta - tb
        case 'score':     return (b.score ?? -Infinity) - (a.score ?? -Infinity)
        case 'needs':     return Number(!!b.awaiting) - Number(!!a.awaiting) || tb - ta
        case 'updated':   return tb - ta
        case 'interview': return new Date(b.invitedAt || 0) - new Date(a.invitedAt || 0)
        case 'newest':
        default:          return tb - ta
      }
    })
    return out
  }, [rows, role, quick, search, sort])

  // Clear selection whenever the visible list changes. Otherwise the
  // "N selected" count on the bulk bar counts rows that aren't
  // currently visible, which is confusing and error-prone.
  useEffect(() => {
    setSelected(new Set())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quick, role, search])

  // Whenever the visible/sorted list changes, mirror the reviewable
  // subset (completed candidates) to sessionStorage so the transcript
  // page's QueueNav can page through it without leaving the flow.
  useEffect(() => {
    const items = filtered
      .filter((r) => r.kind === 'completed' && r.href)
      .map((r) => ({
        stageId: r.stageId,
        candidateName: r.name,
        href: r.href,
      }))
    if (items.length > 0) writeReviewQueue(items)
    else                  clearReviewQueue()
  }, [filtered])

  /* ── Selection ───────────────────────────────────── */

  const toggleSelect = useCallback((id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }, [])
  const clearSelection = useCallback(() => setSelected(new Set()), [])

  // Escape clears any active bulk selection — no keyboard trap.
  useEffect(() => {
    if (selected.size === 0) return
    function onKey(e) {
      const inEditable = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      )
      if (e.key === 'Escape' && !inEditable) {
        e.preventDefault()
        clearSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected.size, clearSelection])

  const filteredIds = useMemo(() => filtered.map((r) => r.id), [filtered])
  const selectedInFiltered = useMemo(
    () => filteredIds.reduce((acc, id) => acc + (selected.has(id) ? 1 : 0), 0),
    [filteredIds, selected],
  )
  const allSelected = filteredIds.length > 0 && selectedInFiltered === filteredIds.length
  const someSelected = selectedInFiltered > 0 && !allSelected

  const toggleSelectAll = useCallback(() => {
    setSelected((prev) => {
      if (filteredIds.length === 0) return prev
      const allCurrentlyIn = filteredIds.every((id) => prev.has(id))
      if (allCurrentlyIn) {
        // Deselect just the currently-visible ones; preserve other selections.
        const next = new Set(prev)
        filteredIds.forEach((id) => next.delete(id))
        return next
      }
      const next = new Set(prev)
      filteredIds.forEach((id) => next.add(id))
      return next
    })
  }, [filteredIds])

  // Toast primitive — single { tone, message } state so every
  // candidate-page interaction speaks the same visual language.
  //   toast.tone === 'success' → green ✓
  //   toast.tone === 'error'   → red ✱
  // The message text itself is *always* human-friendly. Raw backend
  // errors are logged to the console via console.warn / console.error
  // by the calling code and NEVER surfaced here.
  const [toast, setToast] = useState({ tone: 'success', message: '' })
  useEffect(() => {
    if (!toast.message) return
    const t = setTimeout(() => setToast((prev) => ({ ...prev, message: '' })), 2400)
    return () => clearTimeout(t)
  }, [toast.message])
  const flashSuccess = useCallback((message) => setToast({ tone: 'success', message }), [])
  const flashError   = useCallback((message) => setToast({ tone: 'error',   message }), [])

  const handleMessage = useCallback((row) => {
    if (row.email) {
      window.location.href = `mailto:${row.email}`
    } else {
      flashError('This candidate has no email on file.')
    }
  }, [flashError])

  /* ── Row menu actions ─────────────────────────────── */

  const [pendingDelete, setPendingDelete] = useState(null) // row to delete
  const [deleting,      setDeleting]      = useState(false)
  // Rows currently being archived/restored — used to guard against
  // duplicate submissions if a recruiter double-clicks the menu.
  const [archivingIds,  setArchivingIds]  = useState(() => new Set())

  const archiveOrRestore = useCallback(async (row, nextStatus) => {
    if (!row || archivingIds.has(row.id)) return
    // Invitees don't yet have a score row to flip; the archive
    // concept only applies to completed interviews. Give recruiters
    // a friendly explanation rather than a broken DB call.
    if (row.kind !== 'completed') {
      flashError('Only completed candidates can be archived.')
      return
    }
    setArchivingIds((prev) => { const n = new Set(prev); n.add(row.id); return n })
    // Optimistic update — flip the dbStatus locally so the row
    // disappears from the active view (or reappears on restore)
    // immediately. If the DB write fails, we roll back and toast.
    const prevStatus = row.dbStatus
    setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, dbStatus: nextStatus } : r))
    try {
      const { error } = await supabase
        .from('scores')
        .update({ status: nextStatus })
        .eq('stage_id', String(row.stageId))
        .eq('candidate_name', row.name)
      if (error) throw error
      flashSuccess(nextStatus === 'archived' ? 'Candidate archived.' : 'Candidate restored.')
    } catch (err) {
      // Roll back the optimistic update.
      setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, dbStatus: prevStatus } : r))
      // Log the real error internally — never surface it.
      console.error('Candidate archive/restore error:', err)
      flashError(
        nextStatus === 'archived'
          ? 'Unable to archive the candidate. Please try again.'
          : 'Unable to restore the candidate. Please try again.'
      )
    } finally {
      setArchivingIds((prev) => { const n = new Set(prev); n.delete(row.id); return n })
    }
  }, [archivingIds, supabase, flashSuccess, flashError])

  const handleMenuAction = useCallback((action, row) => {
    switch (action) {
      case 'view':
        if (row.href) window.location.href = row.href
        return
      case 'open-new-tab':
        if (row.href) window.open(row.href, '_blank', 'noopener,noreferrer')
        return
      case 'copy-link': {
        if (!row.href) { flashError('There’s nothing to link to yet.'); return }
        const url = new URL(row.href, window.location.origin).href
        try {
          navigator.clipboard.writeText(url).then(
            () => flashSuccess('Link copied.'),
            (err) => { console.warn('Copy failed:', err); flashError('Unable to copy the link. Try again.') },
          )
        } catch (err) {
          console.warn('Copy failed:', err)
          flashError('Unable to copy the link. Try again.')
        }
        return
      }
      case 'archive':
      case 'restore':
        // Async worker; errors surface as toasts only.
        archiveOrRestore(row, action === 'archive' ? 'archived' : null)
        return
      case 'delete':
        setPendingDelete(row)
        return
      default:
        return
    }
  }, [archiveOrRestore, flashSuccess, flashError])

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      // Only completed rows have a score row we can delete cleanly.
      // Ongoing/invited rows don't have a delete target today, so we
      // surface an honest toast instead.
      if (pendingDelete.kind === 'completed') {
        const { error } = await supabase
          .from('scores')
          .delete()
          .eq('stage_id', String(pendingDelete.stageId))
          .eq('candidate_name', pendingDelete.name)
        if (error) throw error
        setRows((prev) => prev.filter((r) => r.id !== pendingDelete.id))
        flashSuccess('Candidate deleted.')
      } else {
        flashSuccess('Removing invitees is coming soon.')
      }
    } catch (err) {
      // Log the real error internally so we can debug — never expose
      // the DB / SQL / migration text to the recruiter.
      console.error('Candidate delete error:', err)
      flashError('Unable to delete the candidate. Please try again.')
    } finally {
      setDeleting(false)
      setPendingDelete(null)
    }
  }, [pendingDelete, supabase, flashSuccess, flashError])

  const [bulkPending, setBulkPending] = useState(null) // 'archive' | 'delete' | null
  const [bulkRunning, setBulkRunning] = useState(false)

  const handleBulk = useCallback((action) => {
    // Only surface actions that actually execute end-to-end. Bulk
    // Move / Reject / Schedule / Compare / Export ship when their
    // per-row versions ship — never as fake toasts.
    if (action === 'archive' || action === 'delete') {
      setBulkPending(action)
      return
    }
  }, [])

  const runBulk = useCallback(async () => {
    if (!bulkPending || selected.size === 0) return
    // Snapshot the current selection scoped to visible/completed rows.
    const ids = Array.from(selected)
    const targets = rows.filter((r) => ids.includes(r.id) && r.kind === 'completed')
    if (targets.length === 0) {
      setBulkPending(null)
      flashError('None of the selected candidates support this action yet.')
      return
    }
    setBulkRunning(true)
    let ok = 0, fail = 0
    for (const row of targets) {
      try {
        if (bulkPending === 'archive') {
          const { error } = await supabase
            .from('scores')
            .update({ status: 'archived' })
            .eq('stage_id', String(row.stageId))
            .eq('candidate_name', row.name)
          if (error) throw error
        } else if (bulkPending === 'delete') {
          const { error } = await supabase
            .from('scores')
            .delete()
            .eq('stage_id', String(row.stageId))
            .eq('candidate_name', row.name)
          if (error) throw error
        }
        ok++
      } catch (err) {
        console.error('Bulk action failed for row:', row.id, err)
        fail++
      }
    }
    // Reflect state locally so the UI doesn't need a full reload.
    if (bulkPending === 'archive') {
      setRows((prev) => prev.map((r) => targets.find((t) => t.id === r.id) ? { ...r, dbStatus: 'archived' } : r))
    } else if (bulkPending === 'delete') {
      const okIds = new Set(targets.slice(0, ok).map((t) => t.id))
      setRows((prev) => prev.filter((r) => !okIds.has(r.id)))
    }
    setBulkRunning(false)
    setBulkPending(null)
    clearSelection()
    if (fail === 0) {
      flashSuccess(
        bulkPending === 'archive'
          ? `${ok} candidate${ok === 1 ? '' : 's'} archived.`
          : `${ok} candidate${ok === 1 ? '' : 's'} deleted.`,
      )
    } else if (ok === 0) {
      flashError(
        bulkPending === 'archive'
          ? 'Unable to archive the selection. Please try again.'
          : 'Unable to delete the selection. Please try again.',
      )
    } else {
      flashError(`${ok} succeeded · ${fail} failed. Please retry the remaining candidates.`)
    }
  }, [bulkPending, selected, rows, supabase, clearSelection, flashSuccess, flashError])

  /* ── Header copy ─────────────────────────────────── */

  const heading = loading
    ? 'Your candidate pipeline.'
    : rows.length === 0
    ? 'No candidates yet.'
    : `${rows.length} candidate${rows.length === 1 ? '' : 's'} in your pipeline.`

  return (
    <AppShell>
      <div className="max-w-[1180px] mx-auto pb-16">
        {/* Header — consistent with dashboard (Display + Body meta) */}
        <header className="mb-6">
          <Eyebrow>Candidates</Eyebrow>
          <div className="mt-3">
            <Display>{heading}</Display>
          </div>
          <p className="mt-2 text-[15px] leading-[1.5] text-[color:var(--color-rc-muted)] max-w-[54ch]">
            Everyone you&rsquo;ve invited, everyone who&rsquo;s interviewing, and everyone waiting on your call.
          </p>
        </header>

        {/* Quick filter chips */}
        {!loading && rows.length > 0 && (
          <div
            role="tablist"
            aria-label="Candidate filter"
            className="mb-4 flex flex-wrap items-center gap-1.5"
          >
            {QUICK_FILTERS.map((f) => (
              <QuickChip
                key={f.key}
                label={f.label}
                count={counts[f.key]}
                active={quick === f.key}
                onClick={() => setQuick(f.key)}
              />
            ))}
          </div>
        )}

        {/* Search + sort + role selector */}
        {!loading && rows.length > 0 && (
          <div className="mb-6 flex flex-col md:flex-row items-stretch md:items-center gap-2">
            <SearchField value={search} onChange={setSearch} />
            <Select
              aria-label="Sort candidates"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              fullWidth={false}
              className="md:min-w-[180px]"
              options={SORT_OPTIONS}
            />
            <Select
              aria-label="Filter by role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              fullWidth={false}
              className="md:min-w-[200px]"
              options={[
                { value: 'all', label: 'All roles' },
                ...roleList.map((r) => ({ value: r, label: r })),
              ]}
            />
          </div>
        )}

        {/* List */}
        {loading ? (
          <ul aria-busy="true" aria-label="Loading candidates" className="grid divide-y divide-[color:var(--color-rc-line)]/70 border-y border-[color:var(--color-rc-line)]/70">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} i={i} />)}
          </ul>
        ) : loadError ? (
          <ErrorCard kind={loadError} onRetry={loadData} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="No candidates yet."
            description="Invite candidates from a role and they&rsquo;ll appear here as they progress."
            action={
              <Button as="a" href="/roles" variant="primary" iconLeft={<Briefcase size={16} />}>
                Go to roles
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="pt-6 border-t border-[color:var(--color-rc-line)]">
            <H2>No candidates match this filter.</H2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[52ch]">
              {quick === 'needs-review'
                ? 'No candidates currently require review. New activity will appear automatically.'
                : quick === 'interview-today'
                ? 'No interviews are scheduled for today. Everything is running smoothly.'
                : quick === 'awaiting'
                ? 'Nothing is waiting on feedback right now.'
                : quick === 'offers'
                ? 'No offers are outstanding right now.'
                : quick === 'archived'
                ? 'You haven’t archived anyone yet.'
                : quick === 'shortlisted'
                ? 'No candidates are shortlisted right now.'
                : quick === 'rejected'
                ? 'No candidates have been rejected.'
                : 'Try broadening the search or picking a different filter.'}
            </p>
            {(search || role !== 'all' || quick !== 'all') && (
              <div className="mt-5">
                <Button variant="secondary" size="sm" onClick={() => { setSearch(''); setRole('all'); setQuick('all') }}>
                  Clear all filters
                </Button>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Select-all header row — same 6-column grid so the
                checkbox sits directly above every row's checkbox. */}
            <div
              className={
                'grid grid-cols-[28px_10px_minmax(0,1fr)_auto_auto_18px] items-center gap-x-4 md:gap-x-5 ' +
                'py-2 px-3 -mx-3 border-b border-[color:var(--color-rc-line)]/70 ' +
                'text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-muted)]'
              }
            >
              <span className="flex items-center justify-center">
                <SelectAllCheckbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={toggleSelectAll}
                  label={`Select all ${filteredIds.length} visible`}
                />
              </span>
              <span />
              <span>
                {selectedInFiltered > 0
                  ? `${selectedInFiltered} selected · ${filteredIds.length} shown`
                  : `${filteredIds.length} shown`}
              </span>
              <span className="hidden lg:inline text-right">Score</span>
              <span className="hidden md:inline text-right">Status</span>
              <span />
            </div>
            <ul
              role="list"
              aria-label="Candidates"
              className="grid divide-y divide-[color:var(--color-rc-line)]/70 border-b border-[color:var(--color-rc-line)]/70"
            >
              {filtered.map((r) => (
              <CandidateRow
                key={r.id}
                row={r}
                selected={selected.has(r.id)}
                onToggleSelect={toggleSelect}
                onMessage={handleMessage}
                onMenuAction={handleMenuAction}
              />
            ))}
            </ul>
          </>
        )}

        {/* Reserved footer so the sticky bulk bar never overlaps the
            last row's actions and the layout doesn't shift when it
            appears/disappears. */}
        <div aria-hidden="true" className={selected.size > 0 ? 'h-24' : 'h-6'} />

        {/* Delete confirmation — destructive, requires explicit click */}
        <Modal
          open={!!pendingDelete}
          onClose={() => !deleting && setPendingDelete(null)}
          title="Delete Candidate?"
          description="This action cannot be undone."
          size="sm"
          dismissible={!deleting}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPendingDelete(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} loading={deleting}>
                Delete
              </Button>
            </>
          }
        >
          {pendingDelete && (
            <p className="text-[13.5px] text-[color:var(--color-rc-muted)]">
              <span className="text-[color:var(--color-rc-ink)] font-medium">
                {pendingDelete.name || pendingDelete.email}
              </span>
              {pendingDelete.roleTitle ? <> · {pendingDelete.roleTitle}</> : null}
            </p>
          )}
        </Modal>

        {/* Move modal removed until the pipeline migration exists.
            The overflow menu no longer surfaces Move either. */}

        {/* Bulk action bar (sticky) */}
        <BulkActionBar
          count={selected.size}
          onClear={clearSelection}
          onAction={handleBulk}
          disabled={bulkRunning}
        />

        {/* Bulk confirm — same modal shape as single-row Delete but
            scoped to the pending action. Archive uses a soft
            confirmation; Delete uses the destructive language. */}
        <Modal
          open={!!bulkPending}
          onClose={() => !bulkRunning && setBulkPending(null)}
          title={bulkPending === 'delete' ? 'Delete selected candidates?' : 'Archive selected candidates?'}
          description={
            bulkPending === 'delete'
              ? 'This action cannot be undone.'
              : 'You can restore archived candidates any time from the Archived filter.'
          }
          size="sm"
          dismissible={!bulkRunning}
          footer={
            <>
              <Button variant="ghost" onClick={() => setBulkPending(null)} disabled={bulkRunning}>
                Cancel
              </Button>
              <Button
                variant={bulkPending === 'delete' ? 'danger' : 'primary'}
                onClick={runBulk}
                loading={bulkRunning}
              >
                {bulkPending === 'delete' ? 'Delete' : 'Archive'}
              </Button>
            </>
          }
        >
          <p className="text-[13.5px] text-[color:var(--color-rc-muted)]">
            <span className="text-[color:var(--color-rc-ink)] font-medium">
              {selected.size} candidate{selected.size === 1 ? '' : 's'}
            </span>
            {' '}selected. Only completed candidates will be affected — invitees remain untouched.
          </p>
        </Modal>

        {/* Toast — single primitive, standardized placement, distinct
            tone visual (✓ green / ! red), 2.4s auto-dismiss. Success
            messages announce polite; errors announce assertive so
            screen readers surface them promptly. */}
        {toast.message && (
          <div
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            className={
              'fixed bottom-20 left-1/2 -translate-x-1/2 z-40 ' +
              'inline-flex items-center gap-2 max-w-[420px] rounded-[10px] bg-white ' +
              'border border-[color:var(--color-rc-line)] px-4 py-2 ' +
              '[box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)] ' +
              'text-[13px] text-[color:var(--color-rc-ink)] rc-page-fade'
            }
          >
            {toast.tone === 'error' ? (
              <AlertTriangle size={14} aria-hidden="true" className="shrink-0 text-[color:var(--color-rc-red)]" />
            ) : (
              <CheckCircle2 size={14} aria-hidden="true" className="shrink-0 text-[color:var(--color-rc-green)]" />
            )}
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </AppShell>
  )
}
