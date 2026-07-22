'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  MoreHorizontal,
  Sparkles,
  Briefcase,
  CheckCircle2,
  Send,
  Loader,
  Star,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import {
  Button,
  ScoreBadge,
  StatusBadge,
  StatusDot,
  resolveStatus,
  Drawer,
  Modal,
  EmptyState,
  Spinner,
  Display,
  H2,
  Body,
  Caption,
  Eyebrow,
} from '@/components/ui'
import {
  getWorkspaceEntitlements,
  SUBSCRIPTION_STATES,
  PLAN_KEYS,
  SUBSCRIPTION_ERROR_CODES,
} from '@/lib/subscription'
import { Calendar, BarChart3 } from 'lucide-react'

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────── */

function initials(name) {
  return (name || '')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function relativeTime(date) {
  if (!date) return ''
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) {
    const m = Math.floor(s / 60)
    return `${m} min ago`
  }
  if (s < 86400) {
    const h = Math.floor(s / 3600)
    return `${h} hour${h === 1 ? '' : 's'} ago`
  }
  const days = Math.floor(s / 86400)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) {
    const w = Math.floor(days / 7)
    return `${w} week${w === 1 ? '' : 's'} ago`
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Derive a suggested outcome from the raw score band.
 * Aligns with ScoreBadge's own bands so the two badges read together
 * without either surprising the recruiter.
 */
function suggestedFromScore(score) {
  if (score == null) return 'in-progress'
  if (score >= 7) return 'shortlisted'
  if (score >= 4) return 'on-hold'
  return 'rejected'
}

/**
 * numToWord — spells out small integers so the editorial hero
 * ("You have three hiring decisions waiting.") reads naturally.
 * Falls back to numerals above twelve.
 */
function numToWord(n) {
  const words = [
    'zero','one','two','three','four','five',
    'six','seven','eight','nine','ten','eleven','twelve',
  ]
  return Number.isInteger(n) && n >= 0 && n <= 12 ? words[n] : String(n)
}

/**
 * Nicely formatted date — used inside the Workspace Health card
 * ("Renews on March 4"). Locale-neutral, no year to reduce noise.
 */
function formatShortDate(iso) {
  if (!iso) return null
  const d = iso instanceof Date ? iso : new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

/* ─────────────────────────────────────────────────────────────
 * CountUp — animates a number from 0 to value on mount.
 * Respects prefers-reduced-motion.
 * ────────────────────────────────────────────────────────── */

function CountUp({ value, duration = 420, decimals = 0 }) {
  const [n, setN] = useState(() => {
    if (typeof window === 'undefined') return value
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    return mq?.matches ? value : 0
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      setN(value)
      return
    }
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (mq?.matches || value == null) {
      setN(value)
      return
    }
    const target = Number(value)
    if (!Number.isFinite(target)) {
      setN(value)
      return
    }
    let start = null
    let rafId = 0
    function tick(t) {
      if (start == null) start = t
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(target * eased)
      if (p < 1) rafId = requestAnimationFrame(tick)
      else setN(target)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [value, duration])

  if (value == null || Number.isNaN(Number(value))) return <>—</>
  return <>{Number(n).toFixed(decimals)}</>
}

/* ─────────────────────────────────────────────────────────────
 * SectionLabel — the "OVERVIEW" small-caps warm-yellow label used
 * on the landing page as a section anchor.
 * ────────────────────────────────────────────────────────── */

function SectionLabel({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
      {children}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * SectionHeading — the Archivo display heading (~28px) used on
 * every section title beneath the small-caps label.
 * ────────────────────────────────────────────────────────── */

function SectionHeading({ children }) {
  return (
    <h2
      className="mt-4 text-[26px] md:text-[30px] leading-[1.15] font-semibold tracking-[-0.028em] text-[color:var(--color-rc-ink)]"
      style={{ fontFamily: 'var(--font-editorial), inherit' }}
    >
      {children}
    </h2>
  )
}

/* ─────────────────────────────────────────────────────────────
 * LoadingBlock — a neutral card-shaped placeholder used across
 * every section while data is loading. One consistent visual.
 * ────────────────────────────────────────────────────────── */

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
 * KPICard — editorial metric card.
 *   • Small-caps warm-yellow label
 *   • Archivo big number (ink black, animated on mount)
 *   • Trend line with a colored arrow only
 *   • Optional /10 suffix
 * ────────────────────────────────────────────────────────── */

function KPICard({ label, value, decimals = 0, suffix, trend, onClick }) {
  const inner = (
    <>
      <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
        {label}
      </div>
      <div className="mt-4 flex items-baseline gap-1">
        <span
          className="text-[40px] md:text-[52px] leading-none font-semibold tracking-[-0.038em] text-[color:var(--color-rc-ink)] tabular-nums"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
        >
          {typeof value === 'number' ? (
            <CountUp value={value} decimals={decimals} />
          ) : (
            value ?? '—'
          )}
        </span>
        {suffix && value != null && (
          <span className="text-[15px] text-[color:var(--color-rc-muted)] font-medium">
            {suffix}
          </span>
        )}
      </div>
      <div className="mt-5 flex items-center gap-1.5 text-[12.5px] leading-none text-[color:var(--color-rc-muted)] min-h-[14px]">
        {trend ? (
          <>
            {trend.direction === 'up' && (
              <ArrowUpRight
                size={14}
                className="text-[color:var(--color-rc-green)]"
                strokeWidth={2.25}
              />
            )}
            {trend.direction === 'down' && (
              <ArrowDownRight
                size={14}
                className="text-[color:var(--color-rc-red)]"
                strokeWidth={2.25}
              />
            )}
            {trend.direction === 'flat' && (
              <ArrowRight
                size={14}
                className="text-[color:var(--color-rc-muted)]"
                strokeWidth={2.25}
              />
            )}
            <span>{trend.label}</span>
          </>
        ) : (
          <span className="opacity-0">.</span>
        )}
      </div>
    </>
  )

  const shell =
    'p-6 md:p-7 rounded-[16px] bg-white border border-[color:var(--color-rc-line)] ' +
    '[box-shadow:0_1px_2px_rgba(17,17,17,0.015),0_22px_40px_-34px_rgba(17,17,17,0.06)] ' +
    'transition-[transform,box-shadow,border-color] duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)]'

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={`${label} — open details`}
        className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-2 rounded-[16px]"
      >
        <div
          className={
            shell +
            ' group-hover:-translate-y-0.5 group-hover:border-[color:var(--color-rc-line-hover)]' +
            ' group-hover:[box-shadow:0_2px_4px_rgba(17,17,17,0.02),0_28px_48px_-32px_rgba(17,17,17,0.1)]'
          }
        >
          {inner}
        </div>
      </button>
    )
  }

  return <div className={shell}>{inner}</div>
}

/* ─────────────────────────────────────────────────────────────
 * PriorityRow — one decision waiting for the recruiter.
 *
 * v3 refinement: entire row is a link, hover shifts the row up
 * 2px with a soft background, the review chevron fades in from
 * the right. No inline buttons — the row IS the action. Score
 * is shown as a quiet numeral, not a coloured badge.
 * ────────────────────────────────────────────────────────── */

function PriorityRow({ name, roleTitle, score, completedAt, stageId }) {
  return (
    <li>
      <Link
        href={`/interview/${stageId}/transcript`}
        aria-label={`Review ${name || 'candidate'} for ${roleTitle || 'unassigned role'}`}
        className={
          'group grid grid-cols-[minmax(0,1fr)_auto_20px] items-center gap-6 ' +
          'px-2 py-5 -mx-2 rounded-[12px] cursor-pointer ' +
          'hover:bg-[color:var(--color-rc-soft)]/70 transition-colors duration-150 ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
      >
        <div className="min-w-0">
          <div
            className="text-[18px] leading-tight font-semibold tracking-[-0.015em] text-[color:var(--color-rc-ink)] truncate"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {name || 'Anonymous candidate'}
          </div>
          <div className="mt-1.5 text-[13.5px] text-[color:var(--color-rc-muted)] truncate">
            {roleTitle || 'Unassigned role'}
            {completedAt ? <> · {relativeTime(completedAt)}</> : null}
          </div>
        </div>
        {score != null && (
          <div className="hidden sm:flex flex-col items-end tabular-nums">
            <span
              className="text-[15px] font-semibold text-[color:var(--color-rc-ink)] leading-none"
              style={{ fontFamily: 'var(--font-editorial), inherit' }}
            >
              {Number(score).toFixed(1)}
            </span>
            <span className="mt-1 text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-muted)]">
              Score
            </span>
          </div>
        )}
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="text-[color:var(--color-rc-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 transition-[opacity,transform] duration-150"
        />
      </Link>
    </li>
  )
}

/* Legacy WaitingRow — kept only for the "See all" drawer so we don't
 * touch that surface in the v3 pass. */

function WaitingRow({ name, roleTitle, score, completedAt, stageId }) {
  const suggested = suggestedFromScore(score)
  return (
    <Link
      href={`/interview/${stageId}/transcript`}
      className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-2 rounded-[14px]"
      aria-label={`Review ${name || 'candidate'} — ${roleTitle || 'unassigned role'}`}
    >
      <div className="flex items-center gap-5 px-5 md:px-6 py-5 rounded-[14px] bg-white border border-[color:var(--color-rc-line)] transition-[transform,box-shadow,border-color] duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:-translate-y-0.5 group-hover:border-[color:var(--color-rc-line-hover)] [box-shadow:0_1px_2px_rgba(17,17,17,0.02)] group-hover:[box-shadow:0_22px_40px_-30px_rgba(17,17,17,0.12)]">
        <div
          className="shrink-0 h-11 w-11 rounded-full bg-[color:var(--color-rc-soft)] grid place-items-center text-[13.5px] font-semibold text-[color:var(--color-rc-ink)]"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
          aria-hidden="true"
        >
          {initials(name) || '—'}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[16.5px] leading-tight font-semibold tracking-[-0.015em] text-[color:var(--color-rc-ink)] truncate"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {name || 'Anonymous candidate'}
          </div>
          <div className="mt-1.5 text-[13px] text-[color:var(--color-rc-muted)] truncate">
            {roleTitle || 'Unassigned role'}
            {completedAt ? <> · {relativeTime(completedAt)}</> : null}
          </div>
        </div>
        <div className="shrink-0 hidden sm:flex items-center gap-2">
          {score != null && <ScoreBadge value={score} outOf={10} size="sm" />}
          <StatusBadge status={suggested} size="sm" />
        </div>
        <ChevronRight
          size={18}
          className="shrink-0 text-[color:var(--color-rc-muted)] group-hover:text-[color:var(--color-rc-ink)] group-hover:translate-x-0.5 transition-[color,transform] duration-150"
          aria-hidden="true"
        />
      </div>
    </Link>
  )
}

/* ─────────────────────────────────────────────────────────────
 * QuickAction — one chip in the quick-actions toolbar.
 * Secondary-weight, hairline border, no yellow. Icon left, label
 * right, tabbable, 150ms hover.
 * ────────────────────────────────────────────────────────── */

function QuickAction({ icon, label, href, onClick }) {
  const cls =
    'inline-flex items-center gap-2 h-8 px-3 rounded-[8px] ' +
    'bg-transparent border border-[color:var(--color-rc-line)]/40 ' +
    'text-[13px] text-[color:var(--color-rc-muted)] ' +
    'hover:text-[color:var(--color-rc-ink)] hover:border-[color:var(--color-rc-line)]/70 hover:bg-[color:var(--color-rc-soft)]/40 ' +
    'transition-[background-color,border-color,color] duration-150 ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
    'focus-visible:ring-offset-1'
  if (href) {
    return (
      <Link href={href} className={cls} aria-label={label}>
        <span aria-hidden="true" className="text-[color:var(--color-rc-muted)]">{icon}</span>
        {label}
      </Link>
    )
  }
  return (
    <button type="button" className={cls} onClick={onClick} aria-label={label}>
      <span aria-hidden="true" className="text-[color:var(--color-rc-muted)]">{icon}</span>
      {label}
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
 * KPIStrip — v4 compact horizontal metric strip.
 *
 * Replaces the four-card KPI grid with one calm bar of paired
 * label + numeral cells separated by hairlines. Every cell is
 * clickable and opens the matching drawer for the drill-down.
 * ────────────────────────────────────────────────────────── */

function KPICell({ label, value, onClick, decimals = 0 }) {
  const inner = (
    <>
      <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-muted)]/80">
        {label}
      </div>
      <div
        className="mt-2 text-[30px] leading-none font-semibold tracking-[-0.03em] text-[color:var(--color-rc-ink)] tabular-nums"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        {typeof value === 'number' ? Number(value).toFixed(decimals) : (value ?? '—')}
      </div>
    </>
  )
  if (!onClick) return <div className="flex-1 min-w-0 py-4 md:py-5 px-5 md:px-6">{inner}</div>
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}`}
      className="text-left flex-1 min-w-0 py-4 md:py-5 px-5 md:px-6 rounded-[8px] transition-colors duration-150 hover:bg-[color:var(--color-rc-soft)]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
    >
      {inner}
    </button>
  )
}

function KPIStrip({ cells }) {
  return (
    <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] flex flex-col md:flex-row md:items-stretch divide-y md:divide-y-0 md:divide-x divide-[color:var(--color-rc-line)]">
      {cells.map((c, i) => (
        <KPICell key={i} {...c} />
      ))}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * PriorityQueueRow — v4 row for the top decisions.
 *
 * Columns: candidate name (dominant) · reason · role · time.
 * Whole row is a link; hover lifts slightly with a soft
 * background; chevron fades in.
 * ────────────────────────────────────────────────────────── */

function reasonForScore(score) {
  if (score == null) return 'Awaiting review'
  if (score >= 7) return 'High score — decision needed'
  if (score >= 4) return 'Awaiting review'
  return 'Below bar — confirm reject'
}

/** Map a numeric score to the shared StatusDot enum. */
function statusFromScore(score) {
  if (score == null) return 'awaiting-review'
  if (score >= 7) return 'shortlisted'
  if (score >= 4) return 'awaiting-review'
  return 'action-required'
}

/** "Waiting 2 days" phrasing for the Priority Queue Time-Waiting column. */
function waitingSince(completedAt) {
  if (!completedAt) return '—'
  const s = (Date.now() - new Date(completedAt).getTime()) / 1000
  if (s < 3600) return 'Waiting < 1 hour'
  if (s < 86400) {
    const h = Math.floor(s / 3600)
    return `Waiting ${h} hour${h === 1 ? '' : 's'}`
  }
  const d = Math.floor(s / 86400)
  return `Waiting ${d} day${d === 1 ? '' : 's'}`
}

function PriorityQueueRow({ name, roleTitle, score, completedAt, stageId }) {
  const dotStatus = statusFromScore(score)
  const dotColor  = resolveStatus(dotStatus).color
  const statusLabel = resolveStatus(dotStatus).label
  return (
    <li>
      <Link
        href={`/interview/${stageId}/transcript`}
        aria-label={`Review ${name || 'candidate'} for ${roleTitle || 'unassigned role'}`}
        className={
          'group grid grid-cols-[10px_minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto_20px] items-center gap-x-4 md:gap-x-6 ' +
          'py-4 px-3 -mx-3 rounded-[10px] cursor-pointer ' +
          'hover:bg-[color:var(--color-rc-soft)]/70 hover:-translate-y-[1px] ' +
          'transition-[background-color,transform] duration-150 ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
      >
        {/* Status indicator subtly grows + brightens on row hover to
            reinforce that the row is a live surface. */}
        <span
          role="img"
          aria-label={statusLabel}
          className={
            'inline-block h-1.5 w-1.5 rounded-full shrink-0 ' +
            'transition-[transform,box-shadow] duration-150 ' +
            'group-hover:scale-[1.25]'
          }
          style={{
            backgroundColor: dotColor,
            boxShadow: '0 0 0 0 transparent',
          }}
        />
        <div className="min-w-0 text-[15px] leading-tight font-semibold tracking-[-0.012em] text-[color:var(--color-rc-ink)] truncate">
          {name || 'Anonymous candidate'}
        </div>
        <div className="min-w-0 text-[13px] text-[color:var(--color-rc-muted)] truncate hidden md:block">
          {roleTitle || 'Unassigned role'}
        </div>
        <div className="min-w-0 text-[13px] text-[color:var(--color-rc-ink)] truncate hidden md:block">
          {statusLabel}
        </div>
        <div className="text-[12.5px] text-[color:var(--color-rc-muted)] tabular-nums whitespace-nowrap hidden sm:block">
          {waitingSince(completedAt)}
        </div>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="text-[color:var(--color-rc-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-focus-visible:opacity-100 group-focus-visible:translate-x-0 transition-[opacity,transform] duration-150"
        />
      </Link>
    </li>
  )
}

/* ─────────────────────────────────────────────────────────────
 * NeedsAttentionRow — stale invitee row. Reduces visual weight
 * compared to Priority Queue; the candidate email dominates and
 * the "chase" affordance is only the row itself.
 * ────────────────────────────────────────────────────────── */

function NeedsAttentionRow({ email, roleTitle, invited_at, roleId }) {
  const daysStale = invited_at
    ? Math.round((Date.now() - new Date(invited_at).getTime()) / 86_400_000)
    : null
  return (
    <li>
      <Link
        href={roleId ? `/roles/${roleId}` : '/candidates'}
        aria-label={`Follow up with ${email}`}
        className={
          'group grid grid-cols-[8px_minmax(0,1fr)_auto_20px] items-center gap-x-4 md:gap-x-6 ' +
          'py-4 px-3 -mx-3 rounded-[12px] cursor-pointer ' +
          'hover:bg-[color:var(--color-rc-soft)]/70 transition-colors duration-150 ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
      >
        <StatusDot status="action-required" />
        <div className="min-w-0">
          <div
            className="text-[15.5px] leading-tight font-semibold tracking-[-0.015em] text-[color:var(--color-rc-ink)] truncate"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {email}
          </div>
          <div className="mt-1 text-[13px] text-[color:var(--color-rc-muted)] truncate">
            {roleTitle || 'Unassigned role'} · Invited {daysStale != null ? `${daysStale} day${daysStale === 1 ? '' : 's'} ago` : 'earlier'}
          </div>
        </div>
        <span className="text-[12px] text-[color:var(--color-rc-muted)] whitespace-nowrap hidden sm:inline">
          Send a nudge
        </span>
        <ChevronRight
          size={15}
          aria-hidden="true"
          className="text-[color:var(--color-rc-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150"
        />
      </Link>
    </li>
  )
}

/* ─────────────────────────────────────────────────────────────
 * UpcomingInterviewRow — today's and tomorrow's interview
 * activity. Very compact; recruiter uses it to know what's live
 * without opening /interviews.
 * ────────────────────────────────────────────────────────── */

/**
 * Interview status derivation. Uses the age of the invite as a proxy
 * for interview stage until scheduled-time metadata exists:
 *   invited < 12h  → confirmed        (fresh — expected to happen soon)
 *   invited < 36h  → interview-scheduled  (default flow)
 *   invited < 3d   → needs-reschedule (getting stale)
 *   older          → cancelled        (never engaged)
 */
function interviewStatusFromInvite(invited_at) {
  if (!invited_at) return 'interview-scheduled'
  const ageHours = (Date.now() - new Date(invited_at).getTime()) / 3_600_000
  if (ageHours < 12) return 'confirmed'
  if (ageHours < 36) return 'interview-scheduled'
  if (ageHours < 72) return 'needs-reschedule'
  return 'cancelled'
}

function StatusChip({ status }) {
  const spec = resolveStatus(status)
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-full bg-[color:var(--color-rc-soft)] text-[11px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-muted)] whitespace-nowrap"
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{ backgroundColor: spec.color }}
      />
      {spec.label}
    </span>
  )
}

function UpcomingInterviewRow({ email, roleTitle, invited_at }) {
  const at = invited_at ? new Date(invited_at) : null
  const now = new Date()
  const isToday = at && at.toDateString() === now.toDateString()
  const label = isToday ? 'Today' : at ? 'Yesterday' : ''
  const time = at
    ? at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : ''
  const status = interviewStatusFromInvite(invited_at)
  return (
    <li>
      <Link
        href={`/candidates?q=${encodeURIComponent(email || '')}`}
        aria-label={`Open ${email || 'interview'}`}
        className={
          'group grid grid-cols-[10px_minmax(0,1fr)_auto_auto_20px] items-center gap-x-4 md:gap-x-6 ' +
          'py-3.5 px-3 -mx-3 rounded-[10px] cursor-pointer ' +
          'hover:bg-[color:var(--color-rc-soft)]/70 hover:-translate-y-[1px] ' +
          'transition-[background-color,transform] duration-150 ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
      >
        <StatusDot status={status} />
        <div className="min-w-0">
          <div className="text-[14.5px] font-medium text-[color:var(--color-rc-ink)] truncate">
            {email || 'Anonymous invite'}
          </div>
          <div className="mt-0.5 text-[12.5px] text-[color:var(--color-rc-muted)] truncate">
            {roleTitle || 'Unassigned role'}
          </div>
        </div>
        <div className="text-[12.5px] text-[color:var(--color-rc-muted)] tabular-nums whitespace-nowrap">
          {label} {time}
        </div>
        <span className="hidden md:inline-flex"><StatusChip status={status} /></span>
        <ChevronRight
          size={15}
          aria-hidden="true"
          className="text-[color:var(--color-rc-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150"
        />
      </Link>
    </li>
  )
}

/* ─────────────────────────────────────────────────────────────
 * RecentActivityTimeline — grouped Today / Yesterday / Earlier.
 * Very quiet visual — small caps date header, tabular time,
 * one-line event, occasional muted verb.
 * ────────────────────────────────────────────────────────── */

function formatClock(d) {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
}

function activityBuckets(items) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  const groups = { Today: [], Yesterday: [], Earlier: [] }
  for (const it of items) {
    if (it.at >= today) groups.Today.push(it)
    else if (it.at >= yesterday) groups.Yesterday.push(it)
    else groups.Earlier.push(it)
  }
  return groups
}

function RecentActivityTimeline({ items }) {
  if (!items || items.length === 0) return null
  const groups = activityBuckets(items)
  return (
    <div className="grid gap-6">
      {['Today', 'Yesterday', 'Earlier'].map((bucket) => {
        const list = groups[bucket]
        if (!list.length) return null
        return (
          <div key={bucket}>
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-muted)]">
              {bucket}
            </div>
            <ul className="mt-3 grid gap-2.5">
              {list.map((it, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[8px_52px_1fr] items-baseline gap-x-3 text-[13.5px] leading-relaxed"
                >
                  <StatusDot
                    status={it.kind === 'completed'
                      ? (typeof it.score === 'number' && it.score >= 7 ? 'shortlisted' : 'complete')
                      : 'in-progress'}
                  />
                  <span className="text-[12px] tabular-nums text-[color:var(--color-rc-muted)]">
                    {formatClock(it.at)}
                  </span>
                  <span className="text-[color:var(--color-rc-ink)]">
                    {it.kind === 'completed' && (
                      <>
                        <span className="font-medium">{it.name || 'A candidate'}</span>
                        {' '}completed an interview
                        {typeof it.score === 'number' && (
                          <span className="text-[color:var(--color-rc-muted)]"> · scored {Number(it.score).toFixed(1)}</span>
                        )}
                      </>
                    )}
                    {it.kind === 'invited' && (
                      <>
                        <span className="font-medium">{it.email}</span>
                        {' '}was invited{it.roleTitle ? <> to <span className="text-[color:var(--color-rc-ink)]">{it.roleTitle}</span></> : null}
                      </>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * MomentumRoleCard — v3 "Continue working" card.
 *
 * Replaces progress percentages with the three signals a recruiter
 * actually cares about: how many candidates, how many awaiting
 * review, and when the role last had activity. Whole card is a
 * link; hover elevates 2px with no shadow bloom.
 * ────────────────────────────────────────────────────────── */

function MomentumRoleCard({ role }) {
  const activityLine = role.lastActivityAt
    ? `Updated ${relativeTime(role.lastActivityAt)}`
    : 'No activity yet'

  return (
    <Link
      href={`/roles/${role.id}`}
      aria-label={`Continue working on ${role.title}`}
      className={
        'group block rounded-[14px] bg-white border border-[color:var(--color-rc-line)] ' +
        'px-6 py-5 md:px-7 md:py-6 cursor-pointer ' +
        'transition-[transform,border-color] duration-150 ease-out ' +
        'hover:-translate-y-0.5 hover:border-[color:var(--color-rc-line-hover)] ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
      }
    >
      <div className="flex items-start justify-between gap-4">
        <h3
          className="text-[19px] leading-tight font-semibold tracking-[-0.018em] text-[color:var(--color-rc-ink)] truncate"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
        >
          {role.title}
        </h3>
        <ChevronRight
          size={16}
          aria-hidden="true"
          className="text-[color:var(--color-rc-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-[opacity,transform] duration-150 shrink-0 mt-1"
        />
      </div>
      <ul className="mt-4 space-y-1 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
        <li>
          <span className="text-[color:var(--color-rc-ink)] font-medium tabular-nums">
            {role.invited}
          </span>{' '}
          candidate{role.invited === 1 ? '' : 's'}
        </li>
        <li>
          {role.waiting > 0 ? (
            <>
              <span className="text-[color:var(--color-rc-ink)] font-medium tabular-nums">
                {role.waiting}
              </span>{' '}
              awaiting review
            </>
          ) : role.ongoing > 0 ? (
            <>
              <span className="text-[color:var(--color-rc-ink)] font-medium tabular-nums">
                {role.ongoing}
              </span>{' '}
              in progress
            </>
          ) : role.invited > 0 ? (
            'Everyone reviewed'
          ) : (
            'No candidates invited yet'
          )}
        </li>
        <li>
          {role.interviewsToday > 0 ? (
            <>
              <span className="text-[color:var(--color-rc-ink)] font-medium tabular-nums">
                {role.interviewsToday}
              </span>{' '}
              interview{role.interviewsToday === 1 ? '' : 's'} today
            </>
          ) : (
            'No interviews today'
          )}
        </li>
        <li>{activityLine}</li>
      </ul>
    </Link>
  )
}

/* ─────────────────────────────────────────────────────────────
 * SnapshotRow — one line in the compact Hiring Snapshot list.
 * "Label — value". Value doubles as an opener for the matching
 * drawer so the section stays interactive but visually quiet.
 * ────────────────────────────────────────────────────────── */

function SnapshotRow({ label, value, onClick }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3 border-b border-[color:var(--color-rc-line)] last:border-b-0 md:border-b md:last:border-b">
      <dt className="text-[13.5px] text-[color:var(--color-rc-muted)]">{label}</dt>
      <dd className="min-w-0">
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            aria-label={`${label}: ${value}`}
            className={
              'text-[19px] font-semibold tracking-[-0.02em] tabular-nums ' +
              'text-[color:var(--color-rc-ink)] ' +
              'hover:text-[color:var(--color-rc-ink)] transition-colors duration-150 ' +
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded'
            }
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {value ?? '—'}
          </button>
        ) : (
          <span
            className="text-[19px] font-semibold tracking-[-0.02em] tabular-nums text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {value ?? '—'}
          </span>
        )}
      </dd>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * WorkspaceHealthCard — merged Subscription / Usage / Renewal
 * into one calm card. Never looks like Billing — plan name is a
 * quiet label, usage is a thin bar, renewal is a date.
 * ────────────────────────────────────────────────────────── */

function WorkspaceHealthCard({ trialData, trial }) {
  const isTrial = trialData.planKey === PLAN_KEYS.TRIAL
  const isExpired = trialData.effectiveStatus === SUBSCRIPTION_STATES.EXPIRED
  const planName = isTrial ? 'Trial workspace' : `${(trialData.planKey || '').replace(/^./, (c) => c.toUpperCase())} plan`
  const renewal = formatShortDate(trialData.periodEnd)

  const used = trialData.candidatesUsed || 0
  const total = trialData.candidatesTotal
  const hasCap = typeof total === 'number' && total > 0
  const pct = hasCap ? Math.min(100, Math.round((used / total) * 100)) : 0

  return (
    <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] px-6 py-5 md:px-7 md:py-6">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <div
            className="text-[19px] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {planName}
          </div>
          <p className="mt-1 text-[13.5px] text-[color:var(--color-rc-muted)]">
            {isExpired
              ? 'Your workspace is past its renewal date.'
              : hasCap
                ? `${used} of ${total} candidates used this cycle`
                : 'Unlimited candidates this cycle'}
          </p>
        </div>
        <Link
          href="/subscription"
          className={
            'inline-flex items-center gap-1 text-[13px] text-[color:var(--color-rc-muted)] ' +
            'hover:text-[color:var(--color-rc-ink)] transition-colors duration-150 ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded'
          }
        >
          Manage workspace <ChevronRight size={12} aria-hidden="true" />
        </Link>
      </div>

      {hasCap && (
        <div className="mt-5 h-[3px] w-full rounded-full bg-[color:var(--color-rc-soft)] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
            style={{
              width: `${pct}%`,
              backgroundColor: (isTrial && trial?.critical) || isExpired
                ? 'var(--color-rc-yellow)'
                : 'rgba(17,17,17,0.72)',
            }}
          />
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-2 text-[13px] text-[color:var(--color-rc-muted)]">
        {renewal && (
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
              {isTrial ? 'Trial ends' : 'Renews'}
            </div>
            <div className="mt-1 text-[color:var(--color-rc-ink)]">{renewal}</div>
          </div>
        )}
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
            Seats
          </div>
          <div className="mt-1 text-[color:var(--color-rc-ink)]">1 in use</div>
        </div>
        {isTrial && (
          <div>
            <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
              Interviews left
            </div>
            <div className="mt-1 text-[color:var(--color-rc-ink)]">
              {Math.max(0, (trialData.candidatesTotal || 0) - used)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * QuietEmpty — editorial empty state. No "No data" copy, no icon.
 * Just a short thought and an optional secondary action.
 * ────────────────────────────────────────────────────────── */

function QuietEmpty({ title, body, action }) {
  return (
    <div className="border-t border-[color:var(--color-rc-line)] pt-6">
      <p
        className="text-[19px] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)] max-w-[42ch]"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        {title}
      </p>
      {body && (
        <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[52ch]">
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * PriorityRoleCard — legacy card retained for the "See all"
 * drawer body so the v3 pass doesn't reshape the drawer content.
 * ────────────────────────────────────────────────────────── */

function PriorityRoleCard({ role, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const pct = role.invited
    ? Math.min(100, Math.round((role.completed / role.invited) * 100))
    : 0

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e) {
      if (!menuRef.current?.contains(e.target)) setMenuOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Contextual primary action — decides what the recruiter's next
  // step is for this role without them having to think about it.
  let action
  if (role.waiting > 0) {
    action = (
      <Button
        as="a"
        href={`/roles/${role.id}`}
        variant="primary"
        size="sm"
        iconRight={<ChevronRight size={14} />}
      >
        Review candidates
      </Button>
    )
  } else if (role.invited === 0 || role.ongoing > 0) {
    action = (
      <Button
        as="a"
        href={`/roles/${role.id}`}
        variant="secondary"
        size="sm"
        iconLeft={<Plus size={14} />}
      >
        Invite candidates
      </Button>
    )
  } else {
    action = (
      <Button
        as="a"
        href={`/roles/${role.id}`}
        variant="ghost"
        size="sm"
        iconRight={<ChevronRight size={14} />}
      >
        View role
      </Button>
    )
  }

  return (
    <div className="p-6 md:p-7 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] [box-shadow:0_1px_2px_rgba(17,17,17,0.015),0_24px_44px_-40px_rgba(17,17,17,0.07)] transition-[transform,box-shadow,border-color] duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)] hover:-translate-y-0.5 hover:border-[color:var(--color-rc-line-hover)] hover:[box-shadow:0_2px_4px_rgba(17,17,17,0.02),0_32px_52px_-38px_rgba(17,17,17,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <Link
          href={`/roles/${role.id}`}
          className="min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
        >
          <h3
            className="text-[20px] leading-tight font-semibold tracking-[-0.022em] text-[color:var(--color-rc-ink)] truncate"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {role.title}
          </h3>
          {role.category && (
            <p className="mt-1.5 text-[13px] text-[color:var(--color-rc-muted)] truncate">
              {role.category}
            </p>
          )}
        </Link>

        <div className="relative shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={`Actions for ${role.title}`}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="h-9 w-9 grid place-items-center rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-1 w-44 z-20 rounded-[12px] bg-white border border-[color:var(--color-rc-line)] [box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)] py-1.5"
            >
              <Link
                href={`/roles/${role.id}`}
                role="menuitem"
                className="block px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]"
              >
                Open role
              </Link>
              <Link
                href={`/candidates?role=${role.id}`}
                role="menuitem"
                className="block px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]"
              >
                View candidates
              </Link>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete(role)
                }}
                className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-red)] hover:bg-[rgb(199_75_58_/_0.06)]"
              >
                Delete role
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Neutral progress bar — yellow is reserved for attention indicators */}
      <div className="mt-6">
        <div className="flex items-center justify-between text-[13px] mb-2.5">
          <span className="text-[color:var(--color-rc-ink)] font-medium">
            {role.completed} of {role.invited} completed
          </span>
          <span className="text-[color:var(--color-rc-muted)] tabular-nums">
            {pct}%
          </span>
        </div>
        <div className="h-[4px] w-full rounded-full bg-[color:var(--color-rc-soft)] overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-[600ms] ease-[cubic-bezier(.22,.61,.36,1)]"
            style={{
              width: `${pct}%`,
              backgroundColor: 'rgba(17,17,17,0.72)',
            }}
          />
        </div>
      </div>

      {/* Meta line — waiting count is the only element that uses yellow */}
      <div className="mt-5 flex items-center flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-[color:var(--color-rc-muted)]">
        {role.waiting > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[color:var(--color-rc-warm)] font-medium">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]"
            />
            {role.waiting} waiting on you
          </span>
        )}
        <span>{role.ongoing} in progress</span>
        <span>{role.invited} invited</span>
      </div>

      <div className="mt-6 flex justify-end">{action}</div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * SimpleRow — compact list row used inside "See all" drawers.
 * Kept intentionally quieter than WaitingRow so the hero section
 * still owns the visual weight.
 * ────────────────────────────────────────────────────────── */

function SimpleRow({ name, email, meta, extra, score, href }) {
  const inner = (
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-[12px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)]">
      <div
        className="shrink-0 h-8 w-8 rounded-full bg-white grid place-items-center text-[11px] font-semibold text-[color:var(--color-rc-ink)]"
        aria-hidden="true"
      >
        {name ? initials(name) : email ? email[0].toUpperCase() : '?'}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium text-[color:var(--color-rc-ink)] truncate">
          {name || email}
        </div>
        {(meta || extra) && (
          <div className="text-[12.5px] text-[color:var(--color-rc-muted)] truncate">
            {meta}
            {meta && extra ? ' · ' : ''}
            {extra}
          </div>
        )}
      </div>
      {score != null && <ScoreBadge value={score} size="sm" />}
      {href && (
        <ChevronRight
          size={14}
          className="text-[color:var(--color-rc-muted)]"
          aria-hidden="true"
        />
      )}
    </div>
  )
  return href ? (
    <Link
      href={href}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded-[12px]"
    >
      {inner}
    </Link>
  ) : (
    inner
  )
}

/* ─────────────────────────────────────────────────────────────
 * DashboardPage — the page.
 * Preserves: onboarding redirect, all Supabase reads, cascade delete.
 * ────────────────────────────────────────────────────────── */

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [trialData, setTrialData] = useState(null)
  const [firstName, setFirstName] = useState(null)
  const [upgraded, setUpgraded] = useState(false)

  const [waitingList, setWaitingList] = useState([])

  const [stats, setStats] = useState({
    activeRoles: 0,
    invited: 0,
    completed: 0,
    ongoing: 0,
    reviewsWaiting: 0,
    offersPending: 0,
    completedOvernight: 0,
    estimatedMinutes: 0,
    avgScore: null,
  })
  const [needsAttentionList, setNeedsAttentionList] = useState([])
  const [upcomingList, setUpcomingList] = useState([])
  const [activityList, setActivityList] = useState([])
  const [trends, setTrends] = useState({
    invited: null,
    completed: null,
    avgScore: null,
  })
  const [roleProgress, setRoleProgress] = useState([])

  // Cached lists for the "See all" drawers
  const [drawerLists, setDrawerLists] = useState({
    invited: [],
    completed: [],
    ongoing: [],
  })

  // Which drawer is open, if any
  // 'waiting' | 'roles' | 'invited' | 'completed' | 'ongoing' | 'score' | null
  const [drawer, setDrawer] = useState(null)

  // Delete-role modal state
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('upgraded')) setUpgraded(true)
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (!user) return

      const meta = user.user_metadata || {}
      const id0 = user.identities?.[0]?.identity_data || {}

      // Priority chain — real name fields only.
      // Prefer identity_data first (populated by OAuth providers with a
      // real display name), then user_metadata fields the app or the
      // provider might have set on signup.
      const rawFromMeta =
        meta.display_name ||
        meta.full_name ||
        meta.first_name ||
        meta.name ||
        id0.full_name ||
        id0.name ||
        id0.given_name ||
        null

      // Never surface a raw email. Only consider the email local-part
      // as a last resort — and only when it has a real word boundary
      // (space, dot, underscore, hyphen, plus). A separator-less blob
      // like "michaelrokkala" is undecidable; we refuse to guess.
      const rawFromEmail = (() => {
        if (!user.email) return null
        const local = user.email.split('@')[0]
        return /[\s._+-]/.test(local) ? local : null
      })()

      const candidate = rawFromMeta ?? rawFromEmail
      if (!candidate) {
        setFirstName(null)
        return
      }

      // Take the first token. Split on real separators only — never
      // on CamelCase. "MichaelRokkala" stays "MichaelRokkala".
      const firstToken = String(candidate)
        .split(/[\s._+-]+/)
        .filter(Boolean)[0]
      if (!firstToken) {
        setFirstName(null)
        return
      }

      // Case handling:
      //   • all-lower or all-upper → Title-case ("michael" → "Michael")
      //   • mixed case             → leave alone ("McDonald", "O'Brien",
      //                              "Anne", "MichaelRokkala" typed by a
      //                              human → all respected verbatim)
      const isFlat =
        /^[a-z]+$/.test(firstToken) || /^[A-Z]+$/.test(firstToken)
      const titled = isFlat
        ? firstToken.charAt(0).toUpperCase() +
          firstToken.slice(1).toLowerCase()
        : firstToken

      setFirstName(titled)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const [rolesRes, stagesRes, interviewsRes, scoresRes, settingsRes] =
      await Promise.all([
        supabase
          .from('roles')
          .select('id, title, department, status, created_at')
          .order('created_at', { ascending: false }),
        supabase.from('stages').select('id, role_id, name'),
        supabase
          .from('interviews')
          .select(
            'stage_id, speaker, candidate_name, candidate_email, invited_at',
          ),
        supabase
          .from('scores')
          .select(
            'id, candidate_name, score, summary, status, created_at, stage_id',
          )
          .order('score', { ascending: false }),
        supabase
          .from('settings')
          .select('onboarding_completed')
          .single(),
      ])

    if (!settingsRes.data || !settingsRes.data.onboarding_completed) {
      router.push('/onboarding')
      return
    }

    // Subscription is the single source of truth for trial state.
    try {
      const { data: userData } = await supabase.auth.getUser()
      if (userData?.user?.id) {
        const ent = await getWorkspaceEntitlements(supabase, userData.user.id)
        setTrialData({
          planKey:         ent.subscription.plan_key,
          effectiveStatus: ent.effectiveStatus,
          periodEnd:       ent.period.end,
          candidatesUsed:  ent.candidates.used,
          candidatesTotal: ent.candidates.totalIncluded,
        })
      }
    } catch (err) {
      if (err?.code === SUBSCRIPTION_ERROR_CODES.NETWORK_ERROR) {
        console.warn('Dashboard: subscription network unavailable, continuing without trial state')
      } else {
        console.error('dashboard entitlements load:', err)
      }
    }

    const roles = rolesRes.data || []
    const stages = stagesRes.data || []
    const interviews = interviewsRes.data || []
    const scores = scoresRes.data || []

    const stageRole = {}
    stages.forEach((s) => {
      stageRole[s.id] = s.role_id
    })

    const roleTitle = {}
    const roleCategory = {}
    roles.forEach((r) => {
      roleTitle[r.id] = r.title
      roleCategory[r.id] = r.department
    })

    const invites = interviews.filter((r) => r.speaker === 'invite')
    const transcripts = interviews.filter(
      (r) => r.speaker !== 'invite' && r.candidate_name,
    )

    // ─── Invited list (unique per email, latest invite) ─────
    const inviteMap = {}
    invites.forEach((r) => {
      if (!r.candidate_email) return
      const key = r.candidate_email.toLowerCase()
      const rid = stageRole[r.stage_id]
      if (
        !inviteMap[key] ||
        new Date(r.invited_at || 0) > new Date(inviteMap[key].invited_at || 0)
      ) {
        inviteMap[key] = {
          email: r.candidate_email,
          roleTitle: rid ? roleTitle[rid] : null,
          invited_at: r.invited_at,
        }
      }
    })
    const invitedArr = Object.values(inviteMap).sort(
      (a, b) => new Date(b.invited_at || 0) - new Date(a.invited_at || 0),
    )

    // ─── Completed list (unique candidate per stage) ─────────
    const compMap = {}
    transcripts.forEach((r) => {
      const key = `${r.stage_id}|${r.candidate_name}`
      const rid = stageRole[r.stage_id]
      const scoreRow = scores.find((s) => s.candidate_name === r.candidate_name)
      if (!compMap[key]) {
        compMap[key] = {
          name: r.candidate_name,
          roleTitle: rid ? roleTitle[rid] : null,
          roleId: rid,
          score: scoreRow?.score ?? null,
          status: scoreRow?.status ?? null,
          stageId: r.stage_id,
          completedAt: scoreRow?.created_at ?? null,
        }
      }
    })
    const completedArr = Object.values(compMap).sort((a, b) => {
      const ta = new Date(a.completedAt || 0).getTime()
      const tb = new Date(b.completedAt || 0).getTime()
      if (ta !== tb) return tb - ta
      return (b.score ?? -1) - (a.score ?? -1)
    })

    // ─── Ongoing = invited but not completed ────────────────
    const completedNames = new Set(
      transcripts.map((r) => r.candidate_name?.toLowerCase()).filter(Boolean),
    )
    const ongoingArr = invitedArr.filter(
      (c) => !completedNames.has(c.email?.toLowerCase()),
    )

    setDrawerLists({
      invited: invitedArr,
      completed: completedArr,
      ongoing: ongoingArr,
    })

    // ─── Waiting on you: completed but no verdict yet ───────
    const waitingArr = completedArr.filter(
      (c) => !c.status || c.status === 'null' || c.status === '',
    )
    setWaitingList(waitingArr)

    // ─── Per-role rollup incl. "waiting" count ──────────────
    const roleMap = {}
    roles.forEach((r) => {
      roleMap[r.id] = {
        id: r.id,
        title: r.title || 'Untitled role',
        category: r.department || null,
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
        if (r.invited_at) {
          const t = new Date(r.invited_at).getTime()
          const cur = new Date(roleMap[rid].lastActivityAt || 0).getTime()
          if (t > cur) roleMap[rid].lastActivityAt = r.invited_at
        }
      }
    })

    // "Interviews today" per role, for the momentum card meta line.
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    transcripts.forEach((r) => {
      const rid = stageRole[r.stage_id]
      if (rid && roleMap[rid] && r.candidate_name) {
        const key = `${r.stage_id}|${r.candidate_name}`
        if (!roleMap[rid].completed.has(key)) {
          roleMap[rid].completed.add(key)
          const scoreRow = scores.find(
            (s) => s.candidate_name === r.candidate_name,
          )
          roleMap[rid].completedCandidates.push({
            name: r.candidate_name,
            status: scoreRow?.status ?? null,
          })
          if (scoreRow?.created_at) {
            const t = new Date(scoreRow.created_at).getTime()
            const cur = new Date(roleMap[rid].lastActivityAt || 0).getTime()
            if (t > cur) roleMap[rid].lastActivityAt = scoreRow.created_at
            if (t >= todayStart.getTime()) {
              roleMap[rid].interviewsToday = (roleMap[rid].interviewsToday || 0) + 1
            }
          }
        }
      }
    })

    const progress = Object.values(roleMap).map((r) => {
      const invitedCount = r.invited.size
      const completedCount = r.completed.size
      const waitingCount = r.completedCandidates.filter((c) => !c.status).length
      return {
        id: r.id,
        title: r.title,
        category: r.category,
        invited: invitedCount,
        completed: completedCount,
        ongoing: Math.max(invitedCount - completedCount, 0),
        waiting: waitingCount,
        lastActivityAt: r.lastActivityAt,
        interviewsToday: r.interviewsToday || 0,
      }
    })

    // Priority sort — waiting > 0 first, then ongoing > 0, else invited desc
    progress.sort((a, b) => {
      const pa = a.waiting > 0 ? 0 : a.ongoing > 0 ? 1 : 2
      const pb = b.waiting > 0 ? 0 : b.ongoing > 0 ? 1 : 2
      if (pa !== pb) return pa - pb
      if (b.waiting !== a.waiting) return b.waiting - a.waiting
      if (b.ongoing !== a.ongoing) return b.ongoing - a.ongoing
      return b.invited - a.invited
    })
    setRoleProgress(progress)

    // ─── Overall stats ──────────────────────────────────────
    const distinctInvited = new Set(
      invites
        .filter((r) => r.candidate_email)
        .map((r) => r.candidate_email.toLowerCase()),
    )
    const distinctCompleted = new Set(
      transcripts.map((r) => `${r.stage_id}|${r.candidate_name}`),
    )
    const scored = scores.filter((s) => typeof s.score === 'number')
    const avgScore = scored.length
      ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length
      : null

    // ─── v4 signals ────────────────────────────────────────
    // Everything the Hiring Operating System dashboard needs is
    // derived here so the render layer stays declarative.
    const nowTs = Date.now()
    const HOUR = 60 * 60 * 1000
    const DAY  = 24 * HOUR

    // Completed overnight — any score created after 8pm the previous
    // evening. Matches recruiter mental model of "arrived while I slept".
    const overnightCutoff = (() => {
      const d = new Date()
      d.setHours(20, 0, 0, 0)
      if (Date.now() < d.getTime()) d.setDate(d.getDate() - 1)
      return d.getTime()
    })()
    const completedOvernight = scores.filter(
      (s) => s.created_at && new Date(s.created_at).getTime() >= overnightCutoff,
    ).length

    // Offers pending — shortlisted candidates whose decision hasn't
    // been finalised. We treat status === 'shortlisted' as the offer-pending
    // state since Recrewt doesn't (yet) have an explicit offer table.
    const offersPending = scores.filter((s) => s.status === 'shortlisted').length

    // Stale invitees — invited > 3 days ago and never started. These
    // populate the "Needs your attention" section, and are excluded
    // from the priority queue by definition so we don't repeat rows.
    const staleCutoff = nowTs - 3 * DAY
    const staleInvitees = ongoingArr
      .filter((c) => c.invited_at && new Date(c.invited_at).getTime() <= staleCutoff)
      .slice(0, 6)

    // Upcoming interviews — invited today or yesterday and not yet
    // completed. We surface only tomorrow's and today's activity per
    // spec; older invites belong on /candidates.
    const twoDaysAgo = nowTs - 2 * DAY
    const upcomingInterviews = ongoingArr
      .filter((c) => c.invited_at && new Date(c.invited_at).getTime() >= twoDaysAgo)
      .sort((a, b) => new Date(b.invited_at) - new Date(a.invited_at))
      .slice(0, 5)

    // Recent activity — merged feed of completions + invites, newest
    // first. Bucketed by day at render time.
    const activityItems = []
    for (const s of scores.slice(0, 40)) {
      if (!s.created_at) continue
      activityItems.push({
        kind: 'completed',
        at: new Date(s.created_at),
        name: s.candidate_name,
        score: s.score,
        stageId: s.stage_id,
      })
    }
    for (const inv of invites.slice(0, 40)) {
      if (!inv.invited_at) continue
      const rid = stageRole[inv.stage_id]
      activityItems.push({
        kind: 'invited',
        at: new Date(inv.invited_at),
        email: inv.candidate_email,
        roleTitle: rid ? roleTitle[rid] : null,
      })
    }
    activityItems.sort((a, b) => b.at.getTime() - a.at.getTime())
    const recentActivity = activityItems.slice(0, 8)

    // Estimated review time — six minutes per waiting candidate is a
    // recruiter-friendly heuristic. Kept in the state so the hero copy
    // has real numbers.
    const estimatedMinutes = waitingArr.length * 6

    setStats({
      activeRoles: roles.length,
      invited: distinctInvited.size,
      completed: distinctCompleted.size,
      ongoing: Math.max(distinctInvited.size - distinctCompleted.size, 0),
      reviewsWaiting: waitingArr.length,
      offersPending,
      completedOvernight,
      estimatedMinutes,
      avgScore,
    })

    setNeedsAttentionList(staleInvitees)
    setUpcomingList(upcomingInterviews)
    setActivityList(recentActivity)

    // ─── Trend deltas (this week vs previous week) ──────────
    const now = Date.now()
    const weekMs = 7 * 24 * 60 * 60 * 1000

    const invitedThisWeek = invites.filter(
      (r) => r.invited_at && new Date(r.invited_at).getTime() >= now - weekMs,
    ).length
    const invitedPrevWeek = invites.filter((r) => {
      if (!r.invited_at) return false
      const t = new Date(r.invited_at).getTime()
      return t >= now - 2 * weekMs && t < now - weekMs
    }).length

    const completedThisWeek = scored.filter(
      (s) => s.created_at && new Date(s.created_at).getTime() >= now - weekMs,
    ).length
    const completedPrevWeek = scored.filter((s) => {
      if (!s.created_at) return false
      const t = new Date(s.created_at).getTime()
      return t >= now - 2 * weekMs && t < now - weekMs
    }).length

    const scoresThisWeek = scored.filter(
      (s) => s.created_at && new Date(s.created_at).getTime() >= now - weekMs,
    )
    const scoresPrevWeek = scored.filter((s) => {
      if (!s.created_at) return false
      const t = new Date(s.created_at).getTime()
      return t >= now - 2 * weekMs && t < now - weekMs
    })
    const avgThisWeek = scoresThisWeek.length
      ? scoresThisWeek.reduce((s, x) => s + x.score, 0) / scoresThisWeek.length
      : null
    const avgPrevWeek = scoresPrevWeek.length
      ? scoresPrevWeek.reduce((s, x) => s + x.score, 0) / scoresPrevWeek.length
      : null

    function trendFor(cur, prev, suffix = 'vs last week') {
      if (cur == null && prev == null) return null
      if (prev == null) {
        if (cur > 0) return { direction: 'up', label: `+${cur} this week` }
        return null
      }
      const diff = cur - prev
      if (Math.abs(diff) < 0.05)
        return { direction: 'flat', label: `no change ${suffix}` }
      const sign = diff > 0 ? '+' : '−'
      const magnitude =
        typeof diff === 'number' && !Number.isInteger(diff)
          ? Math.abs(diff).toFixed(1)
          : Math.abs(diff)
      return {
        direction: diff > 0 ? 'up' : 'down',
        label: `${sign}${magnitude} ${suffix}`,
      }
    }

    setTrends({
      invited: trendFor(invitedThisWeek, invitedPrevWeek),
      completed: trendFor(completedThisWeek, completedPrevWeek),
      avgScore: trendFor(avgThisWeek, avgPrevWeek),
    })

    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function confirmDeleteRole() {
    if (!pendingDelete) return
    const roleId = pendingDelete.id
    setDeleting(true)
    try {
      const { data: stageRows } = await supabase
        .from('stages')
        .select('id')
        .eq('role_id', roleId)
      const stageIds = (stageRows || []).map((s) => s.id)
      if (stageIds.length > 0) {
        await supabase.from('questions').delete().in('stage_id', stageIds)
        await supabase.from('interviews').delete().in('stage_id', stageIds)
        await supabase
          .from('scores')
          .delete()
          .in('stage_id', stageIds.map(String))
      }
      await supabase.from('stages').delete().eq('role_id', roleId)
      await supabase.from('roles').delete().eq('id', roleId)
      setPendingDelete(null)
      await loadData()
    } catch (e) {
      window.alert('Failed to delete: ' + (e?.message || 'Unknown error'))
    } finally {
      setDeleting(false)
    }
  }

  const trial = useMemo(() => {
    if (!trialData || trialData.planKey !== PLAN_KEYS.TRIAL) return null
    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(trialData.periodEnd) - new Date()) / (1000 * 60 * 60 * 24),
      ),
    )
    const total = trialData.candidatesTotal ?? 0
    const interviewsLeft = Math.max(0, total - (trialData.candidatesUsed || 0))
    const isExpired = trialData.effectiveStatus === SUBSCRIPTION_STATES.EXPIRED
    return {
      daysLeft,
      interviewsLeft,
      critical: interviewsLeft <= 1 || daysLeft <= 2,
      exhausted: isExpired || interviewsLeft === 0 || daysLeft === 0,
    }
  }, [trialData])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const totalRoles = roleProgress.length
  const totalWaiting = waitingList.length
  const initialRoleShow = 6
  const initialWaitingShow = 4

  return (
    <AppShell>
      <div className="max-w-[1180px] mx-auto">
        {upgraded && (
          <div className="mb-8 rounded-[14px] bg-white border border-[color:var(--color-rc-line)] px-5 py-3 flex items-center gap-3 [box-shadow:0_1px_2px_rgba(17,17,17,0.02)]">
            <CheckCircle2 size={16} className="text-[color:var(--color-rc-green)] shrink-0" aria-hidden="true" />
            <span className="text-[13.5px] text-[color:var(--color-rc-ink)]">
              You&rsquo;re upgraded. Welcome to the full Recrewt experience.
            </span>
          </div>
        )}

        {/* Usage warning — only when the workspace has burned ≥ 90%
            of its cycle allowance. Otherwise dashboard shows nothing
            about billing (that surface lives on /subscription). */}
        {trialData && trialData.candidatesTotal && (
          (trialData.candidatesUsed / trialData.candidatesTotal) >= 0.9
        ) && (
          <div className="mb-8 rounded-[12px] bg-white border border-[color:var(--color-rc-line)] px-4 py-3 flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)] shrink-0"
            />
            <span className="text-[13px] text-[color:var(--color-rc-ink)] min-w-0 flex-1">
              You&rsquo;ve used {trialData.candidatesUsed} of {trialData.candidatesTotal} candidates this cycle.
            </span>
            <Link
              href="/subscription"
              className="text-[12.5px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] transition-colors duration-150 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
            >
              Review plan &rarr;
            </Link>
          </div>
        )}

        {/* ─── 1. HEADER ─────────────────────────────────────
            32px Display greeting anchor + two 16px info lines. The
            greeting stays personal and conversational — never a
            landing-page hero. */}
        <header className="mb-8">
          {loading ? (
            <Display>{greeting}, {firstName || 'there'}.</Display>
          ) : totalWaiting === 0 && upcomingList.length === 0 ? (
            <>
              <Display>Everything looks good.</Display>
              <p className="mt-2 text-[16px] leading-[1.5] font-medium text-[color:var(--color-rc-muted)]">
                Nothing requires your attention today. Enjoy your day.
              </p>
            </>
          ) : (
            <>
              <Display>{greeting}, {firstName || 'there'}.</Display>
              <p className="mt-2 text-[16px] leading-[1.5] font-medium text-[color:var(--color-rc-ink)]">
                You have {totalWaiting > 0
                  ? `${totalWaiting} hiring decision${totalWaiting === 1 ? '' : 's'} waiting.`
                  : `${upcomingList.length} interview${upcomingList.length === 1 ? '' : 's'} in flight.`}
              </p>
              {totalWaiting > 0 && (
                <p className="mt-1 text-[16px] leading-[1.5] font-medium text-[color:var(--color-rc-muted)]">
                  {totalWaiting} candidate{totalWaiting === 1 ? '' : 's'} {totalWaiting === 1 ? 'is' : 'are'} ready for review today
                  {stats.completedOvernight > 0
                    ? ` · ${stats.completedOvernight} completed overnight`
                    : ''}.
                </p>
              )}
            </>
          )}
        </header>

        {/* ─── 1a. QUICK ACTIONS ─────────────────────────────
            Secondary-weight action strip. Chips are equal-height
            and equally-spaced; borders are softer than the KPI
            strip so the strip reads as "quick access" chrome. */}
        <div
          role="toolbar"
          aria-label="Quick actions"
          className="mb-8 flex flex-wrap items-center gap-2"
        >
          <QuickAction icon={<Plus size={14} />}      label="New role"           href="/roles" />
          <QuickAction icon={<Send size={14} />}      label="Invite candidates"  href="/roles" />
          <QuickAction icon={<Calendar size={14} />}  label="Schedule interview" href="/roles" />
          <QuickAction icon={<BarChart3 size={14} />} label="View reports"       href="/candidates" />
        </div>

        {/* ─── 2. KPI STRIP ──────────────────────────────── */}
        <section className="mb-10 md:mb-12">
          {loading ? (
            <LoadingBlock />
          ) : (
            <KPIStrip
              cells={[
                { label: 'Active roles',    value: stats.activeRoles,     onClick: () => setDrawer('roles') },
                { label: 'Candidates',      value: stats.invited,         onClick: () => setDrawer('invited') },
                { label: 'Reviews waiting', value: stats.reviewsWaiting,  onClick: () => setDrawer('waiting') },
                { label: 'Offers pending',  value: stats.offersPending },
              ]}
            />
          )}
        </section>

        {/* ─── 3. PRIORITY QUEUE ─────────────────────────── */}
        <section className="mb-10 md:mb-12">
          <div className="flex items-end justify-between gap-4 mb-4">
            <div className="min-w-0">
              <SectionLabel>Priority queue</SectionLabel>
              <h2
                className="mt-2 text-[18px] leading-[1.2] font-semibold tracking-[-0.018em] text-[color:var(--color-rc-ink)]"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                Priority Queue
              </h2>
            </div>
            {!loading && totalWaiting > initialWaitingShow && (
              <Button variant="ghost" size="sm" onClick={() => setDrawer('waiting')} iconRight={<ChevronRight size={14} />}>
                See all {totalWaiting}
              </Button>
            )}
          </div>
          {loading ? (
            <LoadingBlock />
          ) : totalWaiting === 0 ? (
            <QuietEmpty
              title="No candidates require review."
              body="You're completely caught up."
            />
          ) : (
            <ul className="grid divide-y divide-[color:var(--color-rc-line)] border-y border-[color:var(--color-rc-line)]">
              {waitingList.slice(0, initialWaitingShow).map((c) => (
                <PriorityQueueRow
                  key={`${c.stageId}-${c.name}`}
                  name={c.name}
                  roleTitle={c.roleTitle}
                  score={c.score}
                  completedAt={c.completedAt}
                  stageId={c.stageId}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ─── 4. CONTINUE WORKING ───────────────────────── */}
        <section className="mb-10 md:mb-12">
          <div className="flex items-end justify-between gap-4 mb-5">
            <div className="min-w-0">
              <SectionLabel>Continue working</SectionLabel>
              <h2
                className="mt-2 text-[18px] leading-[1.2] font-semibold tracking-[-0.018em] text-[color:var(--color-rc-ink)]"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                Roles you were on
              </h2>
            </div>
            {!loading && totalRoles > initialRoleShow && (
              <Button variant="ghost" size="sm" onClick={() => setDrawer('roles')} iconRight={<ChevronRight size={14} />}>
                See all {totalRoles}
              </Button>
            )}
          </div>

          {loading ? (
            <LoadingBlock />
          ) : totalRoles === 0 ? (
            <QuietEmpty
              title="No roles yet."
              body="Create your first role to start inviting candidates."
              action={
                <Button as="a" href="/roles" variant="primary" size="sm" iconLeft={<Plus size={14} />}>
                  Create a role
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {roleProgress.slice(0, initialRoleShow).map((r) => (
                <MomentumRoleCard key={r.id} role={r} />
              ))}
            </div>
          )}
        </section>

        {/* ─── 5. NEEDS YOUR ATTENTION ───────────────────── */}
        <section className="mb-10 md:mb-12">
          <div className="mb-5">
            <SectionLabel>Needs your attention</SectionLabel>
            <h2
              className="mt-2 text-[18px] leading-[1.2] font-semibold tracking-[-0.018em] text-[color:var(--color-rc-ink)]"
              style={{ fontFamily: 'var(--font-editorial), inherit' }}
            >
              Invitees who haven&rsquo;t responded
            </h2>
          </div>

          {loading ? (
            <LoadingBlock />
          ) : needsAttentionList.length === 0 ? (
            <QuietEmpty
              title="Nothing is stuck right now."
              body="Invitees are moving through the pipeline as expected."
            />
          ) : (
            <ul className="grid divide-y divide-[color:var(--color-rc-line)] border-y border-[color:var(--color-rc-line)]">
              {needsAttentionList.map((c, i) => (
                <NeedsAttentionRow
                  key={`${c.email}-${i}`}
                  email={c.email}
                  roleTitle={c.roleTitle}
                  invited_at={c.invited_at}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ─── 6. UPCOMING INTERVIEWS ────────────────────── */}
        <section className="mb-10 md:mb-12">
          <div className="mb-5">
            <SectionLabel>Upcoming interviews</SectionLabel>
            <h2
              className="mt-2 text-[18px] leading-[1.2] font-semibold tracking-[-0.018em] text-[color:var(--color-rc-ink)]"
              style={{ fontFamily: 'var(--font-editorial), inherit' }}
            >
              Today and tomorrow
            </h2>
          </div>

          {loading ? (
            <LoadingBlock />
          ) : upcomingList.length === 0 ? (
            <QuietEmpty
              title="No interviews today."
              body="Everything is running smoothly."
            />
          ) : (
            <ul className="grid divide-y divide-[color:var(--color-rc-line)] border-y border-[color:var(--color-rc-line)]">
              {upcomingList.map((c, i) => (
                <UpcomingInterviewRow
                  key={`${c.email}-${i}`}
                  email={c.email}
                  roleTitle={c.roleTitle}
                  invited_at={c.invited_at}
                />
              ))}
            </ul>
          )}
        </section>

        {/* ─── 7. RECENT ACTIVITY ────────────────────────── */}
        <section className="mb-10 md:mb-12">
          <div className="mb-6">
            <SectionLabel>Recent activity</SectionLabel>
          </div>
          {loading ? (
            <LoadingBlock />
          ) : activityList.length === 0 ? (
            <QuietEmpty
              title="Nothing has happened yet."
              body="Recent interview and invite events will appear here as your pipeline moves."
            />
          ) : (
            <RecentActivityTimeline items={activityList} />
          )}
        </section>

        <Drawer
          open={drawer === 'waiting'}
          onClose={() => setDrawer(null)}
          side="right"
          size="clamp(360px,44vw,560px)"
          title="Waiting on you"
          description={`${totalWaiting} candidate${totalWaiting === 1 ? '' : 's'} · Sorted newest first`}
        >
          {waitingList.length === 0 ? (
            <EmptyState bare icon={<Sparkles size={20} />} title="You're completely caught up." description="No candidates are waiting for your review." />
          ) : (
            <div className="grid gap-3">
              {waitingList.map((c) => (
                <WaitingRow key={`${c.stageId}-${c.name}-drawer`} {...c} />
              ))}
            </div>
          )}
        </Drawer>

        <Drawer
          open={drawer === 'roles'}
          onClose={() => setDrawer(null)}
          side="right"
          size="clamp(360px,44vw,560px)"
          title="All roles"
          description={`${totalRoles} role${totalRoles === 1 ? '' : 's'}`}
        >
          {roleProgress.length === 0 ? (
            <EmptyState bare icon={<Briefcase size={20} />} title="Nothing here yet." description="Create your first role to start inviting candidates." />
          ) : (
            <div className="grid gap-4">
              {roleProgress.map((r) => (
                <PriorityRoleCard key={r.id + '-drawer'} role={r} onDelete={setPendingDelete} />
              ))}
            </div>
          )}
        </Drawer>

        <Drawer
          open={drawer === 'invited'}
          onClose={() => setDrawer(null)}
          side="right"
          size="clamp(360px,44vw,560px)"
          title={`Candidates invited (${stats.invited})`}
        >
          {drawerLists.invited.length === 0 ? (
            <EmptyState bare icon={<Send size={20} />} title="No invites yet." description="Invite a candidate from any role to see them here." />
          ) : (
            <div className="grid gap-2">
              {drawerLists.invited.map((c, i) => (
                <SimpleRow
                  key={c.email + i}
                  email={c.email}
                  meta={c.roleTitle}
                  extra={c.invited_at ? new Date(c.invited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null}
                />
              ))}
            </div>
          )}
        </Drawer>

        <Drawer
          open={drawer === 'completed'}
          onClose={() => setDrawer(null)}
          side="right"
          size="clamp(360px,44vw,560px)"
          title={`Interviews complete (${stats.completed})`}
        >
          {drawerLists.completed.length === 0 ? (
            <EmptyState bare icon={<CheckCircle2 size={20} />} title="No completed interviews yet." description="Once candidates finish, they appear here." />
          ) : (
            <div className="grid gap-2">
              {drawerLists.completed.map((c, i) => (
                <SimpleRow
                  key={`${c.stageId}-${c.name}-${i}`}
                  name={c.name}
                  meta={c.roleTitle}
                  score={c.score}
                  href={`/interview/${c.stageId}/transcript`}
                />
              ))}
            </div>
          )}
        </Drawer>

        <Drawer
          open={drawer === 'ongoing'}
          onClose={() => setDrawer(null)}
          side="right"
          size="clamp(360px,44vw,560px)"
          title={`In progress (${stats.ongoing})`}
        >
          {drawerLists.ongoing.length === 0 ? (
            <EmptyState bare icon={<Loader size={20} />} title="Everything's settled." description="No interviews are mid-flight right now." />
          ) : (
            <div className="grid gap-2">
              {drawerLists.ongoing.map((c, i) => (
                <SimpleRow
                  key={c.email + i}
                  email={c.email}
                  meta={c.roleTitle}
                  extra={c.invited_at ? new Date(c.invited_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : null}
                />
              ))}
            </div>
          )}
        </Drawer>

        <Drawer
          open={drawer === 'score'}
          onClose={() => setDrawer(null)}
          side="right"
          size="clamp(360px,44vw,560px)"
          title="Scored candidates"
          description={stats.avgScore != null ? `Average ${stats.avgScore.toFixed(1)} / 10` : undefined}
        >
          {drawerLists.completed.filter((c) => c.score != null).length === 0 ? (
            <EmptyState bare icon={<Star size={20} />} title="No scores yet." description="Scores appear after interviews complete." />
          ) : (
            <div className="grid gap-2">
              {drawerLists.completed.filter((c) => c.score != null).map((c, i) => (
                <SimpleRow
                  key={`${c.stageId}-${c.name}-score-${i}`}
                  name={c.name}
                  meta={c.roleTitle}
                  score={c.score}
                  href={`/interview/${c.stageId}/transcript`}
                />
              ))}
            </div>
          )}
        </Drawer>

        <Modal
          open={!!pendingDelete}
          onClose={() => !deleting && setPendingDelete(null)}
          title="Delete role?"
          description={pendingDelete ? `"${pendingDelete.title}" and all its interviews, invites, and scores will be permanently removed.` : ''}
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
          This can&rsquo;t be undone.

        </Modal>
      </div>
    </AppShell>
  )
}
