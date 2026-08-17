'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ArrowLeft, ChevronRight, ChevronDown, MoreHorizontal, Sparkles, ThumbsUp,
  ThumbsDown, Pause, Play, Download, Copy, CheckCircle2, XCircle, Circle,
  AlertTriangle, Clock, Mic, MessageSquare, Gauge, Smile, Info, FileText,
  RefreshCcw, User, ExternalLink,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import QueueNav, { readReviewQueue } from '@/components/AppShell/ReviewQueue'
import { SkeletonLine } from '@/components/AppShell/Skeleton'
import {
  Button, Modal, EmptyState, Spinner, TextField, ScoreBadge, StatusBadge, Toast,
} from '@/components/ui'

/* ─────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────── */

// Recommendation bands (score is 0-10).  Server derives these too;
// duplicated here so the UI can render even before the API round-trip.
const RECOMMENDATION_LABEL = {
  'strong-hire': 'Strong hire',
  'hire':        'Hire',
  'hold':        'Hold',
  'reject':      'Reject',
}

function recommendationFromScore(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return null
  if (s >= 8.5) return 'strong-hire'
  if (s >= 6.5) return 'hire'
  if (s >= 4.5) return 'hold'
  return 'reject'
}

function confidenceBand(pct) {
  const n = Number(pct)
  if (!Number.isFinite(n)) return null
  if (n >= 85) return { key: 'high',  label: 'High' }
  if (n >= 65) return { key: 'fair',  label: 'Fair' }
  if (n >= 45) return { key: 'mixed', label: 'Mixed' }
  return { key: 'low', label: 'Low' }
}

const CONFIDENCE_COPY_FALLBACK = {
  high:  'Evidence is strong and consistent. Act on the recommendation.',
  fair:  'A couple of soft signals. Skim the transcript before deciding.',
  mixed: 'Evidence is uneven. A second review is worth your time.',
  low:   'The AI is not confident. Watch the interview yourself before deciding.',
}

const SESSION_KEY = 'recrewt:review:v2'

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────── */

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function scoreDisplay(score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return null
  // Store & display 0-10 with one decimal place.
  return (Math.round(n * 10) / 10).toFixed(1)
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

function formatClockTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatShortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `Today • ${formatClockTime(iso)}`
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday • ${formatClockTime(iso)}`
  return `${d.toLocaleDateString([], { day: 'numeric', month: 'short' })} • ${formatClockTime(iso)}`
}

function formatDurationMs(ms) {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const totalSec = Math.round(ms / 1000)
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  if (mins === 0) return `${secs}s`
  if (secs === 0) return `${mins} min`
  return `${mins} min ${secs}s`
}

function formatSeconds(sec) {
  const s = Math.round(Number(sec) || 0)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)} min ${s % 60}s`
}

function stripSpeakerLine(text) {
  if (!text) return ''
  return String(text).trim()
}

/* ─────────────────────────────────────────────────────────────
 * Presentational primitives (shared editorial vocabulary)
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
        'text-[22px] md:text-[24px] leading-[1.15] font-semibold tracking-[-0.025em] text-[color:var(--color-rc-ink)] ' +
        className
      }
      style={{ fontFamily: 'var(--font-editorial), inherit' }}
    >
      {children}
    </h2>
  )
}

/**
 * LoadingBlock — Transcript page skeleton. Mirrors the loaded shape:
 * candidate header (name + role + status), an evaluation card,
 * a two-column body with argument + timeline. Prevents the huge
 * vertical shift when the real content lands.
 */
function LoadingBlock() {
  return (
    <div aria-hidden="true" className="rc-skeleton">
      {/* Verdict header */}
      <div className="mb-8">
        <SkeletonLine className="w-36" height="h-2.5" />
        <div className="mt-3">
          <SkeletonLine className="w-2/3 max-w-[420px]" height="h-8" />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <SkeletonLine className="w-24" height="h-3" />
          <SkeletonLine className="w-32" height="h-3" />
        </div>
      </div>

      {/* AI Evaluation card */}
      <div className="mt-10 rounded-[18px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] p-5 md:p-6">
        <SkeletonLine className="w-32" height="h-2.5" />
        <div className="mt-3">
          <SkeletonLine className="w-1/2 max-w-[280px]" height="h-4" />
        </div>
        <div className="mt-4 space-y-2">
          <SkeletonLine className="w-full" height="h-3" />
          <SkeletonLine className="w-5/6" height="h-3" />
        </div>
      </div>

      {/* Two-column body */}
      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] p-5">
            <SkeletonLine className="w-40" height="h-4" />
            <div className="mt-4 space-y-2">
              <SkeletonLine className="w-full" height="h-3" />
              <SkeletonLine className="w-11/12" height="h-3" />
              <SkeletonLine className="w-4/6" height="h-3" />
            </div>
          </div>
          <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] p-5">
            <SkeletonLine className="w-32" height="h-4" />
            <div className="mt-4 space-y-2">
              <SkeletonLine className="w-full" height="h-3" />
              <SkeletonLine className="w-4/5" height="h-3" />
            </div>
          </div>
        </div>
        <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] p-5">
          <SkeletonLine className="w-24" height="h-3" />
          <div className="mt-4 space-y-3">
            <SkeletonLine className="w-full" height="h-3" />
            <SkeletonLine className="w-3/4" height="h-3" />
            <SkeletonLine className="w-2/3" height="h-3" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Divider() {
  return <div className="my-8 h-px bg-[color:var(--color-rc-line)]" aria-hidden="true" />
}


/**
 * StickyVerdictBar — floats a compact bar with the four hiring
 * actions (Shortlist / Hold / Reject / Archive) once the recruiter
 * scrolls past the header's action row. Uses an IntersectionObserver
 * on the header's sentinel so we never guess at scroll position.
 * Hidden completely on print and when the sentinel is in view.
 */
function StickyVerdictBar({ currentStatus, updatingStatus, onSetStatus, onArchive, archiving }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const sentinel = document.querySelector('[data-sentinel="verdict"]')
    if (!sentinel) return
    const obs = new IntersectionObserver(
      ([entry]) => setShown(!entry.isIntersecting),
      { rootMargin: '0px 0px -80% 0px', threshold: 0 },
    )
    obs.observe(sentinel)
    return () => obs.disconnect()
  }, [])
  const btn = (target, label, Icon, variant) => {
    const active = currentStatus === target
    return (
      <button
        type="button"
        onClick={() => onSetStatus(target)}
        disabled={updatingStatus}
        aria-pressed={active}
        aria-label={active ? `${label} — currently selected` : `Mark as ${label}`}
        className={
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-medium ' +
          'transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
          (active
            ? variant === 'danger'
              ? 'bg-[color:var(--color-rc-red)] text-white hover:bg-[color:var(--color-rc-red)]/90'
              : 'bg-white text-[color:var(--color-rc-ink)]'
            : 'text-white/85 hover:text-white hover:bg-white/10')
        }
      >
        <Icon size={13} aria-hidden="true" /> {label}
      </button>
    )
  }
  if (!shown) return null
  return (
    <div
      role="toolbar"
      aria-label="Hiring decision"
      className={
        'fixed z-30 left-1/2 -translate-x-1/2 bottom-6 print:hidden ' +
        'flex items-center gap-1 h-12 pl-2 pr-1.5 rounded-[14px] ' +
        'bg-[color:var(--color-rc-ink)] text-white ' +
        '[box-shadow:0_24px_48px_-20px_rgba(17,17,17,0.4)] rc-bulk-bar-in whitespace-nowrap'
      }
    >
      {btn('shortlisted', 'Shortlist', ThumbsUp,   'primary')}
      {btn('on-hold',     'Hold',      Pause,      'primary')}
      {btn('rejected',    'Reject',    ThumbsDown, 'danger')}
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-white/15" />
      <button
        type="button"
        onClick={onArchive}
        disabled={archiving}
        aria-label="Archive candidate"
        className={
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-medium ' +
          'text-white/85 hover:text-white hover:bg-white/10 transition-colors duration-150 ' +
          'disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
      >
        {archiving ? 'Archiving…' : 'Archive'}
      </button>
    </div>
  )
}

/**
 * SectionNavigator — floating right-side nav for long transcripts.
 * Hidden entirely when there are fewer than 3 sections. Uses
 * scrollIntoView({behavior:'smooth'}) on click and an
 * IntersectionObserver to highlight the currently-visible section.
 */
