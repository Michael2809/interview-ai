'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { awaitingDecision } from '@/lib/decisions'
import { groupQuestions, interviewShape, canAddCustomQuestion, customQuestionCount, CUSTOM_QUESTION_LIMIT } from '@/lib/questions'
import CompareModal from '@/components/CompareModal'
import { mergeCvRows, MAX_BATCH_BYTES } from '@/lib/resumes'
import { warmTtsCache } from '@/lib/tts'
import Link from 'next/link'
import {
  ArrowLeft, Plus, ChevronRight, ChevronDown, MoreHorizontal, Search,
  Sparkles, Send, Loader, FileUp, X, Trash2, Copy, PauseCircle,
  Archive, ArchiveRestore, CheckCircle2, XCircle, Circle, GripVertical,
  Download, Clock, Users, Mail, Pencil, ArrowUpRight, AlertTriangle, Columns2,
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

/** Matches MAX_FILES in /api/parse-resumes. Kept in step by hand. */
const MAX_CVS = 25

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
  if (score >= 7) return 'suggest-shortlist'
  if (score >= 4) return 'suggest-review'
  return 'suggest-below-bar'
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

function BulkActionBar({ count, onClear, onShortlist, onReject, onExport, onCompare, busy }) {
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
      {/* Exactly two. Three-way beauty contests are how a shortlist
          becomes a shrug — the useful question is always between two
          people. */}
      <button
        type="button" onClick={onCompare} disabled={busy || count !== 2}
        title={count === 2 ? undefined : 'Select exactly two candidates to compare.'}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded text-[13px] font-medium hover:bg-white/10 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <Columns2 size={14} aria-hidden="true" /> Compare
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
  onSetStatus, onBulkShortlist, onBulkReject, onBulkExport, onCompare, busyBulk,
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
        onCompare={onCompare}
        busy={busyBulk}
      />
    </div>
  )
}


/* ─────────────────────────────────────────────────────────────
 * The questions section of the Interviews tab.
 *
 * One card per requirement, TWO drafted questions inside it, the better
 * one already selected. That shape is the whole argument. A single
 * forced question per requirement takes the judgement away from the only
 * person who knows the role; an open list of ten with checkboxes makes
 * them do the sorting. Two, pre-picked, is a decision a recruiter can
 * accept in three seconds or overrule in five.
 * ────────────────────────────────────────────────────────── */

/** A requirement string makes a poor HTML control name. */
function radioName(groupKey) {
  return 'req-' + String(groupKey).replace(/[^A-Za-z0-9_-]+/g, '-')
}

function QuestionChoice({ q, groupKey, chosen, onPick }) {
  return (
    <label
      className={
        'flex items-start gap-3 px-3.5 py-3 rounded-[10px] cursor-pointer border transition-colors ' +
        (chosen
          ? 'border-[color:var(--color-rc-ink)] bg-white'
          : 'border-transparent hover:bg-[color:var(--color-rc-soft)]')
      }
    >
      <input
        type="radio"
        name={radioName(groupKey)}
        checked={chosen}
        onChange={() => onPick(q)}
        className="mt-1 h-3.5 w-3.5 shrink-0 accent-[color:var(--color-rc-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      />
      <span className="text-[14px] leading-relaxed text-[color:var(--color-rc-ink)]">
        {q.text}
      </span>
    </label>
  )
}

function RequirementGroup({ group, index, onPick, onSkip }) {
  const chosen = group.options.find((o) => o.approved)
  return (
    <div className="rounded-[14px] border border-[color:var(--color-rc-line)] bg-[color:var(--color-rc-soft)]/40 p-3 md:p-3.5">
      <div className="flex items-baseline gap-2.5 px-1">
        <span className="text-[11px] tabular-nums font-semibold text-[color:var(--color-rc-muted)]">
          {String(index + 1).padStart(2, '0')}
        </span>
        <span className="text-[12.5px] leading-snug text-[color:var(--color-rc-ink)]">
          {group.covers}
        </span>
      </div>
      {/* Without this line the block reads as a checklist somebody forgot
          to finish. The unpicked options are alternatives, not unchecked
          boxes, and nothing on screen said so. */}
      <p className="mt-1 px-1 text-[11.5px] leading-snug text-[color:var(--color-rc-muted)]">
        {group.options.length > 2
          ? `Pick the one question to ask for this. ${group.options.length} drafts to choose from, and the ones you do not pick are never asked.`
          : 'Pick the one question to ask for this. The other is not asked.'}
      </p>
      <div className="mt-2 grid gap-1">
        {group.options.map((o) => (
          <QuestionChoice
            key={o.id}
            q={o}
            groupKey={group.key}
            chosen={!!o.approved}
            onPick={onPick}
          />
        ))}
        <label className="flex items-center gap-3 px-3.5 py-2 rounded-[10px] cursor-pointer hover:bg-[color:var(--color-rc-soft)]">
          <input
            type="radio"
            name={radioName(group.key)}
            checked={!chosen}
            onChange={() => onSkip(group)}
            className="h-3.5 w-3.5 shrink-0 accent-[color:var(--color-rc-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
          />
          <span className="text-[12.5px] text-[color:var(--color-rc-muted)]">
            Skip this one
          </span>
        </label>
      </div>
    </div>
  )
}

