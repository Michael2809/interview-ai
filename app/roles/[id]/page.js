'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { warmTtsCache } from '@/lib/tts'
import Link from 'next/link'
import {
  ArrowLeft, Plus, ChevronRight, ChevronDown, MoreHorizontal, Search,
  Sparkles, Upload, Send, Loader, FileUp, X, Trash2, Copy, PauseCircle,
  Archive, ArchiveRestore, CheckCircle2, XCircle, Circle, GripVertical,
  Download, Clock, Users, Mail, Pencil, ArrowUpRight, AlertTriangle,
} from 'lucide-react'
import AppShell from '@/components/AppShell'
import { SkeletonLine } from '@/components/AppShell/Skeleton'
import {
  Button, Drawer, Modal, EmptyState, Spinner, TextField, Select,
  ScoreBadge, StatusBadge, Toast,
} from '@/components/ui'
import { getCandidateDisplayName, getCandidateDisplayEmail, getCandidateInitials } from '@/lib/candidates'

/* ─────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────── */

const COMPLEXITY_LABELS = {
  introductory: 'Introductory',
  'mid-level': 'Mid-level',
  advanced: 'Advanced',
  easy: 'Introductory',
  intermediate: 'Mid-level',
  hard: 'Advanced',
}

const TABS = ['overview', 'candidates', 'interviews']

const SESSION_TAB_KEY  = 'recrewt:role-detail:tab'
const SESSION_CAND_KEY = 'recrewt:role-detail:candidates-filter'

/* ─────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────── */

function initials(name) {
  if (!name) return '?'
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
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

function complexityLabel(v) { return COMPLEXITY_LABELS[v] || v || '' }

function employmentLabel(v) {
  return { 'full-time': 'Full-time', 'part-time': 'Part-time', 'contract': 'Contract' }[v] || v
}

function experienceLabel(v) {
  return { entry: 'Entry', mid: 'Mid', senior: 'Senior', lead: 'Lead' }[v] || v
}

function suggestedFromScore(score) {
  if (score == null) return 'in-progress'
  if (score >= 7) return 'shortlisted'
  if (score >= 4) return 'on-hold'
  return 'rejected'
}

function csvEscape(v) {
  const s = v == null ? '' : String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
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
        'text-[22px] md:text-[26px] leading-[1.15] font-semibold tracking-[-0.028em] text-[color:var(--color-rc-ink)] ' +
        className
      }
      style={{ fontFamily: 'var(--font-editorial), inherit' }}
    >
      {children}
    </h2>
  )
}

/**
 * LoadingBlock — Role Details skeleton. Mirrors the loaded shape:
 * a header block (title + meta + action row), then a tab strip,
 * then a content grid. Prevents the giant vertical shift users saw
 * when the spinner card was replaced by the real header + tabs.
 */
function LoadingBlock() {
  return (
    <div aria-hidden="true" className="rc-skeleton">
      {/* Header — title, meta line, primary action */}
      <div className="mb-8">
        <SkeletonLine className="w-24" height="h-2.5" />
        <div className="mt-3 flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <SkeletonLine className="w-2/3 max-w-[420px]" height="h-8" />
            <div className="mt-3 flex items-center gap-3">
              <SkeletonLine className="w-24" height="h-3" />
              <SkeletonLine className="w-32" height="h-3" />
              <SkeletonLine className="w-20" height="h-3" />
            </div>
          </div>
          <SkeletonLine className="w-32 shrink-0" height="h-10" />
        </div>
      </div>

      {/* Tab strip */}
      <div className="mb-8 flex items-center gap-6 border-b border-[color:var(--color-rc-line)] pb-3">
        <SkeletonLine className="w-16" height="h-3" />
        <SkeletonLine className="w-24" height="h-3" />
        <SkeletonLine className="w-20" height="h-3" />
      </div>

      {/* Two-column body: main content + sidebar */}
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] p-5">
            <SkeletonLine className="w-40" height="h-4" />
            <div className="mt-4 space-y-2">
              <SkeletonLine className="w-full" height="h-3" />
              <SkeletonLine className="w-11/12" height="h-3" />
              <SkeletonLine className="w-3/4" height="h-3" />
            </div>
          </div>
          <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] p-5">
            <SkeletonLine className="w-32" height="h-4" />
            <div className="mt-4 space-y-2">
              <SkeletonLine className="w-full" height="h-3" />
              <SkeletonLine className="w-5/6" height="h-3" />
            </div>
          </div>
        </div>
        <div className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] p-5">
          <SkeletonLine className="w-28" height="h-3" />
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

/* SummaryStrip — reused pattern (4 compact metrics) */
function SummaryMetric({ label, value, highlight = false, suffix }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className="text-[26px] md:text-[28px] leading-none font-semibold tracking-[-0.03em] text-[color:var(--color-rc-ink)] tabular-nums"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
        >
          {value ?? '—'}
        </span>
        {suffix && value != null && (
          <span className="text-[13px] text-[color:var(--color-rc-muted)] font-medium">{suffix}</span>
        )}
        {highlight && typeof value === 'number' && value > 0 && (
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]" />
        )}
      </div>
    </div>
  )
}