function SectionNavigator({ sections }) {
  const [active, setActive] = useState(null)
  useEffect(() => {
    if (!sections || sections.length < 3) return
    const observers = []
    const seenIds = new Set()
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(s.id)
        },
        { rootMargin: '-30% 0px -60% 0px', threshold: 0 },
      )
      obs.observe(el)
      observers.push(obs)
      seenIds.add(s.id)
    })
    return () => observers.forEach((o) => o.disconnect())
  }, [sections])
  if (!sections || sections.length < 3) return null
  return (
    <nav
      aria-label="Section navigator"
      className={
        'hidden xl:block fixed right-6 top-1/2 -translate-y-1/2 z-20 print:hidden ' +
        'rounded-[12px] bg-white/90 backdrop-blur border border-[color:var(--color-rc-line)] ' +
        'p-1.5 [box-shadow:0_20px_40px_-20px_rgba(17,17,17,0.12)]'
      }
    >
      <ul className="grid gap-0.5 max-h-[70vh] overflow-y-auto">
        {sections.map((s) => {
          const isActive = active === s.id
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  const el = document.getElementById(s.id)
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                aria-current={isActive ? 'true' : undefined}
                className={
                  'w-full text-left flex items-center gap-2 h-7 px-2 rounded-[6px] text-[12px] ' +
                  'transition-colors duration-150 ' +
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
                  (isActive
                    ? 'bg-[color:var(--color-rc-ink)] text-white font-medium'
                    : 'text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]')
                }
              >
                <span
                  aria-hidden="true"
                  className={
                    'h-1.5 w-1.5 rounded-full shrink-0 ' +
                    (isActive ? 'bg-[color:var(--color-rc-yellow)]' : 'bg-[color:var(--color-rc-muted)]/40')
                  }
                />
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * InQueueGate — renders children only when the current candidate is
 * NOT part of an active review queue. Used to suppress the standalone
 * "Back to role" link when QueueNav is already handling back nav.
 */
function InQueueGate({ stageId, candidateName, children }) {
  const [inQueue, setInQueue] = useState(false)
  useEffect(() => {
    const q = readReviewQueue()
    if (!Array.isArray(q) || q.length === 0) { setInQueue(false); return }
    const sid = String(stageId || '')
    const name = String(candidateName || '')
    setInQueue(q.some((it) => String(it.stageId) === sid && String(it.candidateName) === name))
  }, [stageId, candidateName])
  if (inQueue) return null
  return children
}

/* ─────────────────────────────────────────────────────────────
 * AnalysisStateChip — communicates AI analysis phase honestly
 * when there is no numeric score yet. Four states:
 *
 *   Waiting for Analysis   — score row not created yet (rare)
 *   Running Analysis       — scoring is in flight (rescoring=true)
 *   Analysis Complete      — never shown by this chip (the number
 *                             communicates completion on its own)
 *   Failed Analysis        — set explicitly via `error` prop
 *
 * The chip replaces the misleading "0.0" empty state that previously
 * suggested a candidate had actually scored zero.
 * ────────────────────────────────────────────────────────── */

function AnalysisStateChip({ rescoring, error }) {
  let label, tone
  if (error) {
    label = 'Failed Analysis'
    tone = 'text-[color:var(--color-rc-red)]'
  } else if (rescoring) {
    label = 'Running Analysis…'
    tone = 'text-[color:var(--color-rc-blue)]'
  } else {
    label = 'Not Yet Scored'
    tone = 'text-[color:var(--color-rc-muted)]'
  }
  return (
    <div className={'mt-3 inline-flex items-center gap-2 text-[11.5px] uppercase tracking-[0.14em] font-semibold ' + tone}>
      {rescoring && !error ? (
        <span
          aria-hidden="true"
          className="h-2 w-2 rounded-full bg-[color:var(--color-rc-blue)] animate-pulse"
        />
      ) : (
        <span
          aria-hidden="true"
          className={'h-2 w-2 rounded-full ' + (error ? 'bg-[color:var(--color-rc-red)]' : 'bg-[color:var(--color-rc-muted)]/50')}
        />
      )}
      {label}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * RecommendationLabelChip
 * ────────────────────────────────────────────────────────── */

function RecommendationLabelChip({ recommendation, size = 'md' }) {
  if (!recommendation) return null
  const label = RECOMMENDATION_LABEL[recommendation] || 'Pending'
  const isPositive = recommendation === 'strong-hire' || recommendation === 'hire'
  const isHold = recommendation === 'hold'
  const isNeg = recommendation === 'reject'

  const base = size === 'lg'
    ? 'text-[16px] md:text-[17px] font-semibold tracking-[-0.015em]'
    : 'text-[13px] font-semibold'

  const color = isPositive
    ? 'text-[color:var(--color-rc-green)]'
    : isHold
    ? 'text-[color:var(--color-rc-warm)]'
    : isNeg
    ? 'text-[color:var(--color-rc-red)]'
    : 'text-[color:var(--color-rc-ink)]'

  return (
    <span
      className={base + ' ' + color}
      style={{ fontFamily: 'var(--font-editorial), inherit' }}
      aria-label={`AI recommendation: ${label}`}
    >
      {label}
    </span>
  )
}

/* ─────────────────────────────────────────────────────────────
 * ConfidenceBadge — the signature feature.
 * Shows:  High · 94% · calibration copy · (click) reasons popover
 * ────────────────────────────────────────────────────────── */

function ConfidenceBadge({ confidence, reasons, copy }) {
  const [open, setOpen] = useState(false)
  const badgeRef = useRef(null)
  const popoverRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    function onDoc(e) {
      if (popoverRef.current?.contains(e.target)) return
      if (badgeRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const band = confidenceBand(confidence)
  const calibrationCopy = copy || (band ? CONFIDENCE_COPY_FALLBACK[band.key] : '')
  const hasReasons = Array.isArray(reasons) && reasons.length > 0

  if (confidence == null) {
    return (
      <div className="mt-4 rounded-[14px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] px-4 py-3">
        <SectionLabel>Confidence</SectionLabel>
        <p className="mt-2 text-[13px] text-[color:var(--color-rc-muted)] italic">
          Not yet calculated. Run AI scoring to compute.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <button
        ref={badgeRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="confidence-popover"
        aria-label={`AI Confidence ${band?.label || ''} at ${confidence} percent — expand to see reasons`}
        className="w-full text-left rounded-[16px] bg-white border border-[color:var(--color-rc-line)] p-5 hover:border-[color:var(--color-rc-line-hover)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <SectionLabel>AI Confidence</SectionLabel>
            <div className="mt-2.5 flex items-baseline gap-2">
              <span
                className="text-[20px] font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                {band?.label || ''}
              </span>
              <span className="text-[13px] font-semibold text-[color:var(--color-rc-muted)] tabular-nums">
                · {Math.round(confidence)}%
              </span>
            </div>
            <p className="mt-2 text-[13px] text-[color:var(--color-rc-muted)] leading-relaxed max-w-[46ch]">
              {calibrationCopy}
            </p>
          </div>
          {hasReasons && (
            <ChevronDown
              size={14}
              aria-hidden="true"
              className={
                'shrink-0 mt-1 text-[color:var(--color-rc-muted)] transition-transform duration-150 ' +
                (open ? 'rotate-180' : 'rotate-0')
              }
            />
          )}
        </div>
      </button>

      {open && hasReasons && (
        <div
          id="confidence-popover"
          ref={popoverRef}
          role="region"
          aria-label="Confidence reasons"
          className="mt-2 rounded-[14px] bg-white border border-[color:var(--color-rc-line)] p-4 [box-shadow:0_20px_36px_-24px_rgba(17,17,17,0.14)]"
        >
          <SectionLabel>Why</SectionLabel>
          <ul className="mt-3 grid gap-1.5" role="list">
            {reasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-[13.5px] leading-relaxed">
                <span
                  aria-hidden="true"
                  className={
                    'mt-0.5 inline-flex h-4 w-4 shrink-0 rounded-full items-center justify-center text-[11px] font-semibold ' +
                    (r.polarity === '+' || r.polarity === 'plus'
                      ? 'bg-[rgb(42_157_87_/_0.10)] text-[color:var(--color-rc-green)]'
                      : 'bg-[rgb(199_75_58_/_0.06)] text-[color:var(--color-rc-red)]')
                  }
                >
                  {r.polarity === '+' || r.polarity === 'plus' ? '+' : '−'}
                </span>
                <span className="text-[color:var(--color-rc-ink)]">{r.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * VerdictHeader — identity + score + recommendation + confidence
 * + primary action row.
 * ────────────────────────────────────────────────────────── */

function OverflowMenu({ onReScore, onExport, rescoring, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    function onDoc(e) { if (!ref.current?.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        className="h-10 w-10 grid place-items-center rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] border border-[color:var(--color-rc-line)] bg-white disabled:opacity-60"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-48 z-30 rounded-[12px] bg-white border border-[color:var(--color-rc-line)] [box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)] py-1.5">
          <button
            type="button" role="menuitem"
            onClick={() => { setOpen(false); onReScore() }}
            className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
          >
            <RefreshCcw size={13} aria-hidden="true" />
            {rescoring ? 'Re-scoring…' : 'Re-score with AI'}
          </button>
          <button
            type="button" role="menuitem"
            onClick={() => { setOpen(false); onExport() }}
            className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
          >
            <Download size={13} aria-hidden="true" /> Export PDF
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * HeaderChip — small pill for surfacing candidate facts inline
 * under the name. Colour semantics follow the shared status dot
 * palette (green success, amber attention, blue info, red action,
 * muted neutral). Keeps the header dense without redesigning.
 */
function HeaderChip({ dot = 'muted', label, value }) {
  const dotClass =
    dot === 'green'  ? 'bg-[color:var(--color-rc-green)]' :
    dot === 'amber'  ? 'bg-[color:var(--color-rc-yellow)]' :
    dot === 'blue'   ? 'bg-[color:var(--color-rc-blue)]' :
    dot === 'purple' ? 'bg-[color:var(--color-rc-purple)]' :
    dot === 'red'    ? 'bg-[color:var(--color-rc-red)]' :
                       'bg-[color:var(--color-rc-muted)]'
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 pl-1.5 pr-2 rounded-full bg-[color:var(--color-rc-soft)] text-[11.5px] whitespace-nowrap"
      title={`${label}: ${value}`}
    >
      <span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full ' + dotClass} />
      <span className="text-[color:var(--color-rc-muted)] uppercase tracking-[0.12em] font-semibold text-[10.5px]">
        {label}
      </span>
      <span className="text-[color:var(--color-rc-ink)] font-medium">{value}</span>
    </span>
  )
}

/** Map the current DB state into a hiring-decision chip label. Renamed
 *  from "Stage" to "Decision" because the meta line already uses the
 *  word "stage" for the interview stage — recruiters found the two
 *  meanings confusing. */
function hiringStageChip(currentStatus) {
  switch (currentStatus) {
    case 'shortlisted': return { label: 'Decision', value: 'Shortlisted',    dot: 'purple' }
    case 'on-hold':     return { label: 'Decision', value: 'On Hold',        dot: 'muted' }
    case 'rejected':    return { label: 'Decision', value: 'Rejected',       dot: 'muted' }
    default:            return { label: 'Decision', value: 'Awaiting',       dot: 'amber' }
  }
}

/** Map recommendation code → user-facing chip. */
function recommendationChip(rec) {
  if (!rec) return null
  const label = RECOMMENDATION_LABEL[rec] || null
  if (!label) return null
  if (rec === 'strong-hire' || rec === 'hire') return { label: 'AI', value: label, dot: 'green' }
  if (rec === 'hold') return { label: 'AI', value: label, dot: 'amber' }
  if (rec === 'reject') return { label: 'AI', value: label, dot: 'red' }
  return { label: 'AI', value: label, dot: 'muted' }
}

/** Interview status derived from what the DB actually has. */
function interviewStatusChip(score, hasTranscript) {
  if (score != null) return { label: 'Interview', value: 'Analyzed',  dot: 'green' }
  if (hasTranscript) return { label: 'Interview', value: 'Completed', dot: 'blue' }
  return                    { label: 'Interview', value: 'Pending',   dot: 'muted' }
}

function VerdictHeader({
  candidateName, roleTitle, stageName, completedAt, startedAt, durationMs,
  score, recommendation, currentStatus, confidence, confidenceReasons, confidenceCopy,
  hasTranscript, onSetStatus, updatingStatus, onReScore, onExport, rescoring, canScore,
}) {
  const scoreText = scoreDisplay(score)
  const rec = recommendation || recommendationFromScore(score)
  const stageChip = hiringStageChip(currentStatus)
  const recChip = recommendationChip(rec)
  const interviewChip = interviewStatusChip(score, hasTranscript)
  // The old "Applied" chip used the interview-start timestamp, which
  // isn't when the candidate applied — recruiters read it and were
  // misled. Since the interview date already sits in the meta line
  // and the Interview chip communicates state, we drop it.
  const resumeChip = { label: 'Resume', value: 'Not uploaded', dot: 'muted' }
  const decisionButton = (target, label, Icon, activeVariant, inactiveClasses) => {
    const active = currentStatus === target
    return (
      <Button
        variant={active ? activeVariant : 'secondary'}
        size="md"
        iconLeft={<Icon size={14} />}
        onClick={() => onSetStatus(target)}
        disabled={updatingStatus}
        aria-pressed={active}
        aria-label={active ? `${label} — currently selected` : `Mark as ${label}`}
        className={active ? '' : inactiveClasses || ''}
      >
        {label}
      </Button>
    )
  }
  return (
    <header>
      <SectionLabel>Review</SectionLabel>
      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="min-w-0">
          <h1
            className="text-[36px] md:text-[52px] leading-[1.02] font-semibold tracking-[-0.04em] text-[color:var(--color-rc-ink)] max-w-[22ch]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {candidateName || 'Candidate'}
          </h1>
          <p className="mt-3 text-[14px] text-[color:var(--color-rc-muted)]">
            {/* Meta prose — role · interview stage · duration only.
                "Completed X ago" was removed because the Interview
                chip below already communicates state and freshness. */}
            {[
              roleTitle || null,
              stageName || null,
              durationMs ? formatDurationMs(durationMs) : null,
            ].filter(Boolean).join(' · ')}
          </p>
          {/* Fact-chip row — Interview · Decision · AI · Resume. */}
          <div className="mt-4 flex items-center flex-wrap gap-1.5">
            {interviewChip && <HeaderChip {...interviewChip} />}
            {stageChip     && <HeaderChip {...stageChip} />}
            {recChip       && <HeaderChip {...recChip} />}
            {resumeChip    && <HeaderChip {...resumeChip} />}
          </div>
        </div>

        {/* Compact score marker in the header — Overall score only.
            Recommendation and Confidence live in the AI Evaluation
            card below so they don't render twice for the recruiter's
            first read. */}
        <div className="md:min-w-[220px] md:max-w-[260px]">
          <div className="rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6 [box-shadow:0_1px_2px_rgba(17,17,17,0.02),0_24px_44px_-40px_rgba(17,17,17,0.07)]">
            <SectionLabel>Score</SectionLabel>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span
                className="text-[52px] md:text-[60px] leading-none font-semibold tracking-[-0.038em] text-[color:var(--color-rc-ink)] tabular-nums"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                {scoreText || '—'}
              </span>
              {scoreText && (
                <span className="text-[16px] text-[color:var(--color-rc-muted)] font-medium">/ 10</span>
              )}
            </div>
            {/* Analysis state chip only when there's no numeric score.
                Once scored, the AI Evaluation card carries meaning
                (recommendation + confidence + strengths + concerns). */}
            {!scoreText && <AnalysisStateChip rescoring={rescoring} />}
          </div>
        </div>
      </div>

      {/* Action row */}
      <div id="verdict-actions" className="mt-6 flex items-center flex-wrap gap-2">
        {decisionButton('shortlisted', 'Shortlist', ThumbsUp, 'primary')}
        {decisionButton('on-hold',     'Hold',      Pause,   'primary')}
        {decisionButton('rejected',    'Reject',    ThumbsDown, 'danger')}
        <OverflowMenu onReScore={onReScore} onExport={onExport} rescoring={rescoring} disabled={!canScore} />
      </div>
      {/* Sentinel below the action row — the sticky bar shows only
          when this element scrolls out of view. */}
      <div aria-hidden="true" data-sentinel="verdict" className="h-px w-full" />
    </header>
  )
}


/* ─────────────────────────────────────────────────────────────
 * AI Hiring Summary (executive) + AI Summary paragraph
 * ────────────────────────────────────────────────────────── */

/**
 * AI Evaluation — the executive-summary card.
 *
 * Two states:
 *   • Not analyzed → soft "Not Yet Analyzed" state with a single
 *     Run AI Analysis CTA (replaces the redundant "Pending AI score"
 *     block that used to render below in the left column).
 *   • Analyzed → six data points arranged as a compact grid:
 *     Overall Score · Recommendation · Confidence · Top Strengths ·
 *     Top Concerns · Last Analysis Time.
 *
 * The card is intentionally information-dense but visually quiet — no
 * decorative gradient, no oversized number, no charts. Structure does
 * the work.
 */
// Multi-stage progress copy for the auto-score pipeline. Ordered
// to match `autoScoreStage` values from the transcript-page effect.
const ANALYSIS_STAGES = [
  'Building transcript',
  'Reviewing responses',
  'Evaluating competencies',
  'Calculating recommendation',
  'Updating hiring pipeline',
]

function AnalysisProgressList({ stage }) {
  // stage 0..4 marks the currently-active step; anything before it
  // is complete, anything after it is pending. When stage >= 5,
  // all steps read as complete.
  return (
    <ul className="mt-4 space-y-2.5">
      {ANALYSIS_STAGES.map((label, i) => {
        const complete = stage > i
        const active = stage === i
        return (
          <li key={label} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className={
                'inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none font-semibold ' +
                (complete
                  ? 'bg-[color:var(--color-rc-green)]/15 text-[color:var(--color-rc-green)]'
                  : active
                  ? 'bg-[color:var(--color-rc-blue)]/15 text-[color:var(--color-rc-blue)] motion-safe:animate-pulse'
                  : 'bg-[color:var(--color-rc-line)] text-[color:var(--color-rc-muted)]')
              }
            >
              {complete ? '✓' : active ? '·' : '○'}
            </span>
            <span
              className={
                'text-[13px] ' +
                (complete
                  ? 'text-[color:var(--color-rc-ink)]'
                  : active
                  ? 'text-[color:var(--color-rc-ink)] font-medium'
                  : 'text-[color:var(--color-rc-muted)]')
              }
            >
              {label}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function AIEvaluationCard({
  score, recommendation, confidence, strengths, concerns, analyzedAt,
  rescoring, canScore, onRun, autoAnalyzing, analysisStage, analysisFailed,
}) {
  const scoreText = scoreDisplay(score)
  const rec = recommendation || recommendationFromScore(score)
  const analyzed = scoreText != null

  if (!analyzed) {
    // Three sub-states, in priority order:
    //   • analyzing        → multi-stage live progress, no button
    //   • analysisFailed   → recovery path with a Retry Analysis button
    //   • idle             → first-visit state with Run AI Analysis
    const analyzing = !!autoAnalyzing || !!rescoring
    const failed = !!analysisFailed && !analyzing
    const stage = Math.max(0, Math.min(analysisStage ?? 0, ANALYSIS_STAGES.length))
    return (
      <section id="section-ai-evaluation" className="mt-10 scroll-mt-24">
        <div className="rounded-[18px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] p-5 md:p-6">
          <SectionLabel>AI Evaluation</SectionLabel>
          <div className="mt-3 flex items-center gap-2">
            <span
              aria-hidden="true"
              className={
                'h-2 w-2 rounded-full ' +
                (analyzing
                  ? 'bg-[color:var(--color-rc-blue)] motion-safe:animate-pulse'
                  : failed
                  ? 'bg-[color:var(--color-rc-red)]'
                  : 'bg-[color:var(--color-rc-muted)]/60')
              }
            />
            <span className="text-[11.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-muted)]">
              {analyzing
                ? 'AI Interview Analysis in progress'
                : failed
                ? 'Automatic Analysis Failed'
                : 'Not Yet Analyzed'}
            </span>
          </div>

          {analyzing ? (
            <>
              <p className="mt-3 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[52ch]">
                Claude is reviewing the interview end-to-end. The recruiter
                report will appear here automatically — no refresh needed.
              </p>
              <AnalysisProgressList stage={stage} />
            </>
          ) : failed ? (
            <>
              <p className="mt-3 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[52ch]">
                We couldn&rsquo;t complete the automatic analysis. The interview
                and transcript are safely saved — try running the analysis
                again below.
              </p>
              <div className="mt-5">
                <Button
                  variant="primary"
                  size="md"
                  iconLeft={<Sparkles size={14} />}
                  onClick={onRun}
                  loading={rescoring}
                  disabled={!canScore}
                  aria-label="Retry Analysis"
                >
                  Retry Analysis
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-3 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[52ch]">
                Run AI to generate a score, recommendation, confidence, top
                strengths, top concerns, and per-question review.
              </p>
              <div className="mt-5">
                <Button
                  variant="primary"
                  size="md"
                  iconLeft={<Sparkles size={14} />}
                  onClick={onRun}
                  loading={rescoring}
                  disabled={!canScore}
                  aria-label="Run AI Analysis"
                >
                  Run AI Analysis
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    )
  }

  const recLabel = rec ? (RECOMMENDATION_LABEL[rec] || 'Pending') : 'Pending'
  const confPct = confidence != null ? Math.round(Number(confidence)) : null
  const confBand = confPct == null ? null : confPct >= 75 ? 'High' : confPct >= 50 ? 'Medium' : 'Low'
  const topS = Array.isArray(strengths) && strengths[0]?.title ? strengths[0].title : null
  const topC = Array.isArray(concerns)  && concerns[0]?.title  ? concerns[0].title  : null
  const analyzedRel = analyzedAt ? relativeTime(analyzedAt) : null

  return (
    <section id="section-ai-evaluation" className="mt-10 scroll-mt-24">
      <div className="rounded-[18px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] p-5 md:p-6">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <SectionLabel>AI Evaluation</SectionLabel>
          {analyzedRel && (
            <span className="text-[11.5px] text-[color:var(--color-rc-muted)]">
              Analyzed {analyzedRel}
            </span>
          )}
        </div>

        <dl className="mt-4 grid gap-x-8 gap-y-4 md:grid-cols-3">
          {/* Overall Score */}
          <div className="min-w-0">
            <dt className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
              Overall Score
            </dt>
            <dd
              className="mt-1.5 text-[28px] leading-none font-semibold tracking-[-0.028em] text-[color:var(--color-rc-ink)] tabular-nums"
              style={{ fontFamily: 'var(--font-editorial), inherit' }}
            >
              {scoreText}
              <span className="text-[15px] text-[color:var(--color-rc-muted)] font-medium">/ 10</span>
            </dd>
          </div>

          {/* Recommendation */}
          <div className="min-w-0">
            <dt className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
              Recommendation
            </dt>
            <dd className="mt-2.5">
              <RecommendationLabelChip recommendation={rec} size="md" />
            </dd>
          </div>

          {/* Confidence */}
          <div className="min-w-0">
            <dt className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
              Confidence
            </dt>
            <dd className="mt-2 text-[14.5px] text-[color:var(--color-rc-ink)]">
              {confPct != null ? (
                <>
                  <span className="font-semibold tabular-nums">{confPct}%</span>
                  {confBand && (
                    <span className="ml-1.5 text-[color:var(--color-rc-muted)]">· {confBand}</span>
                  )}
                </>
              ) : (
                <span className="text-[color:var(--color-rc-muted)]">Not reported</span>
              )}
            </dd>
          </div>

          {/* Top Strengths */}
          <div className="min-w-0 md:col-span-2">
            <dt className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
              Top Strength
            </dt>
            <dd className="mt-2 text-[14px] leading-relaxed text-[color:var(--color-rc-ink)]">
              {topS || <span className="text-[color:var(--color-rc-muted)]">None surfaced.</span>}
            </dd>
          </div>

          {/* Top Concerns */}
          <div className="min-w-0">
            <dt className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
              Top Concern
            </dt>
            <dd className="mt-2 text-[14px] leading-relaxed text-[color:var(--color-rc-ink)]">
              {topC || <span className="text-[color:var(--color-rc-muted)]">None surfaced.</span>}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

// Legacy alias so the render site below keeps working without a rename.
const ExecutiveSummary = AIEvaluationCard

function AiSummaryCard({ summary }) {
  if (!summary) return null
  return (
    <section id="section-summary" className="mt-10 scroll-mt-24">
      <SectionLabel>Summary</SectionLabel>
      <p
        className="mt-4 text-[15.5px] md:text-[16.5px] leading-relaxed text-[color:var(--color-rc-ink)] max-w-[68ch]"
      >
        {summary}
      </p>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
 * EvidenceCard — Strengths and Concerns share the same anatomy.
 * ────────────────────────────────────────────────────────── */

function EvidenceCard({ title, evidence, variant }) {
  const isConcern = variant === 'concern'
  const dot = isConcern
    ? 'bg-[color:var(--color-rc-red)]'
    : 'bg-[color:var(--color-rc-green)]'
  return (
    <div className="rounded-[16px] bg-white border border-[color:var(--color-rc-line)] p-5 [box-shadow:0_1px_2px_rgba(17,17,17,0.02)]">
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className={'mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full ' + dot} />
        <div className="min-w-0">
          <h4
            className="text-[15.5px] leading-tight font-semibold tracking-[-0.012em] text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {title}
          </h4>
          <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
            <span className="italic text-[color:var(--color-rc-ink)] opacity-90">“{evidence}”</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function StrengthsAndConcerns({ strengths, concerns }) {
  const hasS = Array.isArray(strengths) && strengths.length > 0
  const hasC = Array.isArray(concerns) && concerns.length > 0
  if (!hasS && !hasC) return null
  return (
    <>
      {hasS && (
        <section id="section-strengths" className="mt-10 scroll-mt-24">
          <SectionLabel>Strengths</SectionLabel>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {strengths.map((s, i) => (
              <EvidenceCard key={'s-' + i} title={s.title} evidence={s.evidence} variant="strength" />
            ))}
          </div>
        </section>
      )}
      {hasC && (
        <section id="section-concerns" className="mt-10 scroll-mt-24">
          <SectionLabel>Concerns</SectionLabel>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {concerns.map((c, i) => (
              <EvidenceCard key={'c-' + i} title={c.title} evidence={c.evidence} variant="concern" />
            ))}
          </div>
        </section>
      )}
    </>
  )
}

/* ─────────────────────────────────────────────────────────────
 * QuestionRow — accordion with per-question notes
 * ────────────────────────────────────────────────────────── */

function bandChipColor(recommendation) {
  const rec = String(recommendation || '').toLowerCase()
  if (rec === 'strong' || rec === 'good') return 'text-[color:var(--color-rc-green)]'
  if (rec === 'weak' || rec === 'poor') return 'text-[color:var(--color-rc-red)]'
  return 'text-[color:var(--color-rc-warm)]'
}

function QuestionRow({ qr, index, note, onSaveNote, saving, lastEditedAt }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(note || '')
  useEffect(() => { setDraft(note || '') }, [note])
  const scoreText = scoreDisplay(qr.score)
  const rec = qr.recommendation || null

  useEffect(() => {
    if (!open) return
    // Autosave debounce
    if (draft === (note || '')) return
    const t = setTimeout(() => {
      onSaveNote(qr, draft)
    }, 800)
    return () => clearTimeout(t)
  }, [draft, open])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-[16px] bg-white border border-[color:var(--color-rc-line)] overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`q-body-${index}`}
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 md:px-5 py-4 flex items-start gap-3 hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={'mt-1.5 shrink-0 text-[color:var(--color-rc-muted)] transition-transform ' + (open ? 'rotate-0' : '-rotate-90')}
        />
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">Q{index}</div>
          <div className="mt-0.5 text-[14.5px] font-medium text-[color:var(--color-rc-ink)] leading-relaxed">
            {qr.question}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {rec && <span className={'text-[12.5px] font-semibold ' + bandChipColor(rec)}>{rec}</span>}
          {scoreText != null && (
            <span className="inline-flex items-center h-6 px-2 rounded-full bg-[color:var(--color-rc-soft)] text-[12.5px] font-semibold text-[color:var(--color-rc-ink)] tabular-nums">
              {scoreText}/10
            </span>
          )}
        </div>
      </button>

      {open && (
        <div id={`q-body-${index}`} className="px-4 md:px-5 pb-5 border-t border-[color:var(--color-rc-line)]">
          {qr.evidence_quote && (
            <div className="mt-5">
              <SectionLabel>Candidate said</SectionLabel>
              <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--color-rc-ink)]">
                <span className="italic">“{qr.evidence_quote}”</span>
              </p>
            </div>
          )}
          {qr.reasoning && (
            <div className="mt-5">
              <SectionLabel>AI reasoning</SectionLabel>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
                {qr.reasoning}
              </p>
            </div>
          )}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <SectionLabel>My notes</SectionLabel>
              <span aria-live="polite" className="text-[11.5px] text-[color:var(--color-rc-muted)]">
                {saving ? 'Saving…' : lastEditedAt ? `Last edited ${formatShortDate(lastEditedAt)}` : 'Private to you'}
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              placeholder="What did you think of this answer?"
              className="mt-2 w-full block bg-white text-[13.5px] text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3 py-2 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0 resize-none"
              maxLength={800}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function QuestionReviewList({ reviews, notesByQuestion, onSaveNote, savingSet }) {
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return (
      <section className="mt-10">
        <SectionLabel>Question review</SectionLabel>
        <p className="mt-4 text-[13.5px] text-[color:var(--color-rc-muted)] italic">
          No per-question breakdown available. Re-score to compute.
        </p>
      </section>
    )
  }
  return (
    <section id="section-questions" className="mt-10 scroll-mt-24">
      <SectionLabel>Question review</SectionLabel>
      <div className="mt-4 grid gap-3">
        {reviews.map((qr, i) => {
          const key = qr.question || `q-${i}`
          const note = notesByQuestion[key] || null
          return (
            <QuestionRow
              key={i}
              qr={qr}
              index={i + 1}
              note={note?.body || ''}
              lastEditedAt={note?.updated_at || null}
              saving={savingSet.has(key)}
              onSaveNote={(qq, body) => onSaveNote(qq.question, body)}
            />
          )
        })}
      </div>
    </section>
  )
}


/* ─────────────────────────────────────────────────────────────
 * Right rail cards
 * ────────────────────────────────────────────────────────── */

function CardFrame({ children, className = '' }) {
  return (
    <div className={
      'rounded-[16px] bg-white border border-[color:var(--color-rc-line)] p-4 md:p-5 [box-shadow:0_1px_2px_rgba(17,17,17,0.02)] ' +
      className
    }>
      {children}
    </div>
  )
}

function TimelineCard({ startedAt, finishedAt, durationMs, avgResponseSec, followUps, interruptions, attemptCount, abandonedCount }) {
  const rows = [
    { label: 'Started', value: formatClockTime(startedAt) || '—' },
    { label: 'Finished', value: formatClockTime(finishedAt) || '—' },
    { label: 'Duration', value: durationMs ? formatDurationMs(durationMs) : '—' },
    { label: 'Avg response', value: avgResponseSec ? formatSeconds(avgResponseSec) : '—' },
    { label: 'Follow-ups', value: followUps != null ? String(followUps) : '—' },
    { label: 'Interruptions', value: interruptions != null ? String(interruptions) : '—' },
  ]
  // Only worth mentioning when there WERE earlier attempts. Showing "1 of 1"
  // on every transcript is noise.
  if (attemptCount > 1) {
    rows.push({
      label: 'Attempts',
      value: abandonedCount > 0
        ? `${attemptCount} (${abandonedCount} not started)`
        : String(attemptCount),
    })
  }
  return (
    <CardFrame>
      <SectionLabel>Timeline</SectionLabel>
      <dl className="mt-3 grid gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-2 text-[13px]">
            <dt className="text-[color:var(--color-rc-muted)]">{r.label}</dt>
            <dd className="text-[color:var(--color-rc-ink)] font-medium tabular-nums text-right">{r.value}</dd>
          </div>
        ))}
      </dl>
    </CardFrame>
  )
}

function SpeechCard({ analysis }) {
  const [open, setOpen] = useState(false)
  if (!analysis) return null
  return (
    <CardFrame>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
      >
        <SectionLabel>Speech</SectionLabel>
        <ChevronDown size={14} aria-hidden="true" className={'text-[color:var(--color-rc-muted)] transition-transform ' + (open ? 'rotate-180' : 'rotate-0')} />
      </button>
      {open && (
        <dl className="mt-3 grid gap-1.5">
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <dt className="text-[color:var(--color-rc-muted)] inline-flex items-center gap-1.5"><Gauge size={12} aria-hidden="true" /> Pace</dt>
            <dd className="text-[color:var(--color-rc-ink)] font-medium tabular-nums">{analysis.wordsPerMinute} wpm</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <dt className="text-[color:var(--color-rc-muted)] inline-flex items-center gap-1.5"><MessageSquare size={12} aria-hidden="true" /> Fillers</dt>
            <dd className="text-[color:var(--color-rc-ink)] font-medium tabular-nums">{analysis.fillerWordCount}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-2 text-[13px]">
            <dt className="text-[color:var(--color-rc-muted)] inline-flex items-center gap-1.5"><Mic size={12} aria-hidden="true" /> Clarity</dt>
            <dd className="text-[color:var(--color-rc-ink)] font-medium tabular-nums">{analysis.avgPronunciationConfidence}%</dd>
          </div>
          {analysis.sentimentBreakdown && (
            <div className="flex items-baseline justify-between gap-2 text-[13px]">
              <dt className="text-[color:var(--color-rc-muted)] inline-flex items-center gap-1.5"><Smile size={12} aria-hidden="true" /> Sentiment</dt>
              <dd className="text-[color:var(--color-rc-ink)] font-medium tabular-nums">
                {analysis.sentimentBreakdown.positive}·{analysis.sentimentBreakdown.neutral}·{analysis.sentimentBreakdown.negative}
              </dd>
            </div>
          )}
        </dl>
      )}
    </CardFrame>
  )
}

function RecordingCard({ videoUrl, durationMs }) {
  const [open, setOpen] = useState(false)
  const durationLabel = durationMs ? formatDurationMs(durationMs) : 'Interview recording'

  // Empty state — the interview happened but no recording was captured.
  // This is common for early interviews where the browser blocked mic/camera
  // permissions or the upload dropped mid-session.  Better to say so than
  // hide the whole card silently.
  if (!videoUrl) {
    return (
      <CardFrame>
        <SectionLabel>Recording</SectionLabel>
        <div className="mt-3 flex items-start gap-3">
          <span
            aria-hidden="true"
            className="shrink-0 h-10 w-10 rounded-full bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] grid place-items-center"
          >
            <Play size={14} className="text-[color:var(--color-rc-muted)] ml-0.5" />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-[color:var(--color-rc-ink)]">
              No recording available
            </div>
            <div className="mt-0.5 text-[12px] text-[color:var(--color-rc-muted)] leading-relaxed">
              The candidate&rsquo;s browser may have blocked camera access, or the upload didn&rsquo;t complete.
            </div>
          </div>
        </div>
      </CardFrame>
    )
  }

  return (
    <CardFrame>
      <SectionLabel>Recording</SectionLabel>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full mt-3 flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded p-1 -m-1"
          aria-label={`Watch interview — ${durationLabel}`}
        >
          <span className="shrink-0 h-10 w-10 rounded-full bg-[color:var(--color-rc-ink)] grid place-items-center">
            <Play size={14} className="text-white ml-0.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-medium text-[color:var(--color-rc-ink)]">
              {durationLabel}
            </div>
            <div className="text-[12.5px] text-[color:var(--color-rc-muted)]">
              ▶ Watch interview
            </div>
          </div>
        </button>
      ) : (
        <div className="mt-3">
          <video
            controls
            autoPlay
            preload="metadata"
            src={videoUrl}
            className="w-full rounded-lg bg-black"
            aria-label="Candidate interview recording"
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-[12px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] focus:outline-none focus-visible:underline"
          >
            Collapse
          </button>
        </div>
      )}
    </CardFrame>
  )
}

function NotesCard({ note, onSave, saving, lastEditedAt }) {
  const [draft, setDraft] = useState(note || '')
  useEffect(() => { setDraft(note || '') }, [note])

  useEffect(() => {
    if (draft === (note || '')) return
    const t = setTimeout(() => { onSave(draft) }, 800)
    return () => clearTimeout(t)
  }, [draft])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CardFrame>
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>Notes</SectionLabel>
        <span aria-live="polite" className="text-[11.5px] text-[color:var(--color-rc-muted)]">
          {saving ? 'Saving…' : lastEditedAt ? `Last edited · ${formatShortDate(lastEditedAt)}` : 'Private to you'}
        </span>
      </div>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        placeholder="Type your notes. Auto-saved. Private to you."
        aria-label="Recruiter notes for this candidate"
        className="mt-3 w-full block bg-white text-[13.5px] text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3 py-2 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0 resize-none"
        maxLength={1600}
      />
    </CardFrame>
  )
}

function CrossStageCard({ items, currentStageId }) {
  if (!Array.isArray(items) || items.length === 0) return null
  return (
    <CardFrame>
      <SectionLabel>Other interviews</SectionLabel>
      <div className="mt-3 grid gap-1.5">
        {items.map((it) => {
          const isCurrent = String(it.stageId) === String(currentStageId)
          const score = scoreDisplay(it.score)
          return (
            <Link
              key={it.stageId}
              href={`/interview/${it.stageId}/transcript?candidate=${encodeURIComponent(it.candidateName || '')}`}
              aria-current={isCurrent ? 'page' : undefined}
              className={
                'flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
                (isCurrent ? 'bg-[color:var(--color-rc-soft)] text-[color:var(--color-rc-ink)]' : 'text-[color:var(--color-rc-muted)] hover:bg-[color:var(--color-rc-soft)] hover:text-[color:var(--color-rc-ink)]')
              }
            >
              <span className="min-w-0 truncate">
                {it.stageName}
                {isCurrent && <span className="ml-1.5 text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--color-rc-warm)]">This one</span>}
              </span>
              <span className="shrink-0 text-[color:var(--color-rc-ink)] font-medium tabular-nums">
                {score != null ? `${score}/10` : '—'}
              </span>
            </Link>
          )
        })}
      </div>
    </CardFrame>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Full transcript view (collapsed by default)
 * ────────────────────────────────────────────────────────── */

function FullTranscriptView({ lines, candidateName }) {
  const [open, setOpen] = useState(false)
  if (!Array.isArray(lines) || lines.length === 0) return null
  return (
    <section id="section-transcript" className="mt-10 scroll-mt-24">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 text-[13.5px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
      >
        <ChevronDown size={13} aria-hidden="true" className={'transition-transform ' + (open ? 'rotate-0' : '-rotate-90')} />
        {open ? 'Hide full transcript' : 'Expand full transcript'}
      </button>
      {open && (
        <div className="mt-4 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6">
          <div className="grid gap-4">
            {lines.map((line) => {
              const isInterviewer = line.speaker === 'interviewer'
              return (
                <div key={line.id} className={isInterviewer ? '' : 'pl-4 border-l-2 border-[color:var(--color-rc-line-hover)]'}>
                  <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
                    {isInterviewer ? 'Interviewer' : (candidateName || 'Candidate')}
                  </div>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--color-rc-ink)]">
                    {stripSpeakerLine(line.content)}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}


/* ─────────────────────────────────────────────────────────────
 * Re-score confirmation
 * ────────────────────────────────────────────────────────── */

function ReScoreModal({ open, onClose, onConfirm, currentScore, rescoring }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Re-score with AI?"
      description={currentScore != null
        ? `The current score (${scoreDisplay(currentScore)}/10) and its evidence will be replaced with a fresh evaluation.`
        : 'This will run the AI evaluation.'}
      size="sm"
      dismissible={!rescoring}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={rescoring}>Cancel</Button>
          <Button variant="primary" onClick={onConfirm} loading={rescoring} iconLeft={<Sparkles size={14} />}>
            Re-score
          </Button>
        </>
      }
    >
      Your recruiter notes and status are preserved. Only the AI evaluation is replaced.
    </Modal>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Export PDF — client-side, uses window.print with print styles.
 * A future enhancement can swap for html-to-pdf; the modal is
 * scoped so we can upgrade without any UI changes.
 * ────────────────────────────────────────────────────────── */

function ExportPdfModal({ open, onClose, onExport }) {
  const [includeTranscript, setIncludeTranscript] = useState(true)
  const [includeNotes, setIncludeNotes] = useState(false)
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export as PDF"
      description="Prints a decision-ready summary. Uses your browser's Save as PDF dialog."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => onExport({ includeTranscript, includeNotes })} iconLeft={<Download size={14} />}>
            Export
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeTranscript}
            onChange={(e) => setIncludeTranscript(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border border-[color:var(--color-rc-line-hover)] accent-[color:var(--color-rc-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
          />
          <span className="text-[13.5px] text-[color:var(--color-rc-ink)]">
            <strong className="font-medium">Include full transcript</strong>
            <span className="block text-[12.5px] text-[color:var(--color-rc-muted)]">Adds a full Q&amp;A appendix to the last pages.</span>
          </span>
        </label>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeNotes}
            onChange={(e) => setIncludeNotes(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border border-[color:var(--color-rc-line-hover)] accent-[color:var(--color-rc-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
          />
          <span className="text-[13.5px] text-[color:var(--color-rc-ink)]">
            <strong className="font-medium">Include my private notes</strong>
            <span className="block text-[12.5px] text-[color:var(--color-rc-muted)]">Include recruiter notes in the export. Off by default.</span>
          </span>
        </label>
      </div>
    </Modal>
  )
}


/* ─────────────────────────────────────────────────────────────
 * TranscriptPage (main)
 * ────────────────────────────────────────────────────────── */

export default function TranscriptPage() {
  const params = useParams()
  const stageId = params.stageId
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [stage, setStage] = useState(null)
  const [role, setRole] = useState(null)
  const [otherStages, setOtherStages] = useState([])   // for cross-stage nav
  const [lines, setLines] = useState([])
  const [scores, setScores] = useState({})             // by candidate name (lowercased)
  const [otherStagesScores, setOtherStagesScores] = useState({}) // stageId+name → score
  const [rowByCandidate, setRowByCandidate] = useState({})  // raw scores row per candidate
  const [selected, setSelected] = useState(null)

  const [loading, setLoading] = useState(true)
  const [rescoring, setRescoring] = useState(false)
  // True while the transcript-page auto-score safety net is
  // actively polling for a score row. Drives the multi-stage
  // "Analyzing interview…" state in <AIEvaluationCard>.
  const [autoScoring, setAutoScoring] = useState(false)
  // Multi-stage progress driver:
  //   0 → Building transcript
  //   1 → Reviewing responses
  //   2 → Evaluating competencies
  //   3 → Calculating recommendation
  //   4 → Updating hiring pipeline
  //   5 → complete
  const [autoScoreStage, setAutoScoreStage] = useState(0)
  // Set to true when auto-scoring has exhausted retries + timeout
  // and the recruiter should see the Retry Analysis recovery path.
  const [autoScoreFailed, setAutoScoreFailed] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [reScoreOpen, setReScoreOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportOptions, setExportOptions] = useState(null)  // triggers print effect

  // Notes state — whole-candidate + per-question
  const [candidateNote, setCandidateNote] = useState(null)   // { body, updated_at }
  const [questionNotes, setQuestionNotes] = useState({})    // question text → { body, updated_at }
  const [noteSaving, setNoteSaving] = useState(false)
  const [qNoteSaving, setQNoteSaving] = useState(new Set()) // question texts being saved
  const [questions, setQuestions] = useState([])            // approved questions for the stage

  function flashMessage(msg) { setErrorMsg(''); setMessage(msg); setTimeout(() => setMessage(''), 3200) }
  function flashError(msg)   { setMessage(''); setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4200) }

  /* ── Load ────────────────────────────────── */

  const loadEverything = useCallback(async () => {
    setLoading(true)

    const stageRes = await supabase.from('stages').select().eq('id', stageId).single()
    const stageData = stageRes.data || null
    setStage(stageData)

    let roleData = null
    let otherStagesData = []
    if (stageData?.role_id) {
      const roleRes = await supabase.from('roles').select().eq('id', stageData.role_id).single()
      roleData = roleRes.data || null
      const stagesRes = await supabase.from('stages').select('id, name, position').eq('role_id', stageData.role_id).order('position', { ascending: true })
      otherStagesData = stagesRes.data || []
    }
    setRole(roleData)
    setOtherStages(otherStagesData)

    const linesRes = await supabase
      .from('interviews').select().eq('stage_id', stageId).order('created_at', { ascending: true })
    const linesData = linesRes.data || []
    setLines(linesData)

    // Approved questions for this stage
    const qRes = await supabase.from('questions').select('id, text, approved').eq('stage_id', stageId).eq('approved', true)
    setQuestions(qRes.data || [])

    // Scores for this stage
    const scoresRes = await supabase.from('scores').select().eq('stage_id', stageId)
    const scoresData = scoresRes.data || []
    const map = {}
    const rowMap = {}
    scoresData.forEach((s) => {
      map[(s.candidate_name || '').toLowerCase()] = s
      rowMap[(s.candidate_name || '').toLowerCase()] = s
    })
    setScores(map)
    setRowByCandidate(rowMap)

    // Cross-stage scores lookup
    if (otherStagesData.length > 0) {
      const stageIds = otherStagesData.map((s) => String(s.id))
      const acrossRes = await supabase.from('scores').select('stage_id, candidate_name, score').in('stage_id', stageIds)
      const acrossMap = {}
      ;(acrossRes.data || []).forEach((s) => {
        const key = `${s.stage_id}|${(s.candidate_name || '').toLowerCase()}`
        acrossMap[key] = s.score
      })
      setOtherStagesScores(acrossMap)
    }

    // Pick the selected candidate (from URL or first available)
    const names = [...new Set(linesData.map((l) => l.candidate_name).filter(Boolean))]
    const urlCandidate = searchParams?.get('candidate') || null
    const pick = (urlCandidate && names.includes(urlCandidate)) ? urlCandidate : (names[0] || null)
    setSelected(pick)

    setLoading(false)
  }, [stageId, searchParams])

  useEffect(() => { loadEverything() }, [loadEverything])

  /* ── Derived: per-candidate data ─────────── */

  const candidateNames = useMemo(
    () => [...new Set(lines.map((l) => l.candidate_name).filter(Boolean))],
    [lines],
  )

  // Case-insensitive candidate match — some legacy rows have inconsistent
  // casing between the transcript upload path and the video upload path
  // (e.g. "Priya" vs "priya").  Fall back to case-insensitive equality so
  // the video and transcript rows still bind to the same candidate.
  const allLinesForCandidate = useMemo(() => {
    const target = (selected || '').toLowerCase()
    return lines.filter((l) => (l.candidate_name || '').toLowerCase() === target)
  }, [lines, selected])

  /* ── Split a candidate's lines into separate interview attempts ──
     Every row in `interviews` gets its own `token`, because the column
     defaults to gen_random_uuid() and the insert never supplies one. So the
     token identifies a ROW, not a SESSION, and cannot be used to group.

     The reliable delimiter is the `session_start` marker written when the
     interview page opens. Without this split, every attempt a candidate ever
     made was concatenated into one transcript — abandoned starts contributed
     an orphaned opening question each, which is why the same question appeared
     several times in a row with no answer between. */
  const sessions = useMemo(() => {
    // Preferred path: group by session_id, which the interview client now
    // stamps on every row of an attempt.
    if (allLinesForCandidate.some((l) => l.session_id)) {
      const byId = new Map()
      const ungrouped = []
      for (const line of allLinesForCandidate) {
        if (!line.session_id) { ungrouped.push(line); continue }
        if (!byId.has(line.session_id)) byId.set(line.session_id, [])
        byId.get(line.session_id).push(line)
      }
      const groups = [...byId.values()]
      if (ungrouped.length) groups.push(ungrouped)
      // Oldest attempt first, matching the marker-based path below.
      groups.sort(
        (a, b) => new Date(a[0]?.created_at || 0) - new Date(b[0]?.created_at || 0),
      )
      return groups
    }

    // Fallback for rows written before session_id existed and missed the
    // backfill: split at each session_start marker.
    const groups = []
    let current = null
    for (const line of allLinesForCandidate) {
      if (line.speaker === 'session_start' || current === null) {
        current = []
        groups.push(current)
      }
      current.push(line)
    }
    return groups
  }, [allLinesForCandidate])

  /* The attempt to display: the most recent one the candidate actually spoke
     in. Opening the link and walking away creates a session containing only a
     marker and the first question; showing that instead of real answers would
     be worse than the bug it replaces. */
  const linesForSelected = useMemo(() => {
    if (sessions.length === 0) return []
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].some((l) => l.speaker === 'candidate')) return sessions[i]
    }
    return sessions[sessions.length - 1]
  }, [sessions])

  // How many earlier attempts exist, so the UI can say so rather than silently
  // hiding them.
  const attemptCount = sessions.length
  const abandonedCount = useMemo(
    () => sessions.filter((s) => !s.some((l) => l.speaker === 'candidate')).length,
    [sessions],
  )

  const transcriptLines = useMemo(
    () => linesForSelected.filter((l) =>
      l.speaker !== 'video' && l.speaker !== 'invite' &&
      l.speaker !== 'analysis' && l.speaker !== 'audio' &&
      l.speaker !== 'session_start'
    ),
    [linesForSelected],
  )

  const video = useMemo(() => {
    const v = linesForSelected.find((l) => l.speaker === 'video')
    return v ? v.video_url : null
  }, [linesForSelected])

  const analysis = useMemo(() => {
    const a = linesForSelected.find((l) => l.speaker === 'analysis')
    if (!a) return null
    try { return JSON.parse(a.content) } catch { return null }
  }, [linesForSelected])

  const startedAt = useMemo(() => {
    const first = linesForSelected.find((l) => l.speaker === 'session_start') || transcriptLines[0]
    return first?.created_at || null
  }, [linesForSelected, transcriptLines])
  const finishedAt = useMemo(() => transcriptLines[transcriptLines.length - 1]?.created_at || null, [transcriptLines])
  const durationMs = useMemo(() => {
    if (!startedAt || !finishedAt) return null
    return new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  }, [startedAt, finishedAt])

  const avgResponseSec = useMemo(() => {
    // For candidate turns only: time between interviewer→candidate speaking.
    const candidateTurns = transcriptLines.filter((l) => l.speaker !== 'interviewer')
    if (candidateTurns.length === 0) return null
    let total = 0
    let count = 0
    for (let i = 0; i < transcriptLines.length; i++) {
      const l = transcriptLines[i]
      if (l.speaker !== 'interviewer') continue
      const next = transcriptLines[i + 1]
      if (!next || next.speaker === 'interviewer') continue
      const dt = new Date(next.created_at).getTime() - new Date(l.created_at).getTime()
      if (Number.isFinite(dt) && dt >= 0 && dt < 5 * 60 * 1000) { total += dt / 1000; count++ }
    }
    return count > 0 ? Math.round(total / count) : null
  }, [transcriptLines])

  const followUps = useMemo(() => {
    // Follow-ups counted as consecutive interviewer turns
    let n = 0
    for (let i = 1; i < transcriptLines.length; i++) {
      if (transcriptLines[i].speaker === 'interviewer' && transcriptLines[i - 1].speaker === 'interviewer') n++
    }
    return n
  }, [transcriptLines])

  const interruptions = 0  // Not tracked in transcript today.

  const currentScoreRow = useMemo(() => {
    if (!selected) return null
    return rowByCandidate[selected.toLowerCase()] || null
  }, [rowByCandidate, selected])

  const crossStageItems = useMemo(() => {
    if (!selected) return []
    return otherStages.map((s) => ({
      stageId: s.id,
      stageName: s.name,
      candidateName: selected,
      score: otherStagesScores[`${s.id}|${selected.toLowerCase()}`] ?? null,
    }))
  }, [otherStages, otherStagesScores, selected])

  const rec = currentScoreRow?.recommendation || recommendationFromScore(currentScoreRow?.score)
  const currentStatus = currentScoreRow?.status || null

  /* ── Auto-score safety net ────────────────
   * If the candidate has a transcript but no score row, the client-
   * side auto-score on the interview page probably didn't survive
   * page unload. We kick off the scoring server-side ourselves and
   * wait on Supabase Realtime for the score row to appear (with
   * polling as a graceful fallback if Realtime is unavailable).
   *
   * Recruiters never see the "Score Now" state under normal
   * circumstances — only if every recovery path fails.
   */
  const autoScoreTriedRef = useRef(new Set())
  useEffect(() => {
    if (!selected) return
    if (transcriptLines.length === 0) return
    if (currentScoreRow?.score != null) return   // already scored
    if (rescoring) return                        // manual re-score in flight
    const key = `${stageId}|${selected}`
    if (autoScoreTriedRef.current.has(key)) return
    autoScoreTriedRef.current.add(key)

    let cancelled = false
    let channel = null
    let stageTimers = []
    setAutoScoring(true)
    setAutoScoreFailed(false)
    setAutoScoreStage(0)

    const onScoreLanded = (row) => {
      if (cancelled) return
      setRowByCandidate((prev) => ({ ...prev, [selected.toLowerCase()]: row }))
      // Fast-forward the last two progress bullets so the recruiter
      // sees the pipeline update tick before the final card swaps in.
      setAutoScoreStage(5)
      setAutoScoring(false)
    }

    ;(async () => {
      try {
        // ── Primary channel: Supabase Realtime ─────────
        // Open BEFORE the safety-net POST so any INSERT/UPDATE that
        // beats our own network round-trip still reaches the UI.
        //
        // Case-insensitive candidate_name comparison — the server
        // preserves whatever the candidate typed, but recruiter-side
        // lookups normalize to lowercase; Realtime payloads carry the
        // raw stored value.
        const selectedNorm = (selected || '').toLowerCase()
        try {
          channel = supabase
            .channel(`score-${stageId}-${selectedNorm}`)
            .on(
              'postgres_changes',
              {
                event: '*',
                schema: 'public',
                table: 'scores',
                filter: `stage_id=eq.${String(stageId)}`,
              },
              (payload) => {
                const row = payload?.new
                if (!row) return
                if ((row.candidate_name || '').toLowerCase() !== selectedNorm) return
                if (row.score == null) return
                onScoreLanded(row)
              },
            )
            .subscribe((status) => {
              // If Realtime rejects the subscription, we still have
              // polling as a fallback below — no need to alert.
              if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                console.warn('Realtime channel state:', status, '— falling back to polling.')
              }
            })
        } catch (err) {
          console.warn('Realtime subscribe failed, using polling only:', err)
        }

        // ── Multi-stage progress cadence ──────────────
        // The scoring API doesn't emit granular progress, so we
        // simulate a natural-feeling cadence for the recruiter.
        // Real completion (Realtime or poll) fast-forwards to
        // stage 5, so this is UI polish, not a data source.
        stageTimers.push(setTimeout(() => !cancelled && setAutoScoreStage((s) => Math.max(s, 1)), 2500))
        stageTimers.push(setTimeout(() => !cancelled && setAutoScoreStage((s) => Math.max(s, 2)), 12000))
        stageTimers.push(setTimeout(() => !cancelled && setAutoScoreStage((s) => Math.max(s, 3)), 30000))
        stageTimers.push(setTimeout(() => !cancelled && setAutoScoreStage((s) => Math.max(s, 4)), 60000))

        // ── Grace window BEFORE firing our safety-net POST ──
        // The interview page fires the primary scoring request the
        // moment the candidate finishes. If the recruiter opens the
        // transcript within seconds, we'd fire a duplicate request
        // that races against that one. A 15-second grace lets the
        // primary request either land (Realtime notifies us and we
        // cancel out) or clearly fail (we then take over).
        const graceMs = 15_000
        for (let waited = 0; waited < graceMs && !cancelled; waited += 3000) {
          await new Promise((r) => setTimeout(r, 3000))
          if (cancelled) return
          const { data } = await supabase
            .from('scores')
            .select()
            .eq('stage_id', String(stageId))
            .eq('candidate_name', selected)
            .maybeSingle()
          if (data && data.score != null) {
            onScoreLanded(data)
            return
          }
        }
        // Still no row — fire our safety-net POST. Server-side
        // idempotency (see SCORE_TTL_MS in /api/score-interview)
        // makes this a no-op if the interview page's request just
        // finished writing.
        const askedQuestions = questions.map((q) => q.text)
        const payloadTranscript = transcriptLines.map((l) => ({ speaker: l.speaker, content: l.content }))
        fetch('/api/score-interview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: payloadTranscript,
            stageName: stage?.name,
            stageId: String(stageId),
            candidateName: selected,
            questions: askedQuestions,
          }),
          keepalive: true,
        }).catch((err) => console.warn('Transcript-page safety-net POST failed:', err))

        // ── Fallback poll: 3s cadence, 180s ceiling ──
        // Opus 4.5 with a long transcript can genuinely take 60-120s.
        // The old 90s ceiling was too tight and caused "failed" state
        // to fire while the row was seconds away from landing.
        const deadline = Date.now() + 180_000
        while (!cancelled && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 3000))
          if (cancelled) return
          const { data } = await supabase
            .from('scores')
            .select()
            .eq('stage_id', String(stageId))
            .eq('candidate_name', selected)
            .maybeSingle()
          if (data && data.score != null) {
            onScoreLanded(data)
            return
          }
        }
        // ── Timed out with no score row → recovery path ──
        // The interview + transcript are still intact. The recruiter
        // sees "Automatic analysis failed" with a Retry Analysis
        // button — the candidate never has to re-interview.
        if (!cancelled) setAutoScoreFailed(true)
      } catch (err) {
        console.warn('Auto-score orchestration ended:', err)
        if (!cancelled) setAutoScoreFailed(true)
      } finally {
        if (!cancelled) setAutoScoring(false)
      }
    })()
    return () => {
      cancelled = true
      stageTimers.forEach((t) => clearTimeout(t))
      if (channel) { try { supabase.removeChannel(channel) } catch {} }
      setAutoScoring(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, transcriptLines.length, currentScoreRow?.score])

  /* ── Notes IO ────────────────────────────── */

  const loadNotes = useCallback(async () => {
    if (!selected) { setCandidateNote(null); setQuestionNotes({}); return }
    const { data } = await supabase
      .from('recruiter_notes')
      .select('id, question_id, body, updated_at')
      .eq('stage_id', String(stageId))
      .eq('candidate_name', selected)
    const cand = (data || []).find((n) => n.question_id == null) || null
    setCandidateNote(cand ? { id: cand.id, body: cand.body || '', updated_at: cand.updated_at } : null)
    const qMap = {}
    ;(data || []).forEach((n) => {
      if (n.question_id != null) {
        // We only know the question text via the questions table.
        const q = questions.find((x) => x.id === n.question_id)
        const key = q?.text || `qid:${n.question_id}`
        qMap[key] = { id: n.id, question_id: n.question_id, body: n.body || '', updated_at: n.updated_at }
      }
    })
    setQuestionNotes(qMap)
  }, [selected, stageId, questions])

  useEffect(() => { loadNotes() }, [loadNotes])

  async function saveCandidateNote(body) {
    if (!selected) return
    setNoteSaving(true)
    const now = new Date().toISOString()
    if (candidateNote?.id) {
      await supabase.from('recruiter_notes').update({ body, updated_at: now }).eq('id', candidateNote.id)
      setCandidateNote((prev) => prev ? { ...prev, body, updated_at: now } : prev)
    } else {
      const { data } = await supabase.from('recruiter_notes').insert({
        stage_id: String(stageId),
        candidate_name: selected,
        question_id: null,
        body,
        updated_at: now,
      }).select().single()
      if (data) setCandidateNote({ id: data.id, body: data.body || '', updated_at: data.updated_at })
    }
    setNoteSaving(false)
  }

  async function saveQuestionNote(questionText, body) {
    if (!selected) return
    const existing = questionNotes[questionText]
    const q = questions.find((x) => x.text === questionText)
    setQNoteSaving((prev) => { const n = new Set(prev); n.add(questionText); return n })
    const now = new Date().toISOString()
    if (existing?.id) {
      await supabase.from('recruiter_notes').update({ body, updated_at: now }).eq('id', existing.id)
      setQuestionNotes((prev) => ({ ...prev, [questionText]: { ...existing, body, updated_at: now } }))
    } else if (q) {
      const { data } = await supabase.from('recruiter_notes').insert({
        stage_id: String(stageId),
        candidate_name: selected,
        question_id: q.id,
        body,
        updated_at: now,
      }).select().single()
      if (data) setQuestionNotes((prev) => ({ ...prev, [questionText]: { id: data.id, question_id: q.id, body: data.body || '', updated_at: data.updated_at } }))
    } else {
      // No matching question row; store as candidate note tagged with the question text at the top.
      // We fall back to plain candidate note append — but to keep scope tight, we just no-op.
    }
    setQNoteSaving((prev) => { const n = new Set(prev); n.delete(questionText); return n })
  }

  /* ── Actions ─────────────────────────────── */

  async function setStatus(target) {
    if (!selected) return
    setUpdatingStatus(true)
    const prev = currentStatus
    const nextRow = { ...currentScoreRow, status: target }
    setRowByCandidate((prevMap) => ({ ...prevMap, [selected.toLowerCase()]: nextRow }))
    const { error } = await supabase.from('scores').upsert({
      stage_id: String(stageId),
      candidate_name: selected,
      score: currentScoreRow?.score ?? null,
      summary: currentScoreRow?.summary ?? null,
      status: target,
    }, { onConflict: 'stage_id,candidate_name' })
    setUpdatingStatus(false)
    if (error) {
      // Rollback local state so the UI doesn't drift from the DB.
      setRowByCandidate((prevMap) => ({ ...prevMap, [selected.toLowerCase()]: { ...currentScoreRow, status: prev } }))
      // Never leak the raw error to the recruiter — log for debugging.
      console.error('Verdict update failed:', error)
      flashError("Couldn't update the candidate's decision. Please try again.")
      return
    }
    flashMessage(`Marked as ${target.replace('-', ' ')}.`)
  }

  async function runScore() {
    if (!selected) return
    setRescoring(true)
    setReScoreOpen(false)
    try {
      const askedQuestions = questions.map((q) => q.text)
      const speechClarity = analysis?.avgPronunciationConfidence ?? null
      const payloadTranscript = transcriptLines.map((l) => ({ speaker: l.speaker, content: l.content }))
      const res = await fetch('/api/score-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: payloadTranscript,
          stageName: stage?.name,
          stageId: String(stageId),
          candidateName: selected,
          questions: askedQuestions,
          speechClarityPct: speechClarity,
        }),
      })
      const data = await res.json()
      if (data.error) {
        // Log the API's actual reason internally; UI stays user-friendly.
        console.error('AI scoring API error:', data.error)
        flashError('Unable to start AI analysis. Please try again.')
        return
      }
      // Refresh row from DB to reflect stored data
      const refresh = await supabase.from('scores').select().eq('stage_id', String(stageId)).eq('candidate_name', selected).single()
      if (refresh.data) {
        setRowByCandidate((prev) => ({ ...prev, [selected.toLowerCase()]: refresh.data }))
      }
      flashMessage('AI scoring complete.')
    } catch (e) {
      // Network / thrown errors — log then show generic copy.
      console.error('AI scoring failed:', e)
      flashError("AI analysis didn't complete. Please try again.")
    } finally {
      setRescoring(false)
    }
  }

  function handleExport(options) {
    setExportOpen(false)
    setExportOptions(options)
    // Defer to next tick so the print styles apply
    setTimeout(() => {
      window.print()
      setExportOptions(null)
    }, 100)
  }

  /* ── Header helpers ──────────────────────── */

  const topStrength = currentScoreRow?.strengths?.[0]?.title || null
  const topConcern  = currentScoreRow?.concerns?.[0]?.title || null


  /* ── Render ──────────────────────────────── */

  const printClasses = exportOptions ? 'rc-print-mode' : ''
  const hideTranscriptInPrint = exportOptions && !exportOptions.includeTranscript
  const hideNotesInPrint      = exportOptions && !exportOptions.includeNotes

  return (
    <AppShell>
      <div className={'max-w-[1180px] mx-auto pb-12 ' + printClasses}>

        {/* QueueNav renders itself only when a review queue is active
            for this candidate. When it does, hide the redundant
            "Back to role" link — QueueNav's own "Candidate List" link
            is the primary back navigation for that flow. When the
            recruiter arrives via a direct link (no queue), we fall
            back to the standalone role link so the page never dead-ends. */}
        <QueueNav
          stageId={stageId}
          candidateName={selected}
          backHref="/candidates"
        />
        <InQueueGate stageId={stageId} candidateName={selected}>
          <div className="flex items-center justify-between gap-3 mb-6 print:hidden">
            <Link
              href={role?.id ? `/roles/${role.id}` : '/roles'}
              className="inline-flex items-center gap-1.5 text-[13px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] transition-colors duration-150"
            >
              <ArrowLeft size={13} /> Back to {role?.title || 'role'}
            </Link>
            {candidateNames.length > 1 && (
              <div className="text-[12.5px] text-[color:var(--color-rc-muted)]">
                {candidateNames.length} completed interviews on this stage
              </div>
            )}
          </div>
        </InQueueGate>

        <Toast kind="success" message={message} className="print:hidden" />
        <Toast kind="error" message={errorMsg} className="print:hidden" />

        {loading ? (
          <div className="pt-4"><LoadingBlock /></div>
        ) : !selected ? (
          <div className="pt-4">
            <EmptyState
              icon={<User size={22} />}
              title="Nobody's finished this interview yet."
              description="Once a candidate completes it, their review will show up here."
              action={
                role?.id ? (
                  <Button as="a" href={`/roles/${role.id}`} variant="primary">
                    Back to role
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <>
            <VerdictHeader
              candidateName={selected}
              roleTitle={role?.title || null}
              stageName={stage?.name || null}
              completedAt={finishedAt}
              startedAt={startedAt}
              durationMs={durationMs}
              score={currentScoreRow?.score}
              recommendation={rec}
              currentStatus={currentStatus}
              confidence={currentScoreRow?.confidence}
              confidenceReasons={currentScoreRow?.confidence_reasons}
              confidenceCopy={currentScoreRow?.confidence_copy}
              hasTranscript={transcriptLines.length > 0}
              onSetStatus={setStatus}
              updatingStatus={updatingStatus}
              onReScore={() => setReScoreOpen(true)}
              onExport={() => setExportOpen(true)}
              rescoring={rescoring}
              canScore={transcriptLines.length > 0}
            />

            {/* Sticky verdict bar — visible only after the recruiter
                scrolls past the header's inline action row. */}
            <StickyVerdictBar
              currentStatus={currentStatus}
              updatingStatus={updatingStatus}
              onSetStatus={setStatus}
              onArchive={() => setStatus('archived')}
              archiving={updatingStatus && currentStatus === 'archived'}
            />

            {/* Floating section navigator — hides itself for very
                short interviews (fewer than 3 sections). */}
            <SectionNavigator
              sections={[
                { id: 'section-ai-evaluation', label: 'AI Evaluation' },
                currentScoreRow?.summary ? { id: 'section-summary', label: 'Summary' } : null,
                (Array.isArray(currentScoreRow?.strengths) && currentScoreRow.strengths.length > 0)
                  ? { id: 'section-strengths', label: 'Strengths' } : null,
                (Array.isArray(currentScoreRow?.concerns) && currentScoreRow.concerns.length > 0)
                  ? { id: 'section-concerns', label: 'Concerns' } : null,
                (Array.isArray(currentScoreRow?.question_reviews) && currentScoreRow.question_reviews.length > 0)
                  ? { id: 'section-questions', label: `Questions (${currentScoreRow.question_reviews.length})` } : null,
                transcriptLines.length > 0 ? { id: 'section-transcript', label: 'Full transcript' } : null,
              ].filter(Boolean)}
            />

            {/* AI Evaluation — executive summary card (P1 spec item #2).
                Handles both the analyzed and not-yet-analyzed states so
                the recruiter never sees a blank score placeholder. */}
            <AIEvaluationCard
              score={currentScoreRow?.score}
              recommendation={rec}
              confidence={currentScoreRow?.confidence}
              strengths={currentScoreRow?.strengths}
              concerns={currentScoreRow?.concerns}
              analyzedAt={currentScoreRow?.created_at}
              rescoring={rescoring}
              autoAnalyzing={autoScoring}
              analysisStage={autoScoreStage}
              analysisFailed={autoScoreFailed}
              canScore={transcriptLines.length > 0}
              onRun={() => setReScoreOpen(true)}
            />

            {/* Divider removed — the AI Evaluation card's own top
                spacing (mt-10) already provides the visual break. */}

            {/* Two-column layout: argument (2/3) + context (1/3).
                When there is no score yet, the left column would be
                blank; we collapse to a single column so the timeline
                and notes rail fills the width instead of leaving a
                dead zone next to it. */}
            <div
              className={
                currentScoreRow?.score != null
                  ? 'grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]'
                  : 'grid gap-8 md:grid-cols-1'
              }
            >
              <div className={'min-w-0 ' + (currentScoreRow?.score != null ? '' : 'hidden')}>
                {currentScoreRow?.score != null && (
                  <>
                    <AiSummaryCard summary={currentScoreRow?.summary} />
                    <StrengthsAndConcerns
                      strengths={currentScoreRow?.strengths}
                      concerns={currentScoreRow?.concerns}
                    />
                    <QuestionReviewList
                      reviews={currentScoreRow?.question_reviews}
                      notesByQuestion={questionNotes}
                      onSaveNote={saveQuestionNote}
                      savingSet={qNoteSaving}
                    />
                    <div className={hideTranscriptInPrint ? 'print:hidden' : ''}>
                      <FullTranscriptView lines={transcriptLines} candidateName={selected} />
                    </div>
                  </>
                )}
              </div>

              <aside className="grid gap-4 content-start">
                <TimelineCard
                  startedAt={startedAt}
                  finishedAt={finishedAt}
                  durationMs={durationMs}
                  avgResponseSec={avgResponseSec}
                  followUps={followUps}
                  interruptions={interruptions}
                  attemptCount={attemptCount}
                  abandonedCount={abandonedCount}
                />
                <SpeechCard analysis={analysis} />
                <RecordingCard videoUrl={video} durationMs={durationMs} />
                <div className={hideNotesInPrint ? 'print:hidden' : ''}>
                  <NotesCard
                    note={candidateNote?.body || ''}
                    lastEditedAt={candidateNote?.updated_at || null}
                    saving={noteSaving}
                    onSave={saveCandidateNote}
                  />
                </div>
                <CrossStageCard items={crossStageItems} currentStageId={stageId} />
              </aside>
            </div>
          </>
        )}

        {/* Modals */}
        <ReScoreModal
          open={reScoreOpen}
          onClose={() => !rescoring && setReScoreOpen(false)}
          onConfirm={runScore}
          currentScore={currentScoreRow?.score}
          rescoring={rescoring}
        />
        <ExportPdfModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          onExport={handleExport}
        />

        {/* Print styles (scoped) */}
        <style jsx>{`
          @media print {
            :global(nav), :global(aside.rc-sidebar) { display: none !important; }
            :global(button), :global(select), :global(input) { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            :global(.rc-print-mode) { max-width: 100% !important; }
          }
        `}</style>
      </div>
    </AppShell>
  )
}