/** A plain asked / not-asked row, for questions that have no pair. */
function ToggleQuestionRow({ q, onToggle, onDelete }) {
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

/* ─────────────────────────────────────────────────────────────
 * CalibrationPanel — what the recruiter knows that the JD doesn't say.
 *
 * Both questions are now ASKED in the create-role drawer, while the
 * requirements are on screen and the questions have not been written
 * yet. This panel is where they get CHANGED, which is not the same job:
 * the honest answer to "what separates a great one" usually arrives
 * after the third candidate, not before the first, and a recruiter who
 * cannot revise it is stuck with a bar they guessed at.
 *
 * Collapsed by default, and it re-drafts the questions on save.
 *
 * Two prompts, not four. "Why is this role open?" changed nothing about
 * the interview, and dealbreakers asked recruiters to predict rejection
 * reasons before meeting anyone — the scorer still reads the column, it
 * just is not worth a field. Both prompts here are about HIRING
 * JUDGEMENT, never job trivia: Recrewt sells to agencies, where the
 * recruiter was handed a JD by a client and had one call about it. Ask
 * them internal operational detail and they genuinely do not know.
 * ────────────────────────────────────────────────────────── */

function CalibrationPanel({ role, stage, onCalibrated }) {
  const musts = useMemo(
    () => (Array.isArray(role?.must_haves) ? role.must_haves : [])
      .map((m) => (typeof m === 'string' ? m : m?.label)).filter(Boolean),
    [role],
  )

  const [open, setOpen] = useState(false)
  const [flexible, setFlexible] = useState(() =>
    Array.isArray(role?.flexible_criteria) ? role.flexible_criteria : [])
  const [greatVsOkay, setGreatVsOkay] = useState(role?.great_vs_okay || '')
  const [saving, setSaving] = useState(false)
  const [revisions, setRevisions] = useState(null)
  const [err, setErr] = useState('')

  const done = !!role?.calibrated_at
  const answered = flexible.length > 0 || !!greatVsOkay.trim()

  // The panel opens edited, not blank: these are answers the recruiter
  // already gave when creating the role.
  useEffect(() => {
    setFlexible(Array.isArray(role?.flexible_criteria) ? role.flexible_criteria : [])
    setGreatVsOkay(role?.great_vs_okay || '')
  }, [role?.id, role?.flexible_criteria, role?.great_vs_okay])

  function toggleFlexible(label) {
    setFlexible((list) => list.includes(label)
      ? list.filter((l) => l !== label)
      : [...list, label])
  }

  async function save() {
    setSaving(true); setErr(''); setRevisions(null)
    try {
      const res = await fetch('/api/calibrate-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: role.id,
          stageId: stage?.id || null,
          flexible,
          greatVsOkay,
          // Kept on the role, no longer asked for here.
          dealbreakers: role?.dealbreakers || '',
          openingReason: role?.opening_reason || '',
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) { setErr(data.error || 'Could not save.'); return }
      setRevisions(data.revisions || [])
      await onCalibrated?.()
    } catch (e) {
      console.error('calibrate failed:', e)
      setErr('Could not save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-10 pt-6 border-t border-[color:var(--color-rc-line)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-start justify-between gap-4 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
      >
        <div className="min-w-0">
          <SectionLabel>{done ? 'Your hiring bar' : 'Sharpen these'}</SectionLabel>
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[62ch]">
            {done
              ? 'What you told Recrewt when you created this role. Change it any time and the questions are redrafted to match.'
              : 'You skipped these when you created the role. Two answers, and Recrewt judges candidates the way you would.'}
          </p>
        </div>
        <ChevronDown
          size={16}
          aria-hidden="true"
          className={'shrink-0 mt-1 text-[color:var(--color-rc-muted)] transition-transform duration-200 ' + (open ? 'rotate-180' : '')}
        />
      </button>

      {open && (
        <div className="mt-6 grid gap-7">
          {musts.length > 0 && (
            <div>
              <p className="text-[13.5px] font-medium text-[color:var(--color-rc-ink)]">
                Would you bend on any of them?
              </p>
              <p className="mt-1 text-[12.5px] text-[color:var(--color-rc-muted)]">
                Tick the ones you would still hire someone without, and they count for half.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {musts.map((m) => {
                  const on = flexible.includes(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleFlexible(m)}
                      aria-pressed={on}
                      className={
                        'h-8 px-3 rounded-[8px] text-[13px] border transition-colors duration-150 ' +
                        (on
                          ? 'border-[color:var(--color-rc-yellow)] bg-[rgb(244_196_48_/_0.14)] text-[color:var(--color-rc-ink)]'
                          : 'border-[color:var(--color-rc-line)] bg-white text-[color:var(--color-rc-muted)] hover:border-[color:var(--color-rc-ink)] hover:text-[color:var(--color-rc-ink)]')
                      }
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <CalField
            label="What separates a great one from an okay one?"
            hint="One sentence in your own words. Candidates never see this — it aims the questions at ground where the difference shows."
            value={greatVsOkay}
            onChange={setGreatVsOkay}
            placeholder="e.g. the good ones can say what they'd do differently, not just what they did"
          />

          {err && (
            <p className="text-[13px] text-[color:var(--color-rc-red)] bg-[rgb(199_75_58_/_0.06)] rounded px-3 py-2">
              {err}
            </p>
          )}

          <div className="flex items-center gap-3">
            <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!answered}>
              {done ? 'Update' : 'Apply to these questions'}
            </Button>
            {!answered && (
              <span className="text-[12.5px] text-[color:var(--color-rc-muted)]">
                Answer whichever you know. Skip the rest.
              </span>
            )}
          </div>

          {/* The consequence. Without this the panel is busywork. */}
          {revisions && (
            revisions.length === 0 ? (
              <p className="text-[13px] leading-relaxed text-[color:var(--color-rc-muted)]">
                Saved. The questions already covered this, so none needed rewriting.
                Recrewt will use what you said when it scores the answers.
              </p>
            ) : (
              <div className="grid gap-3">
                <p className="text-[13px] text-[color:var(--color-rc-ink)]">
                  {revisions.length} question{revisions.length === 1 ? '' : 's'} rewritten.
                </p>
                {revisions.map((r) => (
                  <div key={r.id} className="rounded-[12px] border border-[color:var(--color-rc-line)] bg-white p-4">
                    <p className="text-[13px] leading-relaxed text-[color:var(--color-rc-muted)] line-through decoration-[color:var(--color-rc-line)]">
                      {r.before}
                    </p>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-rc-ink)]">
                      {r.after}
                    </p>
                    {r.why && (
                      <p className="mt-2 text-[12px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
                        {r.why}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

function CalField({ label, hint, value, onChange, placeholder }) {
  const id = 'cal-' + label.slice(0, 18).toLowerCase().replace(/[^a-z]+/g, '-')
  return (
    <div>
      <label htmlFor={id} className="block text-[13.5px] font-medium text-[color:var(--color-rc-ink)]">
        {label}
      </label>
      {hint && <p className="mt-1 text-[12.5px] text-[color:var(--color-rc-muted)]">{hint}</p>}
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="mt-2.5 w-full block bg-white text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3.5 py-2.5 text-[14.5px] transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] resize-none"
      />
    </div>
  )
}

function StageEditPanel({
  stage, questions, role, onEditStage, onDeleteStage,
  onDraftAI, onAddManual,
  onPickQuestion, onSkipRequirement,
  onToggleQuestion, onDeleteQuestion, onCalibrated,
  draftingId,
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

  const { groups, untagged, custom } = useMemo(() => groupQuestions(questions), [questions])
  const shape = useMemo(() => interviewShape(questions.filter((q) => q.approved)), [questions])
  const canAddOwn = canAddCustomQuestion(questions)

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

      {/* Questions. Two per requirement, better one pre-selected. */}
      <div className="mt-8 flex items-end justify-between gap-4 flex-wrap">
        <div className="max-w-xl">
          <SectionLabel>The interview</SectionLabel>
          <h4
            className="mt-3 text-[16px] leading-snug font-semibold tracking-[-0.015em] text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {shape.picked === 0
              ? 'No questions chosen yet.'
              : `Every candidate answers the same ${shape.picked} question${shape.picked === 1 ? '' : 's'}, and is scored on those.`}
          </h4>
          {shape.picked > 0 && (
            <p className="mt-1.5 text-[13px] tabular-nums text-[color:var(--color-rc-muted)]">
              About {shape.minutes} minutes · {shape.answers} recorded answers
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* "From document" lived here and read a CANDIDATE'S CV.
              Removed, not deleted: /api/generate-questions-from-resume is
              untouched and still works. The problem was where it was
              wired. Questions belong to the stage, and the stage is
              shared by everyone, so one applicant's CV silently shaped
              the questions every later candidate was asked and scored
              on. It comes back once resumes are attached to candidates
              instead, at which point it can personalise for the one
              person it was read from. */}
          <Button variant="secondary" size="sm" iconLeft={<Sparkles size={14} />} onClick={() => onDraftAI(stage)} loading={isDrafting}>
            {groups.length ? 'Draft again' : 'Draft with AI'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            iconLeft={<Plus size={14} />}
            onClick={() => onAddManual(stage)}
            disabled={!canAddOwn}
            title={canAddOwn ? undefined : `You can add up to ${CUSTOM_QUESTION_LIMIT} of your own.`}
          >
            Write your own
          </Button>
        </div>
      </div>

      {/* Three answers is not a ranking, it is a coin toss with extra
          steps. Say so here rather than letting them find out after
          twenty candidates have already sat the thing. */}
      {shape.picked > 0 && shape.picked < 4 && (
        <div className="mt-4 flex items-start gap-2.5 rounded-[12px] border border-[color:var(--color-rc-line)] bg-white px-3.5 py-3">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[color:var(--color-rc-warm)]" aria-hidden="true" />
          <p className="text-[12.5px] leading-relaxed text-[color:var(--color-rc-ink)]">
            Under four questions is thin ground for a score. Two candidates can come
            out identical on three answers, and you end up watching every video anyway.
          </p>
        </div>
      )}

      <div className="mt-4 grid gap-2.5">
        {groups.length === 0 && untagged.length === 0 && custom.length === 0 ? (
          <p className="text-[13.5px] text-[color:var(--color-rc-muted)] italic px-3 py-4">
            No questions yet. Draft with AI, upload a job document, or write your own.
          </p>
        ) : (
          groups.map((g, i) => (
            <RequirementGroup
              key={g.key}
              group={g}
              index={i}
              onPick={onPickQuestion}
              onSkip={onSkipRequirement}
            />
          ))
        )}
      </div>

      {untagged.length > 0 && (
        <div className="mt-6">
          <SectionLabel>Not tied to a requirement</SectionLabel>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
            Drafted before this role had confirmed requirements. They are still
            asked and still scored, there is just nothing recorded about what
            each one is testing, so the score cannot show its working. Draft
            again to replace them with questions tied to what you are hiring for.
          </p>
          <div className="mt-2 grid gap-0.5">
            {untagged.map((q) => (
              <ToggleQuestionRow key={q.id} q={q} onToggle={onToggleQuestion} onDelete={onDeleteQuestion} />
            ))}
          </div>
        </div>
      )}

      {custom.length > 0 && (
        <div className="mt-6">
          <SectionLabel>Your own questions</SectionLabel>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
            Scored exactly like the ones above. Nothing follows up on these — you
            asked precisely what you meant to ask.{' '}
            {canAddOwn
              ? `${custom.length} of ${CUSTOM_QUESTION_LIMIT} used.`
              : `That is both of your ${CUSTOM_QUESTION_LIMIT}. Delete one to write another.`}
          </p>
          <div className="mt-2 grid gap-0.5">
            {custom.map((q) => (
              <ToggleQuestionRow key={q.id} q={q} onToggle={onToggleQuestion} onDelete={onDeleteQuestion} />
            ))}
          </div>
        </div>
      )}

      {(groups.length > 0 || untagged.length > 0 || custom.length > 0) && (
        <p className="mt-5 text-[12px] leading-relaxed text-[color:var(--color-rc-muted)]">
          Candidates also get a practice question that is not recorded, three opening
          questions about themselves and their background, and one follow-up on each
          drafted question above. The openers are transcribed and shown to you, but
          none of them move the score.
        </p>
      )}

      {/* Calibration. Shown only once there are drafted questions: the
          whole point is that answering visibly improves something the
          recruiter is already looking at. */}
      {questions.length > 0 && role && (
        <CalibrationPanel role={role} stage={stage} onCalibrated={onCalibrated} />
      )}

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
  stages, questionsByStage, funnelById, role,
  activeStageId, onSelectStage,
  onAddStage, onEditStage, onDeleteStage,
  onDraftAI, onAddManual,
  onPickQuestion, onSkipRequirement,
  onToggleQuestion, onDeleteQuestion, onCalibrated,
  draftingId,
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
      {/* Sticky: the rail is short and the panel beside it is long, so
          without this the whole left column is blank white the moment you
          scroll, which reads as a broken layout. */}
      <div className="min-w-0 md:sticky md:top-24 md:self-start">
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
            role={role}
            onCalibrated={onCalibrated}
            onEditStage={onEditStage}
            onDeleteStage={onDeleteStage}
            onDraftAI={onDraftAI}
            onAddManual={onAddManual}
            onPickQuestion={onPickQuestion}
            onSkipRequirement={onSkipRequirement}
            onToggleQuestion={onToggleQuestion}
            onDeleteQuestion={onDeleteQuestion}
            draftingId={draftingId}
          />
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
 * InviteDrawer — unified invite surface
 * ────────────────────────────────────────────────────────── */

/**
 * One address, tested without side effects.
 *
 * Deliberately NOT the /g regex used for scraping addresses out of a
 * pasted blob: `.test()` on a global regex advances lastIndex, so
 * calling it twice on the same string returns true then false. Scraping
 * and validating need different objects.
 */
function isEmail(value) {
  return /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(String(value || '').trim())
}

/**
 * One parsed CV, as a row the recruiter can correct.
 *
 * The match detail is collapsed by default. A recruiter scanning twenty
 * of these wants the name, the score and whether the email looks right;
 * the evidence matters only for the two or three they are unsure about,
 * and showing it for everyone turns the list into a wall.
 */
/**
 * Six little segments: filled where the CV proves it, outlined where it
 * only claims it, empty where it never comes up.
 *
 * A percentage was the obvious thing here and the wrong one. Real CVs are
 * lists of responsibilities, so honest scoring puts almost everybody in
 * the teens, and "17%" reads like a grade the candidate failed rather
 * than "this document does not contain evidence". Counts of a known total
 * cannot be misread that way.
 */
function EvidenceBar({ matches }) {
  if (!matches?.length) return null
  return (
    <span className="inline-flex items-center gap-[3px] shrink-0" aria-hidden="true">
      {matches.map((m, i) => (
        <span
          key={i}
          className={
            'block h-[14px] w-[5px] rounded-[1px] ' +
            (m.status === 'shown'
              ? 'bg-[color:var(--color-rc-ink)]'
              : m.status === 'claimed'
                ? 'border border-[color:var(--color-rc-line-hover)] bg-transparent'
                : 'bg-[color:var(--color-rc-line)]')
          }
        />
      ))}
    </span>
  )
}

function CvRow({ row, onToggle, onEmailChange, onRemove }) {
  const [open, setOpen] = useState(false)
  const total = row.total ?? row.matches?.length ?? 0
  const shown = row.shown ?? 0
  const claimed = row.claimed ?? 0
  const emailOk = isEmail(row.email)

  if (!row.ok) {
    return (
      <div className="group min-w-0 flex items-start gap-3 px-3 py-2.5 rounded-[10px] bg-[color:var(--color-rc-soft)]">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[color:var(--color-rc-warm)]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] text-[color:var(--color-rc-ink)] truncate">{row.fileName}</p>
          <p className="text-[12.5px] text-[color:var(--color-rc-muted)]">
            {row.error || 'Could not read this file.'} Add them by email instead.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(row.key)}
          aria-label={`Remove ${row.fileName}`}
          className="shrink-0 h-6 w-6 grid place-items-center rounded text-[color:var(--color-rc-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[color:var(--color-rc-red)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
        >
          <X size={13} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div className="group min-w-0 rounded-[12px] border border-[color:var(--color-rc-line)] px-3 py-2.5">
      <div className="flex items-start gap-3 min-w-0">
        <input
          type="checkbox"
          checked={!!row.include}
          disabled={!emailOk}
          onChange={() => onToggle(row.key)}
          aria-label={`Invite ${row.name || row.fileName}`}
          className="mt-1 h-4 w-4 shrink-0 rounded border border-[color:var(--color-rc-line-hover)] accent-[color:var(--color-rc-ink)] focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] disabled:opacity-40"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="text-[14px] font-medium text-[color:var(--color-rc-ink)]">
              {row.name || row.fileName}
            </span>
            {total > 0 && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="text-[12px] text-[color:var(--color-rc-muted)] underline decoration-dotted underline-offset-4 hover:text-[color:var(--color-rc-ink)]"
              >
                Shows {shown} of {total}
                {claimed > 0 ? `, claims ${claimed} more` : ''}
              </button>
            )}
          </div>
          {row.headline && (
            <p className="mt-0.5 text-[12.5px] text-[color:var(--color-rc-muted)] truncate">{row.headline}</p>
          )}

          <input
            type="email"
            value={row.email}
            onChange={(e) => onEmailChange(row.key, e.target.value)}
            placeholder="No email found — type theirs"
            aria-label={`Email for ${row.name || row.fileName}`}
            className={
              'mt-1.5 w-full bg-white text-[13px] rounded px-2.5 py-1.5 border transition-colors focus:outline-none focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] ' +
              (emailOk
                ? 'border-[color:var(--color-rc-line)] text-[color:var(--color-rc-ink)]'
                : 'border-[color:var(--color-rc-warm)] text-[color:var(--color-rc-ink)]')
            }
          />
          {!emailOk && (
            <p className="mt-1 text-[12px] text-[color:var(--color-rc-warm)]">
              {row.email ? 'That does not look like an address.' : 'No address found in this CV.'} Fix it to invite them.
            </p>
          )}
          {emailOk && row.needsCheck && (
            <p className="mt-1 text-[12px] text-[color:var(--color-rc-muted)]">
              Worth checking. This CV had more than one address, or the text around it was unclear.
            </p>
          )}

          {open && total > 0 && (
            <ul className="mt-2.5 grid gap-1.5 border-t border-[color:var(--color-rc-line)] pt-2.5">
              {row.matches.map((m, i) => (
                <li key={i} className="text-[12.5px] leading-relaxed break-words">
                  <span className={m.status === 'absent'
                    ? 'text-[color:var(--color-rc-muted)]'
                    : 'text-[color:var(--color-rc-ink)]'}>
                    {m.status === 'shown' ? '✓' : m.status === 'claimed' ? '~' : '—'} {m.requirement}
                  </span>
                  {m.status === 'shown' && m.evidence && (
                    <span className="block pl-3.5 text-[color:var(--color-rc-muted)] italic break-words">
                      &ldquo;{m.evidence}&rdquo;
                    </span>
                  )}
                  {m.status === 'claimed' && (
                    <span className="block pl-3.5 text-[color:var(--color-rc-muted)]">
                      Says so, nothing to quote. Worth asking about.
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <EvidenceBar matches={row.matches} />
          <button
            type="button"
            onClick={() => onRemove(row.key)}
            aria-label={`Remove ${row.name || row.fileName}`}
            className="h-6 w-6 grid place-items-center rounded text-[color:var(--color-rc-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[color:var(--color-rc-red)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
          >
            <X size={13} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

function InviteDrawer({
  open, onClose, stages, roleId, roleTitle, roleStatus,
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

  // ── CVs ────────────────────────────────────────────────────────
  // Read, ranked, and handed back for a human to check. Nothing is sent
  // from the parse itself: CV parsing gets addresses wrong often enough
  // that auto-sending would eventually fire interview invites at the
  // wrong people, from the customer's own domain.
  const [cvRows, setCvRows] = useState([])
  const [cvBusy, setCvBusy] = useState(false)
  const [cvError, setCvError] = useState('')
  // The role's requirements, which are the same for every batch. The
  // per-batch counts that used to live alongside them are derived from
  // cvRows now: kept as state, a second upload reported the second
  // batch's numbers as if they described the whole list.
  const [cvCriteria, setCvCriteria] = useState(null)
  const cvInputRef = useRef(null)
  // Row keys must be unique across batches. Keying on position restarted
  // at zero every upload, so batch two collided with batch one and React
  // reused the wrong rows.
  const cvKeySeq = useRef(0)
  const [listNote, setListNote] = useState('')
  const [listBusy, setListBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setStageId(defaultStageId || (stages[0]?.id ? String(stages[0].id) : ''))
      setEmailsText(''); setMessage(''); setResult(null); setProgress({ sent: 0, total: 0 })
      setCvRows([]); setCvBusy(false); setCvError(''); setCvCriteria(null)
      cvKeySeq.current = 0
      setListNote('')
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
  // isEmail(), not EMAIL_RE.test(): the /g flag makes .test() stateful,
  // so the same address alternated between valid and invalid here.
  const invalid = useMemo(() => rawTokens.filter((t) => !isEmail(t)), [rawTokens])

  /** Fold harvested addresses into the box and say what happened. */
  function absorbAddresses(found, fileName, extra = '') {
    const unique = [...new Set(found.map((v) => String(v).trim().toLowerCase()).filter(Boolean))]
    if (!unique.length) {
      setListNote(`No email addresses in ${fileName}.`)
      return
    }
    const existing = new Set(
      emailsText.split(/[\n,;]+/).map((t) => t.trim().toLowerCase()).filter(Boolean),
    )
    const added = unique.filter((u) => !existing.has(u)).length
    setEmailsText([...new Set([...unique, ...existing])].join('\n'))
    setListNote(
      (added === 0
        ? `Every address in ${fileName} was already in the list.`
        : `Added ${added} address${added === 1 ? '' : 'es'} from ${fileName}.`) + extra,
    )
  }

  /**
   * Take a LIST of people in whatever form it arrived.
   *
   * Spreadsheets and text files are scraped in the browser: it is instant,
   * it costs nothing, and a regex over the real characters is more
   * faithful than asking a model to retype addresses it might tidy up.
   *
   * PDFs cannot be read that way — as text they are binary noise — so they
   * go to the server. That is worth the round trip, because a shortlist
   * arriving as a PDF from a client is a normal Tuesday and the previous
   * answer was "no, convert it yourself first".
   */
  async function handleListUpload(file) {
    if (!file) return
    const name = file.name || 'that file'
    const plainText = /\.(csv|txt|tsv)$/i.test(name)

    if (plainText) {
      const reader = new FileReader()
      reader.onerror = () => setListNote(`Could not read ${name}.`)
      reader.onload = (e) => absorbAddresses(String(e.target.result || '').match(EMAIL_RE) || [], name)
      reader.readAsText(file)
      return
    }

    setListBusy(true)
    setListNote('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/extract-emails', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setListNote(data.error || `Could not read ${name}.`)
        return
      }
      // One address in a whole document is one person's CV in the wrong
      // control. Take the address, but say what the better route was, or
      // they lose everything else the CV would have told them.
      absorbAddresses(
        data.emails || [],
        name,
        data.looksLikeOneCv
          ? ' That looks like one person\u2019s CV. Upload it above instead and Recrewt will rank them too.'
          : '',
      )
    } catch (err) {
      console.error('extract-emails threw:', err)
      setListNote(`Could not read ${name}.`)
    } finally {
      setListBusy(false)
    }
  }

  async function handleCvUpload(picked) {
    const files = Array.from(picked || [])
    if (!files.length) return

    // Caught here rather than server-side, where the whole batch was
    // rejected and the recruiter lost the ones that would have been fine.
    const room = MAX_CVS - cvRows.length
    if (room <= 0) {
      setCvError(`That is the ${MAX_CVS} limit. Send these, then upload the rest.`)
      return
    }
    if (files.length > room) {
      setCvError(`Only ${room} more will fit. Reading the first ${room}.`)
    } else {
      setCvError('')
    }
    const batch = files.slice(0, room)

    // A single request carrying 25 multi-page PDFs is rejected by the
    // server before any of our code runs, which surfaced as a bare
    // "could not read those files" with no hint that size was the issue.
    const bytes = batch.reduce((n, f) => n + (f.size || 0), 0)
    if (bytes > MAX_BATCH_BYTES) {
      setCvError(
        `That is ${Math.round(bytes / 1024 / 1024)}MB in one go, which is too much. ` +
        'Upload them in two or three smaller batches.',
      )
      return
    }

    setCvBusy(true)
    try {
      const fd = new FormData()
      batch.forEach((f) => fd.append('resumes', f))
      if (roleId) fd.append('roleId', String(roleId))
      const res = await fetch('/api/parse-resumes', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) {
        setCvError(data.error || 'Could not read those files. Please try again.')
        return
      }
      // Pre-ticked only where we are confident. Anything flagged, or with
      // no address at all, starts unticked so it has to be looked at.
      const incoming = (data.candidates || []).map((c) => ({
        ...c,
        key: `cv-${cvKeySeq.current++}`,
        email: c.email || '',
        include: !!(c.ok && isEmail(c.email) && !c.needsCheck),
      }))
      setCvRows((rows) => mergeCvRows(rows, incoming))
      setCvCriteria(Array.isArray(data.criteria) ? data.criteria : [])
    } catch (err) {
      console.error('parse-resumes threw:', err)
      setCvError('Could not read those files. Please try again.')
    } finally {
      setCvBusy(false)
    }
  }

  function removeCvRow(key) {
    setCvRows((rows) => rows.filter((r) => r.key !== key))
  }

  function toggleCvRow(key) {
    setCvRows((rows) => rows.map((r) => r.key === key ? { ...r, include: !r.include } : r))
  }

  function setCvEmail(key, email) {
    setCvRows((rows) => rows.map((r) => {
      if (r.key !== key) return r
      // Correcting a flagged address clears the flag: the human just
      // checked it, which is the only check that was ever wanted.
      return { ...r, email, needsCheck: r.needsCheck && email === r.email }
    }))
  }

  const cvCounts = useMemo(() => ({
    needsCheck: cvRows.filter((r) => r.ok && r.needsCheck).length,
    unreadable: cvRows.filter((r) => !r.ok).length,
  }), [cvRows])

  const cvEmails = useMemo(
    () => cvRows
      .filter((r) => r.ok && r.include && isEmail(r.email))
      .map((r) => r.email.trim().toLowerCase()),
    [cvRows],
  )

  /** Typed addresses and ticked CVs, deduped. */
  const recipients = useMemo(
    () => Array.from(new Set([...valid, ...cvEmails])),
    [valid, cvEmails],
  )

  /**
   * The split, counted against the deduped list rather than subtracted
   * from it. Someone who appears in a CV and is also typed into the box
   * gets one invitation, and "6 from CVs and 2 typed in" has to still add
   * up to the 7 on the button.
   */
  const recipientSplit = useMemo(() => {
    const fromCvs = new Set(cvEmails)
    const cv = recipients.filter((e) => fromCvs.has(e)).length
    return { cv, typed: recipients.length - cv }
  }, [recipients, cvEmails])

  const canSend =
    !sending &&
    !cvBusy &&
    (roleStatus === 'active') &&
    !!stageId &&
    recipients.length > 0

  async function send() {
    if (!canSend) return
    setResult(null)
    setSending(true)
    setProgress({ sent: 0, total: recipients.length })
    const BATCH = 10
    let sent = 0
    const failed = []
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH)
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
      setProgress({ sent, total: recipients.length })
    }
    setSending(false)
    setResult({ sent, failed })
    if (sent > 0) onSent?.({ sent, failed, stageId })
  }

  function reset() {
    setEmailsText(''); setMessage(''); setResult(null); setProgress({ sent: 0, total: 0 })
    setCvRows([]); setCvError(''); setCvCriteria(null)
    cvKeySeq.current = 0
    setListNote('')
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
              {recipients.length > 0 ? `Send ${recipients.length}` : 'Send'}
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

          {/* CVs first: it is the path that does the most work for them,
              and the emails box below is the fallback for anyone the CVs
              did not cover. */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]">
                From CVs
              </label>
              <input
                ref={cvInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.txt"
                className="hidden"
                onChange={(e) => {
                  // Copy the FileList into a real array BEFORE clearing the
                  // input. `input.files` is live: resetting value empties the
                  // same object we are holding, so the handler received zero
                  // files and returned without a sound.
                  const picked = Array.from(e.target.files || [])
                  e.target.value = ''
                  handleCvUpload(picked)
                }}
              />
              <button
                type="button"
                onClick={() => cvInputRef.current?.click()}
                disabled={isPaused || cvBusy}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[color:var(--color-rc-ink)] underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 hover:decoration-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded disabled:opacity-50 disabled:no-underline"
              >
                <FileUp size={13} /> {cvRows.length ? `Add more (${cvRows.length}/${MAX_CVS})` : 'Upload CVs'}
              </button>
            </div>

            {cvRows.length === 0 && !cvBusy && (
              <p className="text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
                Drop in up to 25 at once. Recrewt pulls out the name and email,
                and ranks them against what you said this role needs. Nobody is
                rejected and nothing is sent until you press send.
              </p>
            )}

            {cvBusy && (
              <div className="flex items-center gap-2.5 py-3">
                <Spinner />
                <span className="text-[13px] text-[color:var(--color-rc-muted)]">
                  Reading the CVs. About five seconds each.
                </span>
              </div>
            )}

            {cvError && (
              <p className="mt-1 text-[13px] text-[color:var(--color-rc-red)] bg-[rgb(199_75_58_/_0.06)] rounded px-3 py-2">
                {cvError}
              </p>
            )}

            {cvRows.length > 0 && (
              <>
                {cvCriteria?.length === 0 && (
                  <p className="mb-2 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
                    This role has no confirmed requirements, so these are not
                    ranked. Names and emails only.
                  </p>
                )}
                {cvCriteria?.length > 0 && (
                  <p className="mb-2 text-[12px] leading-relaxed text-[color:var(--color-rc-muted)]">
                    Most CVs list responsibilities rather than results, so a low
                    count means the document does not prove it, not that the
                    person cannot do it. <strong className="font-medium text-[color:var(--color-rc-ink)]">Shows</strong> is
                    something they did, quoted. <strong className="font-medium text-[color:var(--color-rc-ink)]">Claims</strong> is
                    said but not evidenced. The interview is what settles it.
                  </p>
                )}
                <div className="grid gap-1.5 min-w-0">
                  {cvRows.map((row) => (
                    <CvRow
                      key={row.key}
                      row={row}
                      onToggle={toggleCvRow}
                      onEmailChange={setCvEmail}
                      onRemove={removeCvRow}
                    />
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-3 flex-wrap text-[12.5px]" aria-live="polite">
                  <span className="text-[color:var(--color-rc-muted)]">
                    <strong className="text-[color:var(--color-rc-ink)] tabular-nums">{cvEmails.length}</strong> of {cvRows.length} ticked
                  </span>
                  {cvCounts.needsCheck > 0 && (
                    <span className="text-[color:var(--color-rc-warm)] tabular-nums">
                      {cvCounts.needsCheck} address{cvCounts.needsCheck === 1 ? '' : 'es'} worth checking
                    </span>
                  )}
                  {cvCounts.unreadable > 0 && (
                    <span className="text-[color:var(--color-rc-muted)] tabular-nums">
                      {cvCounts.unreadable} unreadable
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[13px] font-medium text-[color:var(--color-rc-ink)] tracking-[-0.005em]">
                {cvRows.length ? 'Anyone else' : 'Emails'} <span className="text-[color:var(--color-rc-ink)]">•</span>
              </label>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.txt,.tsv,.pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleListUpload(f) }}
              />
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                disabled={isPaused || listBusy}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[color:var(--color-rc-ink)] underline decoration-[color:var(--color-rc-yellow)] decoration-2 underline-offset-4 hover:decoration-[3px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded disabled:opacity-50 disabled:no-underline"
              >
                <FileUp size={13} /> {listBusy ? 'Reading…' : 'Add from a list'}
              </button>
            </div>
            {cvRows.length > 0 && (
              <p className="mb-1.5 text-[12.5px] leading-relaxed text-[color:var(--color-rc-muted)]">
                For people with no CV in the list above: a referral, someone who
                emailed you, a name off LinkedIn. They get the same invite. A
                shortlist from a client works here too, as a spreadsheet, a PDF
                or a Word file.
              </p>
            )}
            <textarea
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              rows={5}
              disabled={isPaused}
              placeholder="One email per line, or comma / semicolon separated"
              className="w-full block bg-white text-[14.5px] text-[color:var(--color-rc-ink)] leading-relaxed border border-[color:var(--color-rc-line)] rounded placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 px-3.5 py-2.5 transition-colors duration-150 hover:border-[color:var(--color-rc-line-hover)] focus:outline-none focus:border-[color:var(--color-rc-ink)] focus:ring-2 focus:ring-[color:var(--color-rc-yellow)] focus:ring-offset-0 resize-none disabled:opacity-60"
            />
            {/* Only ever says something it has something to say. An empty
                box reporting "0 valid" beside "3 going out in total" reads
                as a contradiction, or as a failure. */}
            <div className="mt-2 flex items-center gap-3 flex-wrap text-[12.5px] empty:mt-0" aria-live="polite">
              {listNote && (
                <span className="text-[color:var(--color-rc-muted)]">{listNote}</span>
              )}
              {valid.length > 0 && (
                <span className="text-[color:var(--color-rc-muted)]">
                  <strong className="text-[color:var(--color-rc-ink)] tabular-nums">{valid.length}</strong> typed in
                </span>
              )}
              {invalid.length > 0 && (
                <span className="text-[color:var(--color-rc-red)]">
                  <strong className="tabular-nums">{invalid.length}</strong> not an address
                </span>
              )}
              {invalid.length > 0 && (
                <span className="text-[color:var(--color-rc-muted)] truncate max-w-[180px]" title={invalid.join(', ')}>
                  · {invalid.slice(0, 2).join(', ')}{invalid.length > 2 ? `, +${invalid.length - 2}` : ''}
                </span>
              )}
            </div>

            {/* The only total that matters, said once, where the eye lands
                before the Send button. */}
            {recipients.length > 0 && (
              <p className="mt-3 text-[13px] text-[color:var(--color-rc-ink)]">
                <strong className="tabular-nums">{recipients.length}</strong> invitation{recipients.length === 1 ? '' : 's'} will go out
                {recipientSplit.cv > 0 && recipientSplit.typed > 0
                  ? `, ${recipientSplit.cv} from CVs and ${recipientSplit.typed} typed in.`
                  : '.'}
              </p>
            )}
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

/* ─────────────────────────────────────────────────────────────
 * EditRoleModal
 *
 * "Edit role" sat in the menu setting a state variable nothing read, so
 * it did nothing at all — and there was no other way to change a role's
 * title anywhere in the product. A recruiter who mistyped a job title
 * was stuck with it in front of every candidate.
 *
 * Deliberately narrow: the things a recruiter wants to correct after the
 * fact. Requirements and questions have their own screens, and changing
 * them after candidates have interviewed would silently move the goal
 * posts on people already scored.
 * ────────────────────────────────────────────────────────── */

const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship']
const EXPERIENCE_LEVELS = ['Entry', 'Mid', 'Senior', 'Lead']

function EditRoleModal({ open, role, onClose, onSaved }) {
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [employmentType, setEmploymentType] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  // Refill from the role every time the modal opens, so a cancelled edit
  // is really cancelled rather than lingering in the fields.
  useEffect(() => {
    if (!open) return
    setTitle(role?.title || '')
    setDepartment(role?.department || '')
    setEmploymentType(role?.employment_type || '')
    setExperienceLevel(role?.experience_level || '')
    setError('')
  }, [open, role])

  async function save() {
    const clean = title.trim()
    if (!clean) { setError('A role needs a title.'); return }
    setSaving(true)
    setError('')

    const patch = {
      title: clean,
      department: department.trim() || null,
      employment_type: employmentType || null,
      experience_level: experienceLevel || null,
    }

    const { data, error: err } = await supabase
      .from('roles').update(patch).eq('id', role.id).select().maybeSingle()

    setSaving(false)
    if (err || !data) {
      console.error('Role update failed:', err)
      setError('That did not save. Please try again.')
      return
    }
    onSaved(data)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title="Edit role"
      description="Candidates see the title. Everything else is for your own filtering."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>Save changes</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextField
          label="Job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="e.g. Public Relations Executive"
        />
        <TextField
          label="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          maxLength={80}
          placeholder="Optional"
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Employment type"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value)}
            options={[
              { value: '', label: 'Not set' },
              ...EMPLOYMENT_TYPES.map((v) => ({ value: v, label: v })),
            ]}
          />
          <Select
            label="Experience level"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            options={[
              { value: '', label: 'Not set' },
              ...EXPERIENCE_LEVELS.map((v) => ({ value: v, label: v })),
            ]}
          />
        </div>
        {error && (
          <p className="text-[13px] text-[color:var(--color-rc-red)]">{error}</p>
        )}
      </div>
    </Modal>
  )
}

function RoleActionMenuHeader({ role, onEdit, onSetStatus, onDelete, hasStatusColumn }) {
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
          {/* "Duplicate" lived here and only navigated to the roles list.
              There is no role-duplication feature to reach; the button was
              a signpost to nothing. Gone until one exists. */}
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

function RoleHeader({ role, stages, stats, onOpenInvite, onEdit, onSetStatus, onDelete, hasStatusColumn }) {
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
  //
  // The query comes from useSearchParams(), NOT window.location. During a
  // client-side push — which is how creating a role lands you here on
  // ?tab=interviews — window.location has not caught up by the time this
  // initialiser runs, so reading it silently dropped the tab and left
  // people on Overview hunting for the questions we just drafted.
  const initialTabQuery = searchParams?.get('tab')
  const [tab, setTab] = useState(() => {
    if (initialTabQuery && TABS.includes(initialTabQuery)) return initialTabQuery
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

  // Belt and braces: if the query says a tab and we somehow rendered
  // another one (hydration, a back/forward, a push that beat the state),
  // the URL wins. Runs once per distinct query value, so it cannot fight
  // the recruiter clicking a tab.
  useEffect(() => {
    if (initialTabQuery && TABS.includes(initialTabQuery)) setTab(initialTabQuery)
  }, [initialTabQuery])

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
  const [comparePair, setComparePair] = useState(null)
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
  const [confirmReplace, setConfirmReplace] = useState(null)  // { stage }
  const [editRoleOpen, setEditRoleOpen] = useState(false)

  // Question drafting state
  const [draftingId, setDraftingId] = useState(null)
  const [customQuestionStage, setCustomQuestionStage] = useState(null)
  const [savingCustomQuestion, setSavingCustomQuestion] = useState(false)
  const [customQuestionError, setCustomQuestionError] = useState('')

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
      supabase.from('questions').select().order('id', { ascending: true }),
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
    // Ordered by id so the two options written for one requirement stay
    // side by side, and the requirements stay in the order the JD listed
    // them. PostgREST does not promise insertion order without this.
    const { data } = await supabase.from('questions').select().order('id', { ascending: true })
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
      else if (completedCount > 0 && awaitingDecision(latestStatus)) derivedStatus = 'waiting'
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
  function openCompare() {
    const picked = candidates.filter((c) => selected.has(c.email))
    if (picked.length !== 2) return
    setComparePair(picked)
  }
  function clearSelection() { setSelected(new Set()) }

  async function upsertVerdicts(cands, status) {
    // For each candidate, for each stage they've completed with an existing
    // score row, update status; otherwise insert a new scores row.
    //
    // Returns a real tally. Every caller used to announce success for the
    // whole selection regardless of what happened — including candidates
    // it skipped outright, and writes that silently touched no rows.
    let saved = 0, failed = 0, skipped = 0
    setBusyBulk(true)
    for (const c of cands) {
      for (const sid of c.stageIds) {
        // Somebody who has not finished has no verdict to record. Counted
        // so the caller can say so rather than including them in a total
        // that implies they were dealt with.
        if (!c.completedCount) { skipped += 1; continue }

        const existing = scores.find((s) => String(s.stage_id) === String(sid) && (s.candidate_name || '').toLowerCase() === (c.name || '').toLowerCase())
        if (existing) {
          /* No `.eq('id', existing.id ?? null)` any more. A null id there
             matched nothing and still returned no error, so the verdict
             silently went nowhere while the toast said it saved. The two
             filters below identify the row on their own. */
          const { data, error } = await supabase.from('scores')
            .update({ status })
            .eq('stage_id', String(sid))
            .eq('candidate_name', c.name || '')
            .select('id')
          if (error || !data || data.length === 0) {
            console.error('verdict update failed for', c.name, error)
            failed += 1
          } else {
            saved += 1
          }
        } else if (c.name) {
          const { error } = await supabase.from('scores').insert({
            stage_id: String(sid),
            candidate_name: c.name,
            score: c.latestScore ?? null,
            status,
            summary: null,
          })
          if (error) {
            console.error('verdict insert failed for', c.name, error)
            failed += 1
          } else {
            saved += 1
          }
        }
      }
    }
    setBusyBulk(false)
    await refreshCandidates()
    return { saved, failed, skipped }
  }

  async function handleSetCandidateStatus(cand, status) {
    const r = await upsertVerdicts([cand], status)
    if (r.saved > 0) {
      flashMessage(`Marked ${getCandidateDisplayName(cand)} as ${status.replace('-', ' ')}.`)
    } else if (r.skipped > 0) {
      flashError(`${getCandidateDisplayName(cand)} has not finished the interview yet.`)
    } else {
      flashError('That verdict did not save. Please try again.')
    }
  }

  /** One wording for both bulk verdicts, so they cannot drift apart. */
  function reportVerdicts(r, verb) {
    if (r.saved === 0) {
      flashError(
        r.skipped > 0
          ? 'Nobody selected has finished their interview yet.'
          : 'Nothing saved. Please try again.',
      )
      return
    }
    const parts = [`${verb} ${r.saved} candidate${r.saved === 1 ? '' : 's'}`]
    if (r.skipped > 0) parts.push(`${r.skipped} skipped (not finished)`)
    if (r.failed > 0) parts.push(`${r.failed} failed`)
    const msg = parts.join(' · ') + '.'
    if (r.failed > 0) flashError(msg); else flashMessage(msg)
  }

  async function handleBulkShortlist() {
    const list = candidates.filter((c) => selected.has(c.email))
    if (list.length === 0) return
    reportVerdicts(await upsertVerdicts(list, 'shortlisted'), 'Shortlisted')
    clearSelection()
  }
  async function handleBulkReject() {
    const list = candidates.filter((c) => selected.has(c.email))
    if (list.length === 0) return
    reportVerdicts(await upsertVerdicts(list, 'rejected'), 'Rejected')
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

    /* The three cascade deletes were unchecked while only the final
       stage delete was. If a cascade failed and the stage delete
       succeeded, the stage vanished and its candidates' transcripts and
       scores were left orphaned with nothing able to reach them — then
       "Stage deleted." Now the stage row goes last, and only if
       everything under it is genuinely gone. */
    for (const [label, q] of [
      ['questions',  supabase.from('questions').delete().eq('stage_id', stageId)],
      ['interviews', supabase.from('interviews').delete().eq('stage_id', stageId)],
      ['scores',     supabase.from('scores').delete().eq('stage_id', String(stageId))],
    ]) {
      const { error: cascadeErr } = await q
      if (cascadeErr) {
        console.error(`Stage delete failed clearing ${label}:`, cascadeErr)
        flashError('Unable to delete this stage. Nothing was removed — please try again.')
        return
      }
    }

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
    /* Generate FIRST, delete second.
     *
     * The delete used to run before the request, so a failed or timed-out
     * generation left the stage with no AI questions at all — the
     * recruiter's existing interview destroyed in exchange for nothing.
     * Nothing is removed now until replacements are in hand. */
    const res = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stageName: stage.name,
        // Seniority and skill focus still shape the questions. The JD
        // criteria say WHAT to ask about; these say how hard to pitch it.
        level: stage.level,
        topics: stage.topics,
        roleTitle: role?.title || null,
        // Confirmed on the JD intake screen. Absent on hand-typed roles,
        // in which case the API falls back to topic-based generation.
        mustHaves: role?.must_haves || [],
        flexible: role?.flexible_criteria || [],
        greatVsOkay: role?.great_vs_okay || null,
      }),
    })
    /* res.ok checked before parsing. A gateway timeout or a Next error
       page is not JSON, and res.json() threw inside this un-guarded async
       function — so setDraftingId(null) never ran and the button stayed
       on "Drafting…" forever. */
    if (!res.ok) {
      setDraftingId(null)
      console.error('AI question generation failed:', res.status)
      return flashError(
        res.status === 403
          ? 'Your plan does not currently allow drafting questions.'
          : 'Unable to draft AI questions. Please try again.',
      )
    }
    const result = await res.json().catch(() => ({}))
    setDraftingId(null)
    if (result.error) {
      console.error('AI question generation error:', result.error)
      return flashError('Unable to draft AI questions. Please try again.')
    }
    // The first option of each pair arrives already selected. A recruiter
    // who reads them, agrees, and sends the invite gets a complete
    // interview without touching a single control.
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
    if (!rows.length) {
      console.error('AI question generation returned no usable groups:', result)
      return flashError('Unable to draft AI questions. Please try again.')
    }

    /* Only now are the old ones removed. Every drafted question goes,
       picked or not: keeping the old picks would leave the recruiter
       choosing between two sets written against different criteria.
       Their own written questions are never touched. */
    const { error: clearErr } = await supabase
      .from('questions').delete().eq('stage_id', stage.id).neq('source', 'custom')
    if (clearErr) {
      console.error('Clearing old questions failed:', clearErr)
      return flashError('Unable to replace the old questions. Please try again.')
    }

    const { error } = await supabase.from('questions').insert(rows)
    if (error) {
      console.error('Question save failed:', error)
      return flashError('Unable to save the drafted questions. Please try again.')
    }
    await refreshQuestions()
    // Pre-selected questions WILL be asked, so synthesize their audio now
    // rather than making the first candidate wait on a cold GPU.
    warmTtsCache(rows.filter((r) => r.approved).map((r) => r.text))
    flashMessage(`Fresh questions drafted for ${stage.name}.`)
  }

  function handleDraftAI(stage) {
    // Any drafted question at all, picked or not — a redraft replaces the
    // lot, so the confirmation has to fire even when they have chosen one.
    const existing = (questionsByStage[stage.id] || []).filter((q) => q.source !== 'custom').length
    if (existing > 0) { setConfirmReplace({ stage }); return }
    actuallyDraftAI(stage)
  }
  async function handleAddManual(stage) {
    // The disabled button is the polite guard; this is the real one. A
    // stale click, a keyboard activation on a just-disabled control, or a
    // second tab all reach here, and the limit has to hold in every case.
    if (!canAddCustomQuestion(questionsByStage[stage.id] || [])) {
      return flashError(`You can add up to ${CUSTOM_QUESTION_LIMIT} of your own questions. Delete one to write another.`)
    }
    // Open the CustomQuestionModal — the actual DB write happens inside
    // the modal's Save handler so we can show validation + loading state.
    setCustomQuestionError('')
    setCustomQuestionStage(stage)
  }

  async function submitCustomQuestion(text) {
    const stage = customQuestionStage
    if (!stage || !text.trim()) return
    setCustomQuestionError('')
    // Re-checked at write time: the modal can sit open while another tab
    // adds one, and the count it was opened with is stale by then.
    if (!canAddCustomQuestion(questionsByStage[stage.id] || [])) {
      setCustomQuestionError(`You can add up to ${CUSTOM_QUESTION_LIMIT} of your own questions.`)
      return
    }
    setSavingCustomQuestion(true)
    try {
      // source: 'custom' is what stops the interview page chasing this
      // with a generated follow-up, and what labels it "your question"
      // on the transcript instead of a JD requirement.
      const payload = { stage_id: stage.id, text: text.trim(), approved: true, covers: null, source: 'custom' }
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

  /**
   * Choosing one question for a requirement un-chooses its sibling.
   *
   * Both writes are fired even though only one of them changes what the
   * candidate sees: leaving the loser approved would quietly double the
   * interview, and the recruiter would have no way to tell from this
   * screen because the radio only shows one of them selected.
   */
  async function handlePickQuestion(q) {
    const siblings = q.covers
      ? (questionsByStage[q.stage_id] || []).filter(
          (row) => row.id !== q.id && row.source !== 'custom' && row.covers === q.covers,
        )
      : []
    const siblingIds = siblings.map((s) => s.id)
    setQuestions((prev) => prev.map((row) => {
      if (row.id === q.id) return { ...row, approved: true }
      if (siblingIds.includes(row.id)) return { ...row, approved: false }
      return row
    }))
    if (siblingIds.length) {
      /* Checked. The comment above this function names the exact damage
         of losing this write — the loser stays approved, the candidate
         is asked both near-identical questions, and the radio still
         shows one selected so the recruiter cannot tell. It was the one
         write here that went unchecked. */
      const { error: loserErr } = await supabase
        .from('questions').update({ approved: false }).in('id', siblingIds)
      if (loserErr) {
        console.error('Question un-pick failed:', loserErr)
        flashError('Unable to save that choice. Please try again.')
        await refreshQuestions()
        return
      }
    }
    const { error } = await supabase.from('questions').update({ approved: true }).eq('id', q.id)
    if (error) {
      console.error('Question pick failed:', error)
      flashError('Unable to save that choice. Please try again.')
      await refreshQuestions()
      return
    }
    warmTtsCache([q.text])
  }

  async function handleSkipRequirement(group) {
    const ids = group.options.filter((o) => o.approved).map((o) => o.id)
    if (!ids.length) return
    setQuestions((prev) => prev.map((row) => ids.includes(row.id) ? { ...row, approved: false } : row))
    const { error } = await supabase.from('questions').update({ approved: false }).in('id', ids)
    if (error) {
      console.error('Question skip failed:', error)
      flashError('Unable to save that choice. Please try again.')
      await refreshQuestions()
    }
  }

  async function handleToggleQuestion(q) {
    const nowApproved = !q.approved
    /* Checked, like every sibling handler around it — this one was
       missed. Candidates are served only approved questions, so an
       unnoticed failure here means the recruiter is looking at one
       interview while candidates sit a different one. */
    const { error } = await supabase
      .from('questions').update({ approved: nowApproved }).eq('id', q.id)
    if (error) {
      console.error('Question toggle failed:', error)
      flashError('Unable to save that change. Please try again.')
      await refreshQuestions()
      return
    }
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
      /* Every step checked.
       *
       * These five deletes ran unchecked and the page navigated away
       * regardless. supabase-js RESOLVES with an error rather than
       * throwing, so the catch below was unreachable for exactly the
       * failures that matter — a partial delete left transcripts and
       * scores orphaned with nothing pointing at them, and the recruiter
       * was told it worked. */
      const step = async (label, q) => {
        const { error } = await q
        if (error) throw new Error(`${label}: ${error.message}`)
      }

      const { data: stageRows, error: stagesErr } = await supabase
        .from('stages').select('id').eq('role_id', roleId)
      if (stagesErr) throw new Error(`stage lookup: ${stagesErr.message}`)

      const stageIds = (stageRows || []).map((s) => s.id)
      if (stageIds.length > 0) {
        await step('questions', supabase.from('questions').delete().in('stage_id', stageIds))
        await step('interviews', supabase.from('interviews').delete().in('stage_id', stageIds))
        await step('scores', supabase.from('scores').delete().in('stage_id', stageIds.map(String)))
      }
      await step('stages', supabase.from('stages').delete().eq('role_id', roleId))
      await step('role', supabase.from('roles').delete().eq('id', roleId))

      setConfirmDeleteRole(false)
      router.push('/roles')
    } catch (e) {
      console.error('Role delete failed:', e)
      flashError('Unable to delete this role. Nothing was removed that we could not remove cleanly — please try again.')
      setConfirmDeleteRole(false)
    } finally {
      setDeletingRole(false)
    }
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
                onCompare={openCompare}
                busyBulk={busyBulk}
                onOpenInvite={() => setInviteOpen(true)}
              />
            )}

            {tab === 'interviews' && (
              <InterviewsPanel
                stages={stages}
                questionsByStage={questionsByStage}
                funnelById={funnelById}
                role={role}
                onCalibrated={loadEverything}
                activeStageId={activeStageId}
                onSelectStage={setActiveStageId}
                onAddStage={handleAddStage}
                onEditStage={handleEditStage}
                onDeleteStage={(stage) => setConfirmDeleteStage(stage)}
                onDraftAI={handleDraftAI}
                onAddManual={handleAddManual}
                onPickQuestion={handlePickQuestion}
                onSkipRequirement={handleSkipRequirement}
                onToggleQuestion={handleToggleQuestion}
                onDeleteQuestion={handleDeleteQuestion}
                draftingId={draftingId}
              />
            )}
          </>
        )}

        <EditRoleModal
          open={editRoleOpen}
          role={role}
          onClose={() => setEditRoleOpen(false)}
          onSaved={(updated) => {
            setRole((r) => ({ ...(r || {}), ...updated }))
            flashMessage('Role updated.')
          }}
        />

        <CompareModal
          open={!!comparePair}
          onClose={() => setComparePair(null)}
          pair={comparePair}
          stages={stages}
        />

        <InviteDrawer
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          stages={stages}
          roleId={roleId}
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
          title="Draft a new set?"
          description={confirmReplace ? `${confirmReplace.stage.name} already has drafted questions.` : ''}
          size="sm"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmReplace(null)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  const c = confirmReplace
                  setConfirmReplace(null)
                  actuallyDraftAI(c.stage)
                }}
              >
                Draft a new set
              </Button>
            </>
          }
        >
          Every drafted question is replaced, including the ones you picked. Questions
          you wrote yourself are kept.
        </Modal>
      </div>
    </AppShell>
  )
}