function SummaryStrip({ invited, ongoing, waiting, avgScore }) {
  return (
    <div className="mt-8 pt-6 border-t border-[color:var(--color-rc-line)] grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
      <SummaryMetric label="Invited"           value={invited} />
      <SummaryMetric label="In progress"       value={ongoing} />
      <SummaryMetric label="Waiting for review" value={waiting} highlight />
      <SummaryMetric label="Average score"     value={avgScore != null ? avgScore.toFixed(1) : '—'} suffix="/10" />
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
 * WaitingRow — same anatomy as the Dashboard's Waiting rows
 * ────────────────────────────────────────────────────────── */

function WaitingRow({ name, stageName, score, stageId, completedAt }) {
  const suggested = suggestedFromScore(score)
  return (
    <Link
      href={`/interview/${stageId}/transcript?candidate=${encodeURIComponent(name || '')}`}
      className="block group focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-2 rounded-[14px]"
      aria-label={`Review ${name || 'candidate'} in ${stageName || 'stage'}`}
    >
      <div className="flex items-center gap-4 md:gap-5 px-5 md:px-6 py-4 md:py-5 rounded-[14px] bg-white border border-[color:var(--color-rc-line)] transition-[transform,box-shadow,border-color] duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:-translate-y-0.5 group-hover:border-[color:var(--color-rc-line-hover)] [box-shadow:0_1px_2px_rgba(17,17,17,0.02)] group-hover:[box-shadow:0_22px_40px_-30px_rgba(17,17,17,0.12)]">
        <div
          className="shrink-0 h-11 w-11 rounded-full bg-[color:var(--color-rc-soft)] grid place-items-center text-[13.5px] font-semibold text-[color:var(--color-rc-ink)]"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
          aria-hidden="true"
        >
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-[16.5px] leading-tight font-semibold tracking-[-0.015em] text-[color:var(--color-rc-ink)] truncate"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {name || 'Anonymous candidate'}
          </div>
          <div className="mt-1.5 text-[13px] text-[color:var(--color-rc-muted)] truncate">
            {stageName || 'Unassigned stage'}
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
 * FunnelBar — one stage row: title on the left, 3-segment bar
 * on the right.  Clicking any segment filters Candidates tab.
 * ────────────────────────────────────────────────────────── */

function FunnelBar({ stageName, invited, ongoing, completed, onClick }) {
  const total = Math.max(invited, 1)  // avoid /0 for empty stages
  const completedPct = Math.min(100, Math.round((completed / total) * 100))
  const ongoingPct   = Math.min(100 - completedPct, Math.round((ongoing / total) * 100))
  const invitedPct   = Math.max(0, 100 - completedPct - ongoingPct)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`View ${stageName} candidates`}
      className="w-full text-left grid grid-cols-[1fr_auto] md:grid-cols-[minmax(180px,240px)_1fr_auto] gap-3 md:gap-6 items-center px-1 py-3 rounded-lg hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] transition-colors"
    >
      <div className="min-w-0">
        <div className="text-[14px] font-medium text-[color:var(--color-rc-ink)] truncate">{stageName}</div>
        <div className="mt-0.5 text-[12px] text-[color:var(--color-rc-muted)] tabular-nums">
          {completed} of {invited} · {ongoing} in progress
        </div>
      </div>
      <div className="hidden md:flex h-[6px] rounded-full bg-[color:var(--color-rc-soft)] overflow-hidden">
        {completedPct > 0 && (
          <div
            className="h-full"
            style={{ width: `${completedPct}%`, backgroundColor: 'rgba(17,17,17,0.72)' }}
            aria-hidden="true"
          />
        )}
        {ongoingPct > 0 && (
          <div
            className="h-full"
            style={{ width: `${ongoingPct}%`, backgroundColor: 'rgba(17,17,17,0.30)' }}
            aria-hidden="true"
          />
        )}
        {invitedPct > 0 && (
          <div
            className="h-full"
            style={{ width: `${invitedPct}%`, backgroundColor: 'rgba(17,17,17,0.08)' }}
            aria-hidden="true"
          />
        )}
      </div>
      <div className="text-[12.5px] text-[color:var(--color-rc-muted)] tabular-nums">
        {invited > 0 ? `${Math.round((completed / invited) * 100)}%` : '—'}
      </div>
    </button>
  )
}

/* ─────────────────────────────────────────────────────────────
 * StatusBanner — top-of-page banner for paused / archived roles
 * ────────────────────────────────────────────────────────── */

function StatusBanner({ status, onResume, onRestore }) {
  if (status !== 'paused' && status !== 'archived') return null
  const isPaused = status === 'paused'
  return (
    <div className="mb-8 rounded-[14px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] px-5 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 h-8 w-8 rounded-full bg-white grid place-items-center border border-[color:var(--color-rc-line)]" aria-hidden="true">
          {isPaused ? <PauseCircle size={14} className="text-[color:var(--color-rc-warm)]" /> : <Archive size={14} className="text-[color:var(--color-rc-muted)]" />}
        </span>
        <div className="min-w-0">
          <div className="text-[13.5px] font-medium text-[color:var(--color-rc-ink)]">
            {isPaused ? 'This role is paused.' : 'This role is archived.'}
          </div>
          <div className="text-[12.5px] text-[color:var(--color-rc-muted)]">
            {isPaused ? 'New invites are disabled until you resume hiring.' : 'Data is preserved; interactions are read-only.'}
          </div>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={isPaused ? onResume : onRestore}
        iconLeft={<ArchiveRestore size={14} />}
      >
        {isPaused ? 'Resume hiring' : 'Restore to Active'}
      </Button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * Health summary — one editorial line beneath the role title
 * ────────────────────────────────────────────────────────── */

function healthSentence({ waiting, ongoing, invited, avgScore, stages, roleStatus }) {
  if (roleStatus === 'archived') return 'Archived. Data preserved for reference.'
  if (roleStatus === 'paused')   return 'Hiring paused. Nothing new is happening.'
  if (stages === 0) return 'Set up your first interview stage to start hiring.'
  if (invited === 0) return 'Ready to invite. No candidates yet.'
  if (waiting > 0) {
    if (waiting === 1) return `1 candidate is waiting for your review.`
    return `${waiting} candidates are waiting for your review.`
  }
  if (ongoing > 0) return `${ongoing} in progress. Nothing needs you right now.`
  if (avgScore != null) return `All caught up. Average score so far: ${avgScore.toFixed(1)}/10.`
  return 'All caught up.'
}

function HealthSummary(props) {
  const sentence = healthSentence(props)
  const isAttention = props.waiting > 0
  return (
    <p className="mt-4 text-[14.5px] md:text-[15.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
      {isAttention && (
        <span aria-hidden="true" className="inline-block align-middle h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)] mr-2" />
      )}
      {sentence}
    </p>
  )
}


/* ─────────────────────────────────────────────────────────────
 * TabBar — three tabs, keyboard arrow-key navigation
 * ────────────────────────────────────────────────────────── */

function TabBar({ tab, onChange }) {
  const items = [
    { key: 'overview',    label: 'Overview' },
    { key: 'candidates',  label: 'Candidates' },
    { key: 'interviews',  label: 'Interviews' },
  ]
  const refs = useRef({})

  function onKey(e, idx) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next = e.key === 'ArrowRight'
      ? items[(idx + 1) % items.length].key
      : items[(idx - 1 + items.length) % items.length].key
    onChange(next)
    requestAnimationFrame(() => refs.current[next]?.focus())
  }

  return (
    <div
      role="tablist"
      aria-label="Role sections"
      className="mt-8 flex items-center gap-6 border-b border-[color:var(--color-rc-line)]"
    >
      {items.map((item, i) => {
        const active = tab === item.key
        return (
          <button
            key={item.key}
            ref={(el) => { refs.current[item.key] = el }}
            role="tab"
            id={`tab-${item.key}`}
            aria-selected={active}
            aria-controls={`panel-${item.key}`}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(item.key)}
            className={
              'relative -mb-px h-11 px-1 text-[14px] font-medium leading-none transition-colors ' +
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded ' +
              (active
                ? 'text-[color:var(--color-rc-ink)]'
                : 'text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)]')
            }
          >
            {item.label}
            {active && (
              <span
                aria-hidden="true"
                className="absolute -bottom-[1px] left-0 right-0 h-[2px] rounded-full bg-[color:var(--color-rc-ink)]"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * PipelineOutcomes — per-role verdict counts
 * (Shortlisted / On hold / Rejected).  Each card deep-links to
 * the Candidates tab with a verdict pre-filter.
 * ────────────────────────────────────────────────────────── */

function VerdictCard({ label, count, dotColor, ctaText, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-2 rounded-[16px]"
    >
      <div className="p-6 md:p-7 rounded-[16px] bg-white border border-[color:var(--color-rc-line)] [box-shadow:0_1px_2px_rgba(17,17,17,0.015),0_22px_40px_-34px_rgba(17,17,17,0.06)] transition-[transform,box-shadow,border-color] duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)] group-hover:-translate-y-0.5 group-hover:border-[color:var(--color-rc-line-hover)]">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={'h-1.5 w-1.5 rounded-full ' + dotColor} />
          <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">{label}</div>
        </div>
        <div
          className="mt-4 text-[40px] md:text-[48px] leading-none font-semibold tracking-[-0.038em] text-[color:var(--color-rc-ink)] tabular-nums"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
        >
          {count}
        </div>
        <div className="mt-4 text-[12.5px] text-[color:var(--color-rc-muted)] inline-flex items-center gap-1.5">
          {ctaText}
          <ChevronRight size={12} aria-hidden="true" className="group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </button>
  )
}

function PipelineOutcomes({ verdicts, onGoCandidatesFiltered }) {
  const total = verdicts.shortlisted + verdicts.onHold + verdicts.rejected
  return (
    <section className="mb-12">
      <SectionLabel>Pipeline outcomes</SectionLabel>
      <SectionHeading className="mt-4">
        {total === 0 ? 'Nobody in the pipeline yet.' : 'Where candidates for this role landed.'}
      </SectionHeading>
      <p className="mt-1.5 text-[13.5px] text-[color:var(--color-rc-muted)]">
        {total === 0
          ? 'Once you decide on a candidate, their verdict shows up here.'
          : 'Decisions you’ve set on scored candidates so far.'}
      </p>
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <VerdictCard
          label="Shortlisted"
          count={verdicts.shortlisted}
          dotColor="bg-[color:var(--color-rc-green)]"
          ctaText="View shortlist"
          onClick={() => onGoCandidatesFiltered({ verdict: 'shortlisted' })}
        />
        <VerdictCard
          label="On hold"
          count={verdicts.onHold}
          dotColor="bg-[color:var(--color-rc-warm)]"
          ctaText="Revisit"
          onClick={() => onGoCandidatesFiltered({ verdict: 'on-hold' })}
        />
        <VerdictCard
          label="Rejected"
          count={verdicts.rejected}
          dotColor="bg-[color:var(--color-rc-red)]"
          ctaText="Review reasons"
          onClick={() => onGoCandidatesFiltered({ verdict: 'rejected' })}
        />
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
 * NextActionCard — bottom of Overview
 * ────────────────────────────────────────────────────────── */

function NextActionCard({ role, stages, waiting, invited, onOpenInvite, onGoCandidates, onGoInterviews }) {
  let title, description, action
  if ((role.status || 'active') !== 'active') {
    return null
  }
  if (stages.length === 0) {
    title = 'Set up your first interview stage.'
    description = 'A stage is what candidates actually interview against. Recrewt drafts the questions once you name it.'
    action = <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={onGoInterviews}>Add a stage</Button>
  } else if (waiting > 0) {
    title = `${waiting} candidate${waiting === 1 ? '' : 's'} waiting for your review.`
    description = 'Open each transcript, review the AI score, and decide.'
    action = <Button variant="primary" size="sm" iconRight={<ChevronRight size={14} />} onClick={onGoCandidates}>Review candidates</Button>
  } else if (invited === 0) {
    title = 'Time to invite candidates.'
    description = 'You have stages ready. Send interview invites — Recrewt takes it from there.'
    action = <Button variant="primary" size="sm" iconLeft={<Plus size={14} />} onClick={onOpenInvite}>Invite candidates</Button>
  } else {
    title = 'You are all caught up.'
    description = 'Everything invited is either done or in progress. Come back once new interviews complete.'
    action = <Button variant="secondary" size="sm" onClick={onGoCandidates} iconRight={<ChevronRight size={14} />}>View candidates</Button>
  }
  return (
    <div className="mt-10 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-6 md:p-7 [box-shadow:0_1px_2px_rgba(17,17,17,0.02),0_24px_44px_-40px_rgba(17,17,17,0.07)]">
      <SectionLabel>Next action</SectionLabel>
      <h3
        className="mt-3 text-[19px] md:text-[20px] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        {title}
      </h3>
      <p className="mt-2 text-[13.5px] text-[color:var(--color-rc-muted)] max-w-[64ch] leading-relaxed">
        {description}
      </p>
      <div className="mt-5">{action}</div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * OverviewPanel
 * ────────────────────────────────────────────────────────── */

function OverviewPanel({
  role, stages, waitingList, funnel, stats, verdicts,
  onOpenInvite, onGoCandidatesFiltered, onGoInterviews,
}) {
  const totalWaiting = waitingList.length
  const initialShow = 6
  return (
    <div
      role="tabpanel"
      id="panel-overview"
      aria-labelledby="tab-overview"
      className="pt-10"
    >
      {/* Waiting on you */}
      <section className="mb-12">
        <SectionLabel>Waiting on you</SectionLabel>
        {totalWaiting === 0 ? (
          <div className="mt-4">
            <SectionHeading>You&rsquo;re all caught up.</SectionHeading>
            <p className="mt-3 text-[13.5px] text-[color:var(--color-rc-muted)]">
              When a candidate finishes an interview, they&rsquo;ll appear here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-end justify-between gap-4 mb-5">
              <div>
                <SectionHeading>
                  {totalWaiting} candidate{totalWaiting === 1 ? '' : 's'} need
                  {totalWaiting === 1 ? 's' : ''} your review
                </SectionHeading>
                <p className="mt-1.5 text-[13.5px] text-[color:var(--color-rc-muted)]">
                  Sorted by interview date, newest first.
                </p>
              </div>
              {totalWaiting > initialShow && (
                <Button
                  variant="ghost" size="sm"
                  iconRight={<ChevronRight size={14} />}
                  onClick={() => onGoCandidatesFiltered({ status: 'waiting' })}
                >
                  See all {totalWaiting}
                </Button>
              )}
            </div>
            <div className="grid gap-3">
              {waitingList.slice(0, initialShow).map((c) => (
                <WaitingRow
                  key={`${c.stageId}-${c.name}`}
                  name={c.name}
                  stageName={c.stageName}
                  score={c.score}
                  stageId={c.stageId}
                  completedAt={c.completedAt}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Funnel */}
      {stages.length > 0 && (
        <section className="mb-12">
          <SectionLabel>Funnel</SectionLabel>
          <SectionHeading className="mt-4">
            How this hiring is moving.
          </SectionHeading>
          <p className="mt-1.5 text-[13.5px] text-[color:var(--color-rc-muted)]">
            Click a stage to view its candidates.
          </p>
          <div className="mt-6 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-4 md:p-5 [box-shadow:0_1px_2px_rgba(17,17,17,0.02)]">
            <div className="grid gap-1">
              {funnel.map((s) => (
                <FunnelBar
                  key={s.id}
                  stageName={s.name}
                  invited={s.invited}
                  ongoing={s.ongoing}
                  completed={s.completed}
                  onClick={() => onGoCandidatesFiltered({ stage: String(s.id) })}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <PipelineOutcomes verdicts={verdicts} onGoCandidatesFiltered={onGoCandidatesFiltered} />

      <NextActionCard
        role={role}
        stages={stages}
        waiting={stats.waiting}
        invited={stats.invited}
        onOpenInvite={onOpenInvite}
        onGoCandidates={() => onGoCandidatesFiltered({})}
        onGoInterviews={onGoInterviews}
      />
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
 * CandidateRow — aggregated by email; shows current stage
 * more prominently than overall progress.
 * ────────────────────────────────────────────────────────── */

function CandidateRow({ cand, selected, onToggleSelect, onSetStatus }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e) { if (!menuRef.current?.contains(e.target)) setMenuOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const transcriptHref = cand.latestStageId && cand.name
    ? `/interview/${cand.latestStageId}/transcript?candidate=${encodeURIComponent(cand.name)}`
    : cand.latestStageId
    ? `/interview/${cand.latestStageId}/transcript`
    : null

  const currentStageName = cand.currentStageName || 'Not started'
  const progressText = `${cand.completedCount}/${cand.stagesTotal} stages complete`

  return (
    <div
      className={
        'group grid grid-cols-[auto_auto_1fr_auto] md:grid-cols-[auto_auto_1fr_auto_auto_auto_auto] items-center gap-x-3 md:gap-x-4 px-4 md:px-5 py-3.5 ' +
        'bg-white border-t border-[color:var(--color-rc-line)] first:border-t-0 transition-colors ' +
        (selected ? 'bg-[color:var(--color-rc-soft)]' : 'hover:bg-[color:var(--color-rc-soft)]/60')
      }
    >
      <input
        type="checkbox"
        aria-label={`Select ${getCandidateDisplayName(cand)}`}
        checked={selected}
        onChange={() => onToggleSelect(cand.email)}
        className={
          'h-4 w-4 rounded border border-[color:var(--color-rc-line-hover)] accent-[color:var(--color-rc-ink)] ' +
          (selected ? '' : 'opacity-0 group-hover:opacity-100 focus:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]')
        }
      />

      <div
        className="shrink-0 h-9 w-9 rounded-full bg-[color:var(--color-rc-soft)] grid place-items-center text-[12px] font-semibold text-[color:var(--color-rc-ink)]"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
        aria-hidden="true"
      >
        {/* Presentation helper — never renders internal composite
            keys like `anon:1|minne`. Underlying cand.name/cand.email
            are still used verbatim for lookups elsewhere. */}
        {getCandidateInitials(cand)}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {transcriptHref ? (
            <Link
              href={transcriptHref}
              className="text-[15px] font-medium text-[color:var(--color-rc-ink)] truncate hover:underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
            >
              {getCandidateDisplayName(cand)}
            </Link>
          ) : (
            <span className="text-[15px] font-medium text-[color:var(--color-rc-ink)] truncate">
              {getCandidateDisplayName(cand)}
            </span>
          )}
        </div>
        {getCandidateDisplayEmail(cand) && (
          <div className="mt-0.5 text-[12.5px] text-[color:var(--color-rc-muted)] truncate">
            {getCandidateDisplayEmail(cand)}
          </div>
        )}
      </div>

      {/* Current stage — most prominent secondary element */}
      <div className="hidden md:block min-w-0 max-w-[160px]">
        <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
          Current stage
        </div>
        <div className="mt-0.5 text-[13.5px] font-medium text-[color:var(--color-rc-ink)] truncate">
          {currentStageName}
        </div>
        <div className="text-[12px] text-[color:var(--color-rc-muted)] tabular-nums">
          {progressText}
        </div>
      </div>

      {/* Score */}
      <div className="hidden md:block shrink-0">
        {cand.latestScore != null ? (
          <ScoreBadge value={cand.latestScore} outOf={10} size="sm" />
        ) : (
          <span className="text-[12.5px] text-[color:var(--color-rc-muted)]">—</span>
        )}
      </div>

      {/* Status */}
      <div className="shrink-0">
        <StatusBadge status={cand.derivedStatus} size="sm" />
      </div>

      {/* Overflow menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={`Actions for ${getCandidateDisplayName(cand)}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="h-9 w-9 grid place-items-center rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
        >
          <MoreHorizontal size={16} />
        </button>
        {menuOpen && (
          <div role="menu" className="absolute right-0 mt-1 w-52 z-30 rounded-[12px] bg-white border border-[color:var(--color-rc-line)] [box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)] py-1.5">
            {transcriptHref && (
              <Link
                href={transcriptHref}
                role="menuitem"
                className="block px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]"
                onClick={() => setMenuOpen(false)}
              >
                Open transcript
              </Link>
            )}
            <button
              type="button" role="menuitem"
              onClick={() => { setMenuOpen(false); onSetStatus(cand, 'shortlisted') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <CheckCircle2 size={13} className="text-[color:var(--color-rc-green)]" aria-hidden="true" /> Shortlist
            </button>
            <button
              type="button" role="menuitem"
              onClick={() => { setMenuOpen(false); onSetStatus(cand, 'on-hold') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <Circle size={13} className="text-[color:var(--color-rc-orange)]" aria-hidden="true" /> Put on hold
            </button>
            <button
              type="button" role="menuitem"
              onClick={() => { setMenuOpen(false); onSetStatus(cand, 'rejected') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-red)] hover:bg-[rgb(199_75_58_/_0.06)] flex items-center gap-2"
            >
              <XCircle size={13} aria-hidden="true" /> Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * CandidateFilterBar
 * ────────────────────────────────────────────────────────── */

function CandidateFilterBar({ search, onSearch, stage, onStage, statusFilter, onStatusFilter, sort, onSort, stages }) {
  return (
    <div className="mt-6 mb-4 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-4">
      <div className="relative flex-1 min-w-0">
        <Search size={15} aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-rc-muted)] pointer-events-none" />
        <input
          type="search"
          role="searchbox"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search name or email"
          aria-label="Search candidates"
          className="w-full h-11 pl-9 pr-3 bg-white text-[14.5px] text-[color:var(--color-rc-ink)] border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)]"
        />
      </div>
      <div className="grid grid-cols-3 gap-3 md:flex md:items-center md:gap-3">
        <Select
          aria-label="Filter by stage" value={stage} onChange={(e) => onStage(e.target.value)}
          fullWidth={false} className="min-w-[160px]"
          options={[{ value: 'all', label: 'All stages' }, ...stages.map((s) => ({ value: String(s.id), label: s.name }))]}
        />
        <Select
          aria-label="Filter by status" value={statusFilter} onChange={(e) => onStatusFilter(e.target.value)}
          fullWidth={false} className="min-w-[160px]"
          options={[
            { value: 'all',         label: 'All status'      },
            { value: 'waiting',     label: 'Waiting review'  },
            { value: 'in-progress', label: 'In progress'     },
            { value: 'shortlisted', label: 'Shortlisted'     },
            { value: 'on-hold',     label: 'On hold'         },
            { value: 'rejected',    label: 'Rejected'        },
          ]}
        />
        <Select
          aria-label="Sort candidates" value={sort} onChange={(e) => onSort(e.target.value)}
          fullWidth={false} className="min-w-[170px]"
          options={[
            { value: 'priority', label: 'Sort: Priority'     },
            { value: 'recent',   label: 'Sort: Most recent'  },
            { value: 'score',    label: 'Sort: Score'        },
            { value: 'name',     label: 'Sort: Name A–Z'     },
          ]}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * BulkActionBar — floats at bottom when ≥ 1 selected
 * ────────────────────────────────────────────────────────── */

function BulkActionBar({ count, onClear, onShortlist, onReject, onExport, busy }) {
  if (count === 0) return null
  return (
    <div
      role="toolbar"
      aria-label="Bulk candidate actions"
      aria-live="polite"
      className="fixed left-1/2 -translate-x-1/2 bottom-6 z-40 flex items-center gap-2 md:gap-3 px-4 py-2.5 rounded-full bg-[color:var(--color-rc-ink)] text-white [box-shadow:0_20px_40px_-14px_rgba(17,17,17,0.35)]"
    >
      <span className="text-[13px] font-medium tabular-nums px-2">
        {count} selected
      </span>
      <div className="h-4 w-px bg-white/25" aria-hidden="true" />
      <button
        type="button" onClick={onShortlist} disabled={busy}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-[13px] font-medium hover:bg-white/10 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <CheckCircle2 size={14} aria-hidden="true" /> Shortlist
      </button>
      <button
        type="button" onClick={onReject} disabled={busy}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-[13px] font-medium hover:bg-white/10 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <XCircle size={14} aria-hidden="true" /> Reject
      </button>
      <button
        type="button" onClick={onExport} disabled={busy}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-[13px] font-medium hover:bg-white/10 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <Download size={14} aria-hidden="true" /> Export
      </button>
      <div className="h-4 w-px bg-white/25" aria-hidden="true" />
      <button
        type="button" onClick={onClear}
        aria-label="Clear selection"
        className="h-8 w-8 grid place-items-center rounded hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
 * CandidatesPanel
 * ────────────────────────────────────────────────────────── */

function CandidatesPanel({
  candidates, stages,
  search, onSearch, stage, onStage, statusFilter, onStatusFilter, sort, onSort,
  selected, onToggleSelect, onSelectAll, onClearSelection,
  onSetStatus, onBulkShortlist, onBulkReject, onBulkExport, busyBulk,
  onOpenInvite,
}) {
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return candidates.filter((c) => {
      if (term) {
        const hay = ((c.name || '') + ' ' + (c.email || '')).toLowerCase()
        if (!hay.includes(term)) return false
      }
      if (stage !== 'all') {
        const stageId = String(stage)
        if (!c.stageIds.includes(stageId)) return false
      }
      if (statusFilter !== 'all') {
        if (c.derivedStatus !== statusFilter) return false
      }
      return true
    })
  }, [candidates, search, stage, statusFilter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    if (sort === 'priority') {
      arr.sort((a, b) => {
        const pa = a.derivedStatus === 'waiting' ? 0 : a.derivedStatus === 'in-progress' ? 1 : 2
        const pb = b.derivedStatus === 'waiting' ? 0 : b.derivedStatus === 'in-progress' ? 1 : 2
        if (pa !== pb) return pa - pb
        return (b.latestScore ?? -1) - (a.latestScore ?? -1)
      })
    } else if (sort === 'recent') {
      arr.sort((a, b) => new Date(b.latestActivity || 0) - new Date(a.latestActivity || 0))
    } else if (sort === 'score') {
      arr.sort((a, b) => (b.latestScore ?? -1) - (a.latestScore ?? -1))
    } else if (sort === 'name') {
      arr.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''))
    }
    return arr
  }, [filtered, sort])

  const allSelected = sorted.length > 0 && sorted.every((c) => selected.has(c.email))
  const someSelected = selected.size > 0 && !allSelected

  const anyFilters = !!search.trim() || stage !== 'all' || statusFilter !== 'all' || sort !== 'priority'

  return (
    <div role="tabpanel" id="panel-candidates" aria-labelledby="tab-candidates" className="pt-8 pb-24">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <SectionLabel>Candidates</SectionLabel>
          <SectionHeading className="mt-4">
            {candidates.length === 0 ? 'No candidates yet.' : `All ${candidates.length} candidates`}
          </SectionHeading>
        </div>
        <Button variant="secondary" size="sm" iconLeft={<Plus size={14} />} onClick={onOpenInvite}>
          Invite candidates
        </Button>
      </div>

      {candidates.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<Users size={22} />}
            title="Invite candidates to get started."
            description="Upload a CSV or paste emails. Recrewt handles the rest."
            action={
              <Button variant="primary" iconLeft={<Plus size={16} />} onClick={onOpenInvite}>
                Invite candidates
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <CandidateFilterBar
            search={search} onSearch={onSearch}
            stage={stage}   onStage={onStage}
            statusFilter={statusFilter} onStatusFilter={onStatusFilter}
            sort={sort}     onSort={onSort}
            stages={stages}
          />

          {sorted.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<Search size={22} />}
                title="No candidates match your filters."
                description="Widen the search or clear filters to see everyone."
                action={anyFilters ? (
                  <Button variant="secondary" onClick={() => {
                    onSearch(''); onStage('all'); onStatusFilter('all'); onSort('priority')
                  }}>Clear filters</Button>
                ) : undefined}
              />
            </div>
          ) : (
            <div className="mt-2 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] overflow-hidden [box-shadow:0_1px_2px_rgba(17,17,17,0.02),0_24px_44px_-40px_rgba(17,17,17,0.06)]">
              <div className="flex items-center gap-3 px-4 md:px-5 py-2.5 bg-[color:var(--color-rc-soft)] border-b border-[color:var(--color-rc-line)]">
                <input
                  type="checkbox"
                  aria-label="Select all candidates"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected }}
                  onChange={(e) => e.target.checked ? onSelectAll(sorted.map((c) => c.email)) : onClearSelection()}
                  className="h-4 w-4 rounded border border-[color:var(--color-rc-line-hover)] accent-[color:var(--color-rc-ink)]"
                />
                <span className="text-[12px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-muted)]">
                  {selected.size > 0 ? `${selected.size} selected` : `${sorted.length} candidate${sorted.length === 1 ? '' : 's'}`}
                </span>
              </div>
              <div role="list" className="grid">
                {sorted.map((c) => (
                  <CandidateRow
                    key={c.email}
                    cand={c}
                    selected={selected.has(c.email)}
                    onToggleSelect={onToggleSelect}
                    onSetStatus={onSetStatus}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <BulkActionBar
        count={selected.size}
        onClear={onClearSelection}
        onShortlist={onBulkShortlist}
        onReject={onBulkReject}
        onExport={onBulkExport}
        busy={busyBulk}
      />
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
 * QuestionRow — inside the Interviews tab
 * ────────────────────────────────────────────────────────── */

function QuestionRow({ q, onToggle, onDelete }) {
  return (
    <div className="group grid grid-cols-[auto_1fr_auto] items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-[color:var(--color-rc-soft)]">
      <label className="mt-0.5 inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!q.approved}
          onChange={() => onToggle(q)}
          aria-label={q.approved ? 'Currently asked. Uncheck to skip.' : 'Ask this question'}
          className="h-4 w-4 rounded border border-[color:var(--color-rc-line-hover)] accent-[color:var(--color-rc-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
        />
        <span className="sr-only">Ask this question</span>
      </label>
      <span className="text-[14px] leading-relaxed text-[color:var(--color-rc-ink)]">
        {q.text}
      </span>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          aria-label="Delete question"
          onClick={() => onDelete(q)}
          className="h-7 w-7 grid place-items-center rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-red)] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * StageListRail (Interviews tab left rail)
 * ────────────────────────────────────────────────────────── */

function StageListRail({ stages, activeStageId, onSelect, onAddStage, funnelById }) {
  return (
    <div className="rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-2 md:p-3 [box-shadow:0_1px_2px_rgba(17,17,17,0.02)]">
      <div className="px-2 py-2">
        <SectionLabel>Stages</SectionLabel>
      </div>
      <div role="listbox" aria-label="Interview stages" className="grid gap-1">
        {stages.map((s) => {
          const active = s.id === activeStageId
          const f = funnelById[s.id] || { invited: 0, completed: 0 }
          return (
            <button
              key={s.id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => onSelect(s.id)}
              className={
                'w-full text-left px-3 py-2.5 rounded-[10px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
                (active ? 'bg-[color:var(--color-rc-ink)] text-white' : 'text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)]')
              }
            >
              <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold opacity-70">
                Stage {s.position}
              </div>
              <div className="mt-0.5 text-[14px] font-medium truncate">{s.name}</div>
              <div className="mt-0.5 text-[12px] tabular-nums opacity-80">
                {f.completed} of {f.invited} done
              </div>
            </button>
          )
        })}
      </div>
      <div className="mt-2 px-2 pb-1">
        <Button variant="ghost" size="sm" iconLeft={<Plus size={14} />} onClick={onAddStage} fullWidth>
          Add stage
        </Button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * StageEditPanel (Interviews tab right pane)
 * ────────────────────────────────────────────────────────── */

function StageEditPanel({
  stage, questions, onEditStage, onDeleteStage,
  onDraftAI, onDraftFromResume, onAddManual,
  onToggleQuestion, onDeleteQuestion,
  draftingId, uploadingId, fileInputRef,
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(stage.name || '')
  const [level, setLevel] = useState(stage.level || 'introductory')
  const [topics, setTopics] = useState(stage.topics || '')

  useEffect(() => {
    setName(stage.name || '')
    setLevel(stage.level || 'introductory')
    setTopics(stage.topics || '')
    setEditing(false)
  }, [stage.id])

  const isDrafting  = draftingId === stage.id
  const isUploading = uploadingId === stage.id

  return (
    <div className="rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-6 md:p-7 [box-shadow:0_1px_2px_rgba(17,17,17,0.02),0_24px_44px_-40px_rgba(17,17,17,0.06)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <SectionLabel>Stage {stage.position}</SectionLabel>
          {editing ? (
            <div className="mt-3 space-y-3 max-w-lg">
              <TextField
                label="Stage name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select
                  label="Complexity"
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  options={[
                    { value: 'introductory', label: 'Introductory' },
                    { value: 'mid-level',    label: 'Mid-level'    },
                    { value: 'advanced',     label: 'Advanced'     },
                  ]}
                />
                <TextField
                  label="Skill focus"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g. algorithms, system design"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button variant="primary" size="sm" onClick={() => { onEditStage(stage, { name, level, topics }); setEditing(false) }}>
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <>
              <h3
                className="mt-3 text-[22px] md:text-[24px] leading-tight font-semibold tracking-[-0.025em] text-[color:var(--color-rc-ink)]"
                style={{ fontFamily: 'var(--font-editorial), inherit' }}
              >
                {stage.name}
              </h3>
              <p className="mt-1.5 text-[13px] text-[color:var(--color-rc-muted)]">
                {complexityLabel(stage.level)}
                {stage.topics ? ` · Skill focus: ${stage.topics}` : ''}
              </p>
            </>
          )}
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" iconLeft={<Pencil size={14} />} onClick={() => setEditing(true)}>
            Edit stage
          </Button>
        )}
      </div>

      {/* Questions header + draft actions */}
      <div className="mt-8 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <SectionLabel>Questions</SectionLabel>
          <h4
            className="mt-3 text-[16px] leading-tight font-semibold tracking-[-0.015em] text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {questions.length} question{questions.length === 1 ? '' : 's'}
          </h4>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.txt" className="hidden" onChange={(e) => onDraftFromResume(stage, e.target.files?.[0])} />
          <Button variant="secondary" size="sm" iconLeft={<Upload size={14} />} onClick={() => fileInputRef.current?.click()} loading={isUploading}>
            From document
          </Button>
          <Button variant="secondary" size="sm" iconLeft={<Sparkles size={14} />} onClick={() => onDraftAI(stage)} loading={isDrafting}>
            Draft with AI
          </Button>
          <Button variant="ghost" size="sm" iconLeft={<Plus size={14} />} onClick={() => onAddManual(stage)}>
            Custom question
          </Button>
        </div>
      </div>

      <p className="mt-2 text-[12.5px] text-[color:var(--color-rc-muted)]">
        Check the questions you want to ask candidates in this stage.
      </p>

      <div className="mt-4 grid gap-0.5">
        {questions.length === 0 ? (
          <p className="text-[13.5px] text-[color:var(--color-rc-muted)] italic px-3 py-4">
            No questions yet. Draft with AI, upload a job document, or add them manually.
          </p>
        ) : (
          questions.map((q) => (
            <QuestionRow key={q.id} q={q} onToggle={onToggleQuestion} onDelete={onDeleteQuestion} />
          ))
        )}
      </div>

      {/* Danger zone */}
      <div className="mt-10 pt-6 border-t border-[color:var(--color-rc-line)]">
        <SectionLabel>Danger zone</SectionLabel>
        <p className="mt-3 text-[13px] text-[color:var(--color-rc-muted)]">
          Deleting this stage removes its questions, invites, and scores. Candidates already in later stages are unaffected.
        </p>
        <div className="mt-4">
          <Button variant="danger" size="sm" iconLeft={<Trash2 size={14} />} onClick={() => onDeleteStage(stage)}>
            Delete stage
          </Button>
        </div>
      </div>
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
 * InterviewsPanel
 * ────────────────────────────────────────────────────────── */

function InterviewsPanel({
  stages, questionsByStage, funnelById,
  activeStageId, onSelectStage,
  onAddStage, onEditStage, onDeleteStage,
  onDraftAI, onDraftFromResume, onAddManual,
  onToggleQuestion, onDeleteQuestion,
  draftingId, uploadingId, fileInputRef,
}) {
  const activeStage = stages.find((s) => s.id === activeStageId) || stages[0]
  const questions = activeStage ? (questionsByStage[activeStage.id] || []) : []

  if (stages.length === 0) {
    return (
      <div role="tabpanel" id="panel-interviews" aria-labelledby="tab-interviews" className="pt-10">
        <EmptyState
          icon={<Sparkles size={22} />}
          title="This role needs at least one interview stage."
          description="A stage is what candidates actually interview against. Recrewt drafts the questions for you."
          action={
            <Button variant="primary" iconLeft={<Plus size={16} />} onClick={onAddStage}>
              Add your first stage
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div role="tabpanel" id="panel-interviews" aria-labelledby="tab-interviews" className="pt-10 grid gap-6 md:grid-cols-[240px_1fr]">
      <div className="min-w-0">
        <StageListRail
          stages={stages}
          activeStageId={activeStage?.id}
          onSelect={onSelectStage}
          onAddStage={onAddStage}
          funnelById={funnelById}
        />
      </div>
      <div className="min-w-0">
        {activeStage && (
          <StageEditPanel
            stage={activeStage}
            questions={questions}
            onEditStage={onEditStage}
            onDeleteStage={onDeleteStage}
            onDraftAI={onDraftAI}
            onDraftFromResume={onDraftFromResume}
            onAddManual={onAddManual}
            onToggleQuestion={onToggleQuestion}
            onDeleteQuestion={onDeleteQuestion}
            draftingId={draftingId}
            uploadingId={uploadingId}
            fileInputRef={fileInputRef}
          />
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * InviteDrawer — unified invite surface
 * ────────────────────────────────────────────────────────── */

function InviteDrawer({
  open, onClose, stages, roleTitle, roleStatus,
  origin, recruiterName, companyName, defaultStageId,
  onSent, inviteHistory,
}) {
  const [stageId, setStageId] = useState(defaultStageId || '')
  const [emailsText, setEmailsText] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [progress, setProgress] = useState({ sent: 0, total: 0 })
  const [result, setResult] = useState(null)  // { sent, failed[] }
  const csvInputRef = useRef(null)

  useEffect(() => {
    if (open) {
      setStageId(defaultStageId || (stages[0]?.id ? String(stages[0].id) : ''))
      setEmailsText(''); setMessage(''); setResult(null); setProgress({ sent: 0, total: 0 })
    }
  }, [open, defaultStageId, stages])

  const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
  const rawTokens = useMemo(() => {
    return emailsText
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
  }, [emailsText])
  const valid = useMemo(() => {
    const found = new Set()
    rawTokens.forEach((t) => {
      const match = t.match(EMAIL_RE)
      if (match && match[0].length === t.length) found.add(t.toLowerCase())
    })
    return Array.from(found)
  }, [rawTokens])
  const invalid = useMemo(() => rawTokens.filter((t) => !EMAIL_RE.test(t)), [rawTokens])

  function handleCsvUpload(file) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result || ''
      const found = String(text).match(EMAIL_RE) || []
      const unique = [...new Set(found.map((v) => v.toLowerCase()))]
      const existing = new Set(
        emailsText.split(/[\n,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean)
      )
      const merged = [...new Set([...unique, ...existing])]
      setEmailsText(merged.join('\n'))
    }
    reader.readAsText(file)
  }

  const canSend =
    !sending &&
    (roleStatus === 'active') &&
    !!stageId &&
    valid.length > 0

  async function send() {
    if (!canSend) return
    setResult(null)
    setSending(true)
    setProgress({ sent: 0, total: valid.length })
    const BATCH = 10
    let sent = 0
    const failed = []
    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH)
      const results = await Promise.all(batch.map((email) =>
        fetch('/api/send-invite', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stageId, candidateEmail: email, origin, recruiterName, companyName,
            personalMessage: message.trim() || undefined,
          }),
        }).then((r) => r.json())
          .then((data) => ({ email, error: data.error }))
          .catch(() => ({ email, error: 'Network error' }))
      ))
      results.forEach(({ email, error }) => {
        if (error) failed.push({ email, error }); else sent++
      })
      setProgress({ sent, total: valid.length })
    }
    setSending(false)
    setResult({ sent, failed })
    if (sent > 0) onSent?.({ sent, failed, stageId })
  }

  function reset() {
    setEmailsText(''); setMessage(''); setResult(null); setProgress({ sent: 0, total: 0 })
  }

  const isPaused = roleStatus !== 'active'

  return (
    <Drawer
      open={open}
      onClose={onClose}
      side="right"
      size="clamp(360px,48vw,600px)"
      title="Invite candidates"
      description={`Send interview invites for ${roleTitle}.`}
      dismissible={!sending}
      footer={
        result ? (
          <>
            <Button variant="ghost" onClick={onClose}>Done</Button>
            <Button variant="secondary" onClick={reset}>Send another batch</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={sending}>Cancel</Button>
            <Button variant="primary" onClick={send} loading={sending} disabled={!canSend}>
              {valid.length > 0 ? `Send ${valid.length}` : 'Send'}
            </Button>
          </>
        )
      }
    >
      {isPaused && (
        <div className="mb-5 rounded-[12px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle size={14} className="text-[color:var(--color-rc-warm)] mt-0.5 shrink-0" aria-hidden="true" />
          <div className="text-[13px] text-[color:var(--color-rc-ink)]">
            This role is <strong>{roleStatus}</strong>. Resume it to send invites.
          </div>
        </div>
      )}

      {result ? (
        <div className="space-y-5">
          <div className="rounded-[14px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] p-5">
            <div className="flex items-start gap-3">
              <span className="shrink-0 h-8 w-8 rounded-full bg-white grid place-items-center border border-[color:var(--color-rc-line)]" aria-hidden="true">
                <CheckCircle2 size={15} className="text-[color:var(--color-rc-green)]" />
              </span>
              <div>
                <h4
                  className="text-[16px] leading-tight font-semibold tracking-[-0.015em] text-[color:var(--color-rc-ink)]"
                  style={{ fontFamily: 'var(--font-editorial), inherit' }}
                >
                  {result.sent} invite{result.sent === 1 ? '' : 's'} sent.
                </h4>
                {result.failed.length > 0 && (
                  <p className="mt-1.5 text-[13px] text-[color:var(--color-rc-muted)]">
                    {result.failed.length} failed. First: <span className="text-[color:var(--color-rc-red)]">{result.failed[0].email}</span>
                    {result.failed[0].error ? ` — ${result.failed[0].error}` : ''}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="text-[13.5px] text-[color:var(--color-rc-muted)]">
            <p>Track responses inside the <span className="text-[color:var(--color-rc-ink)] font-medium">Candidates</span> tab.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <Select
            label="Stage"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            required
            disabled={isPaused}
            options={stages.map((s) => ({ value: String(s.id), label: `${s.position}. ${s.name}` }))}
          />

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]">
                Emails <span className="text-[color:var(--color-rc-ink)]">•</span>
              </label>
              <input ref={csvInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={(e) => handleCsvUpload(e.target.files?.[0])} />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                disabled={isPaused}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[color:var(--color-rc-ink)] underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 hover:decoration-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
              >
                <FileUp size={13} /> Upload CSV
              </button>
            </div>
            <textarea
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              rows={5}
              disabled={isPaused}
              placeholder="One email per line, or comma / semicolon separated"
              className="w-full block bg-white text-[14.5px] text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3.5 py-2.5 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0 resize-none disabled:opacity-60"
            />
            <div className="mt-2 flex items-center gap-3 text-[12.5px]" aria-live="polite">
              <span className="text-[color:var(--color-rc-muted)]"><strong className="text-[color:var(--color-rc-ink)] tabular-nums">{valid.length}</strong> valid</span>
              {invalid.length > 0 && (
                <span className="text-[color:var(--color-rc-red)]"><strong className="tabular-nums">{invalid.length}</strong> invalid</span>
              )}
              {invalid.length > 0 && (
                <span className="text-[color:var(--color-rc-muted)] truncate max-w-[180px]" title={invalid.join(', ')}>
                  · {invalid.slice(0, 2).join(', ')}{invalid.length > 2 ? `, +${invalid.length - 2}` : ''}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]">
              Personal message
              <span className="ml-2 text-[color:var(--color-rc-muted)] font-normal">Optional</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              disabled={isPaused}
              placeholder="A short note candidates will see at the top of the invitation email."
              className="w-full block bg-white text-[14.5px] text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3.5 py-2.5 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0 resize-none disabled:opacity-60"
              maxLength={800}
            />
            <p className="mt-1 text-[12px] text-[color:var(--color-rc-muted)]">
              Sender preview: {recruiterName || 'You'}{companyName ? ` · ${companyName}` : ''}
            </p>
          </div>

          {sending && (
            <div aria-live="polite">
              <div className="flex items-center justify-between text-[12.5px] text-[color:var(--color-rc-muted)] mb-1.5">
                <span className="inline-flex items-center gap-1.5"><Loader size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Sending…</span>
                <span className="tabular-nums">{progress.sent} / {progress.total}</span>
              </div>
              <div className="h-[6px] w-full rounded-full bg-[color:var(--color-rc-soft)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${progress.total ? (progress.sent / progress.total) * 100 : 0}%`, backgroundColor: 'rgba(17,17,17,0.72)' }}
                />
              </div>
            </div>
          )}

          {/* Invite history */}
          {inviteHistory && inviteHistory.length > 0 && (
            <div className="pt-4 border-t border-[color:var(--color-rc-line)]">
              <SectionLabel>Recent invites</SectionLabel>
              <div className="mt-3 grid gap-1.5">
                {inviteHistory.slice(0, 8).map((h, i) => (
                  <div key={`${h.email}-${i}`} className="flex items-center justify-between gap-3 text-[13px]">
                    <div className="min-w-0 flex items-center gap-2">
                      <Mail size={12} className="text-[color:var(--color-rc-muted)] shrink-0" aria-hidden="true" />
                      <span className="text-[color:var(--color-rc-ink)] truncate">{h.email}</span>
                      <span className="text-[color:var(--color-rc-muted)] shrink-0">· {h.stageName}</span>
                    </div>
                    <span className="text-[12px] text-[color:var(--color-rc-muted)] tabular-nums shrink-0">
                      {relativeTime(h.invited_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}


/* ─────────────────────────────────────────────────────────────
 * DeleteRoleModal — type-role-name to confirm
 * ────────────────────────────────────────────────────────── */

function CustomQuestionModal({ stage, onClose, onSubmit, saving, error }) {
  const [text, setText] = useState('')
  useEffect(() => { if (stage) setText('') }, [stage?.id])
  const trimmed = text.trim()
  const overLimit = trimmed.length > 500
  const canSave = trimmed.length >= 3 && !overLimit && !saving
  return (
    <Modal
      open={!!stage}
      onClose={() => !saving && onClose()}
      title="Add a custom question"
      description={stage ? `New question for "${stage.name}". Approved to be asked in the interview.` : ''}
      size="md"
      dismissible={!saving}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={() => canSave && onSubmit(trimmed)} loading={saving} disabled={!canSave}>
            Add question
          </Button>
        </>
      }
    >
      <div>
        <label htmlFor="custom-q-text" className="block mb-1.5 text-[13px] font-medium text-[color:var(--color-rc-ink)]">
          Question
        </label>
        <textarea
          id="custom-q-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="e.g. Walk me through how you'd approach a system that suddenly slows down in production."
          autoFocus
          disabled={saving}
          className="w-full block bg-white text-[14.5px] text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3.5 py-2.5 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0 resize-none disabled:opacity-60"
          maxLength={600}
        />
        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className={overLimit ? 'text-[color:var(--color-rc-red)]' : 'text-[color:var(--color-rc-muted)]'}>
            Keep it under 500 characters. Recrewt reads it out loud during the interview.
          </span>
          <span className={'tabular-nums ' + (overLimit ? 'text-[color:var(--color-rc-red)] font-medium' : 'text-[color:var(--color-rc-muted)]')}>
            {trimmed.length}/500
          </span>
        </div>
        {error && (
          <div role="alert" className="mt-4 rounded-[12px] bg-[rgb(199_75_58_/_0.06)] border border-[color:var(--color-rc-red)] px-3.5 py-2.5 text-[13px] text-[color:var(--color-rc-red)]">
            {error}
          </div>
        )}
      </div>
    </Modal>
  )
}

function DeleteRoleModal({ open, role, onClose, onConfirm, deleting }) {
  const [typed, setTyped] = useState('')
  useEffect(() => { if (open) setTyped('') }, [open])
  const canConfirm = !!role && typed.trim() === (role.title || '').trim()
  return (
    <Modal
      open={open}
      onClose={() => !deleting && onClose()}
      title="Delete role?"
      description={role ? `"${role.title}" and all its interviews, invites, and scores will be permanently removed.` : ''}
      size="sm"
      dismissible={!deleting}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button variant="danger" onClick={() => canConfirm && onConfirm()} loading={deleting} disabled={!canConfirm}>
            Delete role
          </Button>
        </>
      }
    >
      <p className="mb-3">To confirm, type the role name below.</p>
      <TextField
        label={`Type "${role?.title || ''}" to confirm`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={role?.title || ''}
        autoFocus
      />
    </Modal>
  )
}

/* ─────────────────────────────────────────────────────────────
 * RoleHeader
 * ────────────────────────────────────────────────────────── */

function RoleActionMenuHeader({ role, onEdit, onDuplicate, onSetStatus, onDelete, hasStatusColumn }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  useEffect(() => {
    if (!open) return
    function onDoc(e) { if (!menuRef.current?.contains(e.target)) setOpen(false) }
    function onKey(e) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const status = role?.status || 'active'
  const showLifecycle = hasStatusColumn && role
  const canPause  = showLifecycle && status === 'active'
  const canResume = showLifecycle && status === 'paused'
  const canArch   = showLifecycle && status !== 'archived'
  const canRest   = showLifecycle && status === 'archived'

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Role actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="h-11 w-11 grid place-items-center rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] border border-[color:var(--color-rc-line)] bg-white"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 mt-1 w-52 z-30 rounded-[12px] bg-white border border-[color:var(--color-rc-line)] [box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)] py-1.5">
          <button
            type="button" role="menuitem"
            onClick={() => { setOpen(false); onEdit() }}
            className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
          >
            <Pencil size={13} aria-hidden="true" /> Edit role
          </button>
          <button
            type="button" role="menuitem"
            onClick={() => { setOpen(false); onDuplicate() }}
            className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
          >
            <Copy size={13} aria-hidden="true" /> Duplicate
          </button>
          {canPause && (
            <button
              type="button" role="menuitem"
              onClick={() => { setOpen(false); onSetStatus('paused') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <PauseCircle size={13} aria-hidden="true" /> Pause hiring
            </button>
          )}
          {canResume && (
            <button
              type="button" role="menuitem"
              onClick={() => { setOpen(false); onSetStatus('active') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <ArchiveRestore size={13} aria-hidden="true" /> Resume hiring
            </button>
          )}
          {canArch && (
            <button
              type="button" role="menuitem"
              onClick={() => { setOpen(false); onSetStatus('archived') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <Archive size={13} aria-hidden="true" /> Archive
            </button>
          )}
          {canRest && (
            <button
              type="button" role="menuitem"
              onClick={() => { setOpen(false); onSetStatus('active') }}
              className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] flex items-center gap-2"
            >
              <ArchiveRestore size={13} aria-hidden="true" /> Restore to Active
            </button>
          )}
          <div className="my-1 h-px bg-[color:var(--color-rc-line)]" />
          <button
            type="button" role="menuitem"
            onClick={() => { setOpen(false); onDelete() }}
            className="w-full text-left px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-red)] hover:bg-[rgb(199_75_58_/_0.06)] flex items-center gap-2"
          >
            <Trash2 size={13} aria-hidden="true" /> Delete role
          </button>
        </div>
      )}
    </div>
  )
}

function RoleHeader({ role, stages, stats, onOpenInvite, onEdit, onDuplicate, onSetStatus, onDelete, hasStatusColumn }) {
  const status = role?.status || 'active'
  const disabledInvite = status !== 'active' || stages.length === 0

  return (
    <header>
      <SectionLabel>Role</SectionLabel>
      <div className="mt-4 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
        <div className="min-w-0">
          <h1
            className="text-[34px] md:text-[44px] leading-[1.02] font-semibold tracking-[-0.038em] text-[color:var(--color-rc-ink)] max-w-[24ch]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {role?.title || 'Loading…'}
          </h1>
          <p className="mt-2.5 text-[13.5px] text-[color:var(--color-rc-muted)]">
            {[
              role?.department,
              role?.employment_type ? employmentLabel(role.employment_type) : null,
              role?.experience_level ? experienceLabel(role.experience_level) : null,
            ].filter(Boolean).join(' · ') || 'No department set'}
          </p>
          <HealthSummary
            waiting={stats.waiting}
            ongoing={stats.ongoing}
            invited={stats.invited}
            avgScore={stats.avgScore}
            stages={stages.length}
            roleStatus={status}
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="primary" size="md" iconLeft={<Plus size={16} />}
            onClick={onOpenInvite}
            disabled={disabledInvite}
            aria-label={disabledInvite ? 'Invite disabled — role paused/archived or no stages set up' : 'Invite candidates'}
          >
            Invite candidates
          </Button>
          <RoleActionMenuHeader
            role={role}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onSetStatus={onSetStatus}
            onDelete={onDelete}
            hasStatusColumn={hasStatusColumn}
          />
        </div>
      </div>

      <SummaryStrip
        invited={stats.invited}
        ongoing={stats.ongoing}
        waiting={stats.waiting}
        avgScore={stats.avgScore}
      />
    </header>
  )
}


/* ─────────────────────────────────────────────────────────────
 * RoleDetailPage
 * ────────────────────────────────────────────────────────── */

export default function RoleDetailPage() {
  const params = useParams()
  const roleId = params.id
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [role, setRole] = useState(null)
  const [stages, setStages] = useState([])
  const [questions, setQuestions] = useState([])
  const [interviews, setInterviews] = useState([])  // all rows for this role's stages
  const [scores, setScores] = useState([])
  const [recruiterSettings, setRecruiterSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [origin, setOrigin] = useState('')
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [hasStatusColumn, setHasStatusColumn] = useState(true)

  // Tab (URL + session-remembered)
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'overview'
    const q = new URLSearchParams(window.location.search).get('tab')
    if (q && TABS.includes(q)) return q
    if (window.location.hash === '#candidates') return 'candidates'
    if (window.location.hash === '#invite') return 'overview' // hash handled separately
    try {
      const stored = window.sessionStorage.getItem(`${SESSION_TAB_KEY}:${roleId}`)
      if (stored && TABS.includes(stored)) return stored
    } catch {}
    return 'overview'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.sessionStorage.setItem(`${SESSION_TAB_KEY}:${roleId}`, tab) } catch {}
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    url.hash = ''
    window.history.replaceState({}, '', url.toString())
  }, [tab, roleId])

  useEffect(() => { setOrigin(window.location.origin) }, [])

  // Open the Invite drawer if landed with #invite hash
  const [inviteOpen, setInviteOpen] = useState(false)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#invite') {
      setInviteOpen(true)
      const url = new URL(window.location.href)
      url.hash = ''
      window.history.replaceState({}, '', url.toString())
    }
  }, [])

  // Candidates tab filter (session-remembered)
  function readCandFilter() {
    if (typeof window === 'undefined') return { search: '', stage: 'all', statusFilter: 'all', sort: 'priority' }
    try {
      const raw = window.sessionStorage.getItem(`${SESSION_CAND_KEY}:${roleId}`)
      if (raw) return { search: '', stage: 'all', statusFilter: 'all', sort: 'priority', ...JSON.parse(raw) }
    } catch {}
    return { search: '', stage: 'all', statusFilter: 'all', sort: 'priority' }
  }
  const initial = readCandFilter()
  const [search, setSearch] = useState(initial.search)
  const [stageFilter, setStageFilter] = useState(initial.stage)
  const [statusFilter, setStatusFilter] = useState(initial.statusFilter)
  const [sort, setSort] = useState(initial.sort)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(
        `${SESSION_CAND_KEY}:${roleId}`,
        JSON.stringify({ search, stage: stageFilter, statusFilter, sort }),
      )
    } catch {}
  }, [search, stageFilter, statusFilter, sort, roleId])

  // Selection (Candidates tab)
  const [selected, setSelected] = useState(new Set())
  const [busyBulk, setBusyBulk] = useState(false)

  // Stage focus (Interviews tab)
  const [activeStageId, setActiveStageId] = useState(null)
  useEffect(() => {
    if (activeStageId == null && stages.length > 0) setActiveStageId(stages[0].id)
  }, [stages, activeStageId])

  // Modals + drawer
  const [confirmDeleteRole, setConfirmDeleteRole] = useState(false)
  const [deletingRole, setDeletingRole] = useState(false)
  const [confirmDeleteStage, setConfirmDeleteStage] = useState(null)
  // Question deletion confirmation — replaces the native window.confirm
  // dialog with the shared Modal so destructive actions stay inside
  // the design system and can surface real error handling.
  const [pendingDeleteQuestion, setPendingDeleteQuestion] = useState(null)
  const [deletingQuestion, setDeletingQuestion] = useState(false)
  const [confirmReplace, setConfirmReplace] = useState(null)  // { stage, mode: 'ai' | 'resume', file? }
  const [editRoleOpen, setEditRoleOpen] = useState(false)

  // Question drafting state
  const [draftingId, setDraftingId] = useState(null)
  const [customQuestionStage, setCustomQuestionStage] = useState(null)
  const [savingCustomQuestion, setSavingCustomQuestion] = useState(false)
  const [customQuestionError, setCustomQuestionError] = useState('')
  const [uploadingId, setUploadingId] = useState(null)
  const fileInputRef = useRef(null)

  function flashMessage(msg) { setErrorMsg(''); setMessage(msg); setTimeout(() => setMessage(''), 3400) }
  function flashError(msg)   { setMessage(''); setErrorMsg(msg); setTimeout(() => setErrorMsg(''), 4400) }

  /* ── Data loaders ─────────────────────────── */

  async function loadEverything() {
    setLoading(true)
    // roles (with status fallback)
    const withStatus = await supabase.from('roles').select().eq('id', roleId).single()
    let roleRow = withStatus.data
    if (withStatus.error && /column|status|schema/i.test(withStatus.error.message || '')) {
      setHasStatusColumn(false)
      const retry = await supabase.from('roles').select('id, title, description, department, employment_type, experience_level, created_at, user_id').eq('id', roleId).single()
      roleRow = retry.data
    } else if (!withStatus.error) {
      setHasStatusColumn(true)
    }
    setRole(roleRow)

    const [stagesRes, questionsRes, settingsRes] = await Promise.all([
      supabase.from('stages').select().eq('role_id', roleId).order('position', { ascending: true }),
      supabase.from('questions').select(),
      supabase.from('settings').select('full_name, company_name').single(),
    ])
    setStages(stagesRes.data || [])
    setQuestions(questionsRes.data || [])
    setRecruiterSettings(settingsRes.data || null)

    const stageIds = (stagesRes.data || []).map((s) => s.id)
    if (stageIds.length > 0) {
      const [interviewsRes, scoresRes] = await Promise.all([
        supabase.from('interviews').select('stage_id, speaker, candidate_name, candidate_email, invited_at').in('stage_id', stageIds),
        supabase.from('scores').select('stage_id, candidate_name, score, status, created_at, summary').in('stage_id', stageIds.map(String)),
      ])
      setInterviews(interviewsRes.data || [])
      setScores(scoresRes.data || [])
    } else {
      setInterviews([]); setScores([])
    }
    setLoading(false)
  }

  useEffect(() => { loadEverything() /* eslint-disable-next-line */ }, [roleId])

  // Question refresh convenience
  async function refreshQuestions() {
    const { data } = await supabase.from('questions').select()
    if (data) setQuestions(data)
  }

  async function refreshCandidates() {
    const stageIds = stages.map((s) => s.id)
    if (stageIds.length === 0) return
    const [interviewsRes, scoresRes] = await Promise.all([
      supabase.from('interviews').select('stage_id, speaker, candidate_name, candidate_email, invited_at').in('stage_id', stageIds),
      supabase.from('scores').select('stage_id, candidate_name, score, status, created_at, summary').in('stage_id', stageIds.map(String)),
    ])
    setInterviews(interviewsRes.data || [])
    setScores(scoresRes.data || [])
  }


  /* ── Derived: aggregated candidates by email ────────────── */

  const invites = useMemo(() => interviews.filter((r) => r.speaker === 'invite'), [interviews])
  const transcripts = useMemo(() => interviews.filter((r) => r.speaker !== 'invite' && r.candidate_name), [interviews])

  const stageById = useMemo(() => {
    const m = {}
    stages.forEach((s) => { m[s.id] = s })
    return m
  }, [stages])

  const funnelById = useMemo(() => {
    const m = {}
    stages.forEach((s) => { m[s.id] = { invited: 0, ongoing: 0, completed: 0 } })
    invites.forEach((r) => {
      const rec = m[r.stage_id]
      if (rec && r.candidate_email) rec.invited++
    })
    // completed = transcripts count; ongoing = invited - completed for this stage
    const completedByStage = {}
    transcripts.forEach((r) => {
      const key = `${r.stage_id}|${(r.candidate_name || '').toLowerCase()}`
      if (!completedByStage[key]) completedByStage[key] = true
    })
    Object.keys(completedByStage).forEach((k) => {
      const [sid] = k.split('|')
      if (m[sid]) m[sid].completed++
    })
    Object.values(m).forEach((rec) => {
      rec.ongoing = Math.max(0, rec.invited - rec.completed)
    })
    return m
  }, [invites, transcripts, stages])

  const funnelArr = useMemo(() => stages.map((s) => ({ id: s.id, name: s.name, ...(funnelById[s.id] || { invited: 0, ongoing: 0, completed: 0 }) })), [stages, funnelById])

  const candidates = useMemo(() => {
    // Aggregate by lowercased email.  If email is missing (transcript with no
    // matching invite) we fall back to candidate_name+stage as an id.
    const byEmail = {}
    invites.forEach((r) => {
      if (!r.candidate_email) return
      const email = r.candidate_email.toLowerCase()
      const stageId = String(r.stage_id)
      if (!byEmail[email]) {
        byEmail[email] = {
          email,
          name: null,
          stageIds: new Set([stageId]),
          invited_ats: { [stageId]: r.invited_at },
          completedByStage: {},
          scoresByStage: {},
          statusesByStage: {},
          latestActivity: r.invited_at,
        }
      } else {
        byEmail[email].stageIds.add(stageId)
        byEmail[email].invited_ats[stageId] = r.invited_at
        if (r.invited_at && new Date(r.invited_at) > new Date(byEmail[email].latestActivity || 0)) {
          byEmail[email].latestActivity = r.invited_at
        }
      }
    })

    // Match transcripts by matching candidate_name to invite emails is unreliable —
    // instead, use candidate_name as a bridge; where multiple emails share a name we
    // pick the most recent invite for that stage.
    const inviteEmailByStageName = {}
    invites.forEach((r) => {
      if (!r.candidate_email || !r.candidate_name) return
      const key = `${r.stage_id}|${(r.candidate_name || '').toLowerCase()}`
      inviteEmailByStageName[key] = r.candidate_email.toLowerCase()
    })

    transcripts.forEach((r) => {
      const stageId = String(r.stage_id)
      const nameKey = `${r.stage_id}|${(r.candidate_name || '').toLowerCase()}`
      const email = inviteEmailByStageName[nameKey] || null
      if (email && byEmail[email]) {
        byEmail[email].name = byEmail[email].name || r.candidate_name
        byEmail[email].completedByStage[stageId] = true
        // score
        const sc = scores.find((s) => String(s.stage_id) === stageId && (s.candidate_name || '').toLowerCase() === (r.candidate_name || '').toLowerCase())
        if (sc) {
          byEmail[email].scoresByStage[stageId] = sc.score ?? null
          byEmail[email].statusesByStage[stageId] = sc.status || null
          if (sc.created_at && new Date(sc.created_at) > new Date(byEmail[email].latestActivity || 0)) {
            byEmail[email].latestActivity = sc.created_at
          }
        }
      } else {
        // Anonymous transcript with no invite — synthesize a candidate keyed by name
        const key = `anon:${nameKey}`
        if (!byEmail[key]) {
          byEmail[key] = {
            email: key,
            name: r.candidate_name,
            stageIds: new Set([stageId]),
            invited_ats: {},
            completedByStage: { [stageId]: true },
            scoresByStage: {},
            statusesByStage: {},
            latestActivity: null,
          }
        } else {
          byEmail[key].stageIds.add(stageId)
          byEmail[key].completedByStage[stageId] = true
        }
        const sc = scores.find((s) => String(s.stage_id) === stageId && (s.candidate_name || '').toLowerCase() === (r.candidate_name || '').toLowerCase())
        if (sc) {
          byEmail[key].scoresByStage[stageId] = sc.score ?? null
          byEmail[key].statusesByStage[stageId] = sc.status || null
          if (sc.created_at && new Date(sc.created_at) > new Date(byEmail[key].latestActivity || 0)) {
            byEmail[key].latestActivity = sc.created_at
          }
        }
      }
    })

    return Object.values(byEmail).map((c) => {
      const stageIds = Array.from(c.stageIds)
      // Order stage_ids by stage.position for "current stage" resolution
      stageIds.sort((a, b) => {
        const pa = stageById[a]?.position ?? 999
        const pb = stageById[b]?.position ?? 999
        return pa - pb
      })
      // "Current stage" = latest stage they were invited/completed for
      // Prefer the latest incomplete stage; if none incomplete, use the highest position stage they touched.
      let currentStageId = stageIds[stageIds.length - 1]
      const incompleteStages = stageIds.filter((sid) => !c.completedByStage[sid])
      if (incompleteStages.length > 0) currentStageId = incompleteStages[0]

      const completedCount = Object.keys(c.completedByStage).length
      const stagesTotal = stages.length || stageIds.length

      // Latest score = score for the latest completed stage
      let latestScore = null
      let latestStatus = null
      const completedOrdered = stageIds.filter((sid) => c.completedByStage[sid])
      completedOrdered.forEach((sid) => {
        if (c.scoresByStage[sid] != null) latestScore = c.scoresByStage[sid]
        if (c.statusesByStage[sid]) latestStatus = c.statusesByStage[sid]
      })

      // Derived status for filtering
      let derivedStatus = 'in-progress'
      if (latestStatus === 'shortlisted') derivedStatus = 'shortlisted'
      else if (latestStatus === 'on-hold') derivedStatus = 'on-hold'
      else if (latestStatus === 'rejected') derivedStatus = 'rejected'
      else if (completedCount > 0 && !latestStatus) derivedStatus = 'waiting'
      else if (completedCount === 0) derivedStatus = 'in-progress'

      const currentStageName = currentStageId ? (stageById[currentStageId]?.name || 'Unknown') : '—'
      const latestStageId = completedOrdered[completedOrdered.length - 1] || currentStageId

      return {
        email: c.email,
        name: c.name,
        stageIds,
        completedCount,
        stagesTotal,
        currentStageName,
        latestScore,
        latestStatus,
        latestStageId,
        derivedStatus,
        latestActivity: c.latestActivity,
      }
    })
  }, [invites, transcripts, scores, stages, stageById])

  const waitingList = useMemo(() => {
    // Waiting candidates for Overview: completed but no verdict yet
    const items = candidates
      .filter((c) => c.derivedStatus === 'waiting')
      .map((c) => ({
        name: c.name || c.email,
        stageName: c.currentStageName,
        stageId: c.latestStageId,
        score: c.latestScore,
        completedAt: c.latestActivity,
      }))
    items.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
    return items
  }, [candidates])

  const stats = useMemo(() => {
    const invited = new Set(invites.filter((r) => r.candidate_email).map((r) => r.candidate_email.toLowerCase())).size
    const completed = new Set(transcripts.map((r) => `${r.stage_id}|${(r.candidate_name || '').toLowerCase()}`)).size
    const ongoing = Math.max(0, invited - candidates.filter((c) => c.completedCount > 0).length)
    const waiting = candidates.filter((c) => c.derivedStatus === 'waiting').length
    const scored = scores.filter((s) => typeof s.score === 'number')
    const avgScore = scored.length ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length : null
    return { invited, ongoing, waiting, avgScore }
  }, [invites, transcripts, scores, candidates])

  // Per-role verdict counts — used by the PipelineOutcomes cards on Overview.
  // Uses candidate-level derivedStatus (not raw scores rows) so we count one
  // decision per unique candidate, not one per stage attempt.
  const verdicts = useMemo(() => ({
    shortlisted: candidates.filter((c) => c.derivedStatus === 'shortlisted').length,
    onHold:      candidates.filter((c) => c.derivedStatus === 'on-hold').length,
    rejected:    candidates.filter((c) => c.derivedStatus === 'rejected').length,
  }), [candidates])

  const inviteHistory = useMemo(() => {
    const arr = invites
      .filter((r) => r.candidate_email && r.invited_at)
      .map((r) => ({
        email: r.candidate_email,
        stageName: stageById[r.stage_id]?.name || 'Stage',
        invited_at: r.invited_at,
      }))
    arr.sort((a, b) => new Date(b.invited_at) - new Date(a.invited_at))
    return arr
  }, [invites, stageById])

  const questionsByStage = useMemo(() => {
    const m = {}
    stages.forEach((s) => { m[s.id] = [] })
    questions.forEach((q) => { if (m[q.stage_id]) m[q.stage_id].push(q) })
    return m
  }, [stages, questions])


  /* ── Handlers ─────────────────────────────── */

  function toggleSelect(email) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email); else next.add(email)
      return next
    })
  }
  function selectAll(emails) { setSelected(new Set(emails)) }
  function clearSelection() { setSelected(new Set()) }

  async function upsertVerdicts(cands, status) {
    // For each candidate, for each stage they've completed with an existing
    // score row, update status; otherwise insert a new scores row.
    setBusyBulk(true)
    for (const c of cands) {
      for (const sid of c.stageIds) {
        if (!c.completedCount) continue
        const existing = scores.find((s) => String(s.stage_id) === String(sid) && (s.candidate_name || '').toLowerCase() === (c.name || '').toLowerCase())
        if (existing) {
          await supabase.from('scores').update({ status }).eq('id', existing.id ?? null)
            .eq('stage_id', String(sid))
            .eq('candidate_name', c.name || '')
        } else if (c.name) {
          await supabase.from('scores').insert({
            stage_id: String(sid),
            candidate_name: c.name,
            score: c.latestScore ?? null,
            status,
            summary: null,
          })
        }
      }
    }
    setBusyBulk(false)
    await refreshCandidates()
  }

  async function handleSetCandidateStatus(cand, status) {
    await upsertVerdicts([cand], status)
    flashMessage(`Marked ${getCandidateDisplayName(cand)} as ${status.replace('-', ' ')}.`)
  }

  async function handleBulkShortlist() {
    const list = candidates.filter((c) => selected.has(c.email))
    if (list.length === 0) return
    await upsertVerdicts(list, 'shortlisted')
    flashMessage(`Shortlisted ${list.length} candidate${list.length === 1 ? '' : 's'}.`)
    clearSelection()
  }
  async function handleBulkReject() {
    const list = candidates.filter((c) => selected.has(c.email))
    if (list.length === 0) return
    await upsertVerdicts(list, 'rejected')
    flashMessage(`Rejected ${list.length} candidate${list.length === 1 ? '' : 's'}.`)
    clearSelection()
  }
  function handleBulkExport() {
    const list = candidates.filter((c) => selected.has(c.email))
    if (list.length === 0) return
    const rows = [
      ['Name', 'Email', 'Current stage', 'Progress', 'Score', 'Status', 'Last activity'],
      ...list.map((c) => [
        // Never leak internal composite keys into the exported CSV.
        c.name || '', (getCandidateDisplayEmail(c) || ''), c.currentStageName,
        `${c.completedCount}/${c.stagesTotal}`,
        c.latestScore ?? '',
        c.latestStatus || c.derivedStatus,
        c.latestActivity ? new Date(c.latestActivity).toISOString() : '',
      ]),
    ]
    downloadCsv(`${(role?.title || 'candidates').replace(/[^\w\d\-]+/g, '_')}_candidates.csv`, rows)
    flashMessage(`Exported ${list.length} candidate${list.length === 1 ? '' : 's'}.`)
    clearSelection()
  }

  async function handleAddStage() {
    // Simple: add a "New stage" and open it for editing
    const nextPosition = stages.length + 1
    const { data, error } = await supabase.from('stages').insert({
      role_id: roleId, name: 'New stage', level: 'introductory', position: nextPosition, topics: '',
    }).select().single()
    if (error) {
      console.error('Add stage failed:', error)
      return flashError('Unable to add a new stage. Please try again.')
    }
    setStages((prev) => [...prev, data])
    setActiveStageId(data.id)
    setTab('interviews')
    flashMessage('Stage added. Give it a name and draft questions.')
  }

  async function handleEditStage(stage, next) {
    const { error } = await supabase.from('stages').update({
      name: next.name || stage.name,
      level: next.level || stage.level,
      topics: next.topics ?? stage.topics,
    }).eq('id', stage.id)
    if (error) {
      console.error('Stage save failed:', error)
      return flashError('Unable to save this stage. Please try again.')
    }
    setStages((prev) => prev.map((s) => s.id === stage.id ? { ...s, ...next } : s))
    flashMessage('Stage saved.')
  }

  async function handleDeleteStage() {
    if (!confirmDeleteStage) return
    const stageId = confirmDeleteStage.id
    await supabase.from('questions').delete().eq('stage_id', stageId)
    await supabase.from('interviews').delete().eq('stage_id', stageId)
    await supabase.from('scores').delete().eq('stage_id', String(stageId))
    const { error } = await supabase.from('stages').delete().eq('id', stageId)
    if (error) {
      console.error('Stage delete failed:', error)
      flashError('Unable to delete this stage. Please try again.')
      return
    }
    setConfirmDeleteStage(null)
    await loadEverything()
    flashMessage('Stage deleted.')
  }

  async function actuallyDraftAI(stage) {
    setDraftingId(stage.id)
    flashMessage(`Drafting questions for ${stage.name}…`)
    await supabase.from('questions').delete().eq('stage_id', stage.id).eq('approved', false)
    const res = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageName: stage.name, level: stage.level, topics: stage.topics }),
    })
    const result = await res.json()
    setDraftingId(null)
    if (result.error) {
      console.error('AI question generation error:', result.error)
      return flashError('Unable to draft AI questions. Please try again.')
    }
    const rows = (result.questions || []).map((q) => ({ stage_id: stage.id, text: q, approved: false }))
    const { error } = await supabase.from('questions').insert(rows)
    if (error) {
      console.error('Question save failed:', error)
      return flashError('Unable to save the drafted questions. Please try again.')
    }
    await refreshQuestions()
    flashMessage(`Fresh questions drafted for ${stage.name}.`)
  }

  async function actuallyDraftFromResume(stage, file) {
    if (!file) return
    setUploadingId(stage.id)
    flashMessage(`Reading document for ${stage.name}…`)
    await supabase.from('questions').delete().eq('stage_id', stage.id).eq('approved', false)
    const formData = new FormData()
    formData.append('resume', file)
    formData.append('stageName', stage.name)
    formData.append('level', stage.level)
    formData.append('topics', stage.topics || '')
    const res = await fetch('/api/generate-questions-from-resume', { method: 'POST', body: formData })
    const result = await res.json()
    setUploadingId(null)
    if (result.error) {
      console.error('Resume question generation error:', result.error)
      return flashError('Unable to draft questions from that document. Please try again.')
    }
    const rows = (result.questions || []).map((q) => ({ stage_id: stage.id, text: q, approved: false }))
    const { error } = await supabase.from('questions').insert(rows)
    if (error) {
      console.error('Question save failed (from resume):', error)
      return flashError('Unable to save the drafted questions. Please try again.')
    }
    await refreshQuestions()
    flashMessage(`Personalised questions drafted for ${stage.name}.`)
  }

  function handleDraftAI(stage) {
    const existing = (questionsByStage[stage.id] || []).filter((q) => !q.approved).length
    if (existing > 0) { setConfirmReplace({ stage, mode: 'ai' }); return }
    actuallyDraftAI(stage)
  }
  function handleDraftFromResume(stage, file) {
    if (!file) return
    const existing = (questionsByStage[stage.id] || []).filter((q) => !q.approved).length
    if (existing > 0) { setConfirmReplace({ stage, mode: 'resume', file }); return }
    actuallyDraftFromResume(stage, file)
  }

  async function handleAddManual(stage) {
    // Open the CustomQuestionModal — the actual DB write happens inside
    // the modal's Save handler so we can show validation + loading state.
    setCustomQuestionError('')
    setCustomQuestionStage(stage)
  }

  async function submitCustomQuestion(text) {
    const stage = customQuestionStage
    if (!stage || !text.trim()) return
    setCustomQuestionError('')
    setSavingCustomQuestion(true)
    try {
      const payload = { stage_id: stage.id, text: text.trim(), approved: true }
      const { data, error } = await supabase
        .from('questions')
        .insert(payload)
        .select()
        .single()
      if (error) {
        // Log the raw error internally — never surface Postgres / RLS
        // text or "see console" hints to recruiters.
        console.error('Custom question insert failed:', error)
        setCustomQuestionError('Unable to add this question. Please try again.')
        return
      }
      // Optimistically insert into local state so the user sees it
      // immediately, then refresh to sync any server-set defaults.
      if (data) setQuestions((prev) => [...prev, data])
      // Custom questions are inserted already approved, so warm their audio
      // straight away for the same reason as handleToggleQuestion.
      warmTtsCache([text.trim()])
      await refreshQuestions()
      setCustomQuestionStage(null)
      flashMessage('Custom question added.')
    } catch (e) {
      console.error('Custom question threw:', e)
      setCustomQuestionError('Unable to add this question. Please try again.')
    } finally {
      setSavingCustomQuestion(false)
    }
  }

  async function handleToggleQuestion(q) {
    const nowApproved = !q.approved
    await supabase.from('questions').update({ approved: nowApproved }).eq('id', q.id)
    setQuestions((prev) => prev.map((row) => row.id === q.id ? { ...row, approved: nowApproved } : row))
    // Approving a question means it WILL be asked, so synthesize its audio now
    // rather than making the first candidate wait ~73s on a cold GPU.
    // Deliberately not awaited — see lib/tts.js.
    if (nowApproved) warmTtsCache([q.text])
  }
  function handleDeleteQuestion(q) {
    // Route through a confirmation modal — no native window.confirm.
    // The actual DB call happens in confirmDeleteQuestion below so
    // failures can be handled with a proper toast instead of a
    // silent local-state drift.
    setPendingDeleteQuestion(q)
  }
  async function confirmDeleteQuestion() {
    if (!pendingDeleteQuestion) return
    const q = pendingDeleteQuestion
    setDeletingQuestion(true)
    const { error } = await supabase.from('questions').delete().eq('id', q.id)
    setDeletingQuestion(false)
    if (error) {
      console.error('Question delete failed:', error)
      flashError('Unable to delete this question. Please try again.')
      setPendingDeleteQuestion(null)
      return
    }
    setQuestions((prev) => prev.filter((row) => row.id !== q.id))
    setPendingDeleteQuestion(null)
    flashMessage('Question deleted.')
  }

  async function handleRoleSetStatus(next) {
    const prev = role?.status || 'active'
    setRole((r) => r ? ({ ...r, status: next }) : r)
    const { error } = await supabase.from('roles').update({ status: next }).eq('id', roleId)
    if (error) {
      setRole((r) => r ? ({ ...r, status: prev }) : r)
      console.error('Role status update failed:', error)
      flashError("Couldn't update this role's status. Please try again.")
      return
    }
    const label = next === 'paused' ? 'paused' : next === 'archived' ? 'archived' : 'active'
    flashMessage(`This role is now ${label}.`)
  }
  async function handleDeleteRoleConfirmed() {
    setDeletingRole(true)
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
      setConfirmDeleteRole(false)
      router.push('/roles')
    } catch (e) {
      console.error('Role delete failed:', e)
      flashError('Unable to delete this role. Please try again.')
      setConfirmDeleteRole(false)
    } finally {
      setDeletingRole(false)
    }
  }
  function handleDuplicate() {
    router.push(`/roles?duplicate=${roleId}`)
  }

  function handleTabChange(next) { setTab(next); if (next !== 'candidates') clearSelection() }
  function goCandidates(preset = {}) {
    if (preset.stage) setStageFilter(preset.stage)
    if (preset.status) setStatusFilter(preset.status)
    // "verdict" is an alias for status when the caller comes from
    // the pipeline-outcomes cards.  Shortlisted / On hold / Rejected
    // all map onto the same status enum the Candidates tab already
    // understands.
    if (preset.verdict) setStatusFilter(preset.verdict)
    setTab('candidates')
  }

  const recruiterName = recruiterSettings?.full_name || ''
  const companyName = recruiterSettings?.company_name || ''

  const activeStage = stages.find((s) => s.id === activeStageId) || null


  /* ── Render ───────────────────────────────── */

  const status = role?.status || 'active'

  return (
    <AppShell>
      <div className="max-w-[1180px] mx-auto pb-8">
        <Link
          href="/roles"
          className="inline-flex items-center gap-1.5 text-[13px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] transition-colors mb-6"
        >
          <ArrowLeft size={13} /> Back to roles
        </Link>

        <Toast kind="success" message={message} />
        <Toast kind="error" message={errorMsg} />

        <StatusBanner
          status={status}
          onResume={() => handleRoleSetStatus('active')}
          onRestore={() => handleRoleSetStatus('active')}
        />

        {loading ? (
          <div className="pt-4">
            <LoadingBlock />
          </div>
        ) : (
          <>
            <RoleHeader
              role={role}
              stages={stages}
              stats={stats}
              onOpenInvite={() => setInviteOpen(true)}
              onEdit={() => setEditRoleOpen(true)}
              onDuplicate={handleDuplicate}
              onSetStatus={handleRoleSetStatus}
              onDelete={() => setConfirmDeleteRole(true)}
              hasStatusColumn={hasStatusColumn}
            />

            <TabBar tab={tab} onChange={handleTabChange} />

            {tab === 'overview' && (
              <OverviewPanel
                role={role || { status: 'active' }}
                stages={stages}
                waitingList={waitingList}
                funnel={funnelArr}
                stats={stats}
                verdicts={verdicts}
                onOpenInvite={() => setInviteOpen(true)}
                onGoCandidatesFiltered={goCandidates}
                onGoInterviews={() => setTab('interviews')}
              />
            )}

            {tab === 'candidates' && (
              <CandidatesPanel
                candidates={candidates}
                stages={stages}
                search={search} onSearch={setSearch}
                stage={stageFilter} onStage={setStageFilter}
                statusFilter={statusFilter} onStatusFilter={setStatusFilter}
                sort={sort} onSort={setSort}
                selected={selected}
                onToggleSelect={toggleSelect}
                onSelectAll={selectAll}
                onClearSelection={clearSelection}
                onSetStatus={handleSetCandidateStatus}
                onBulkShortlist={handleBulkShortlist}
                onBulkReject={handleBulkReject}
                onBulkExport={handleBulkExport}
                busyBulk={busyBulk}
                onOpenInvite={() => setInviteOpen(true)}
              />
            )}

            {tab === 'interviews' && (
              <InterviewsPanel
                stages={stages}
                questionsByStage={questionsByStage}
                funnelById={funnelById}
                activeStageId={activeStageId}
                onSelectStage={setActiveStageId}
                onAddStage={handleAddStage}
                onEditStage={handleEditStage}
                onDeleteStage={(stage) => setConfirmDeleteStage(stage)}
                onDraftAI={handleDraftAI}
                onDraftFromResume={handleDraftFromResume}
                onAddManual={handleAddManual}
                onToggleQuestion={handleToggleQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                draftingId={draftingId}
                uploadingId={uploadingId}
                fileInputRef={fileInputRef}
              />
            )}
          </>
        )}

        <InviteDrawer
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          stages={stages}
          roleTitle={role?.title || 'this role'}
          roleStatus={status}
          origin={origin}
          recruiterName={recruiterName}
          companyName={companyName}
          defaultStageId={activeStage ? String(activeStage.id) : (stages[0]?.id ? String(stages[0].id) : '')}
          onSent={() => { refreshCandidates() }}
          inviteHistory={inviteHistory}
        />

        <DeleteRoleModal
          open={confirmDeleteRole}
          role={role}
          onClose={() => setConfirmDeleteRole(false)}
          onConfirm={handleDeleteRoleConfirmed}
          deleting={deletingRole}
        />

        <CustomQuestionModal
          stage={customQuestionStage}
          onClose={() => { setCustomQuestionStage(null); setCustomQuestionError('') }}
          onSubmit={submitCustomQuestion}
          saving={savingCustomQuestion}
          error={customQuestionError}
        />

        <Modal
          open={!!confirmDeleteStage}
          onClose={() => setConfirmDeleteStage(null)}
          title="Delete stage?"
          description={confirmDeleteStage ? `"${confirmDeleteStage.name}" will be removed along with its questions, invites, and scores.` : ''}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmDeleteStage(null)}>Cancel</Button>
              <Button variant="danger" onClick={handleDeleteStage}>Delete stage</Button>
            </>
          }
        >
          Candidates already in later stages are unaffected.
        </Modal>

        {/* Question deletion confirmation — replaces window.confirm. */}
        <Modal
          open={!!pendingDeleteQuestion}
          onClose={() => !deletingQuestion && setPendingDeleteQuestion(null)}
          title="Delete this question?"
          description="This question will be removed from the stage. Existing candidate transcripts are unaffected."
          size="sm"
          dismissible={!deletingQuestion}
          footer={
            <>
              <Button variant="ghost" onClick={() => setPendingDeleteQuestion(null)} disabled={deletingQuestion}>Cancel</Button>
              <Button variant="danger" onClick={confirmDeleteQuestion} loading={deletingQuestion}>Delete</Button>
            </>
          }
        >
          {pendingDeleteQuestion && (
            <p className="text-[13.5px] text-[color:var(--color-rc-muted)] italic">
              &ldquo;{pendingDeleteQuestion.text}&rdquo;
            </p>
          )}
        </Modal>

        <Modal
          open={!!confirmReplace}
          onClose={() => setConfirmReplace(null)}
          title="Replace existing drafts?"
          description={confirmReplace ? `${confirmReplace.stage.name} already has unapproved draft questions.` : ''}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmReplace(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const c = confirmReplace
                  setConfirmReplace(null)
                  if (c.mode === 'ai') actuallyDraftAI(c.stage)
                  else actuallyDraftFromResume(c.stage, c.file)
                }}
              >
                Replace drafts
              </Button>
            </>
          }
        >
          Approved questions are kept. Unapproved drafts will be replaced with a new set.
        </Modal>
      </div>
    </AppShell>
  )
}
