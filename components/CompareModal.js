'use client'

/**
 * Two candidates, side by side.
 *
 * Shared by the role page and the Candidates page rather than copied
 * into both: a comparison that disagrees with itself depending on which
 * screen you opened is worse than no comparison.
 */

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Modal, Button } from '@/components/ui'
import {
  requirementIndex, scoresByRequirement, compareCandidates, compareHeadline, sameStage,
} from '@/lib/compare'

/* ─────────────────────────────────────────────────────────────
 * CompareModal — two candidates, requirement by requirement
 *
 * The overall scores are the least useful thing on this screen and are
 * deliberately not the headline. What decides a hire is the one or two
 * requirements where the two people are genuinely different, so those
 * are sorted to the top and quoted. Where they are level, it says so
 * rather than manufacturing a winner out of 7.1 versus 6.8.
 * ────────────────────────────────────────────────────────── */

function CompareBar({ value, lead }) {
  const pct = Math.max(0, Math.min(100, (Number(value) || 0) * 10))
  return (
    <div className="mt-1.5 h-1.5 rounded-full bg-[color:var(--color-rc-soft)] overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: lead ? 'var(--color-rc-green)' : 'var(--color-rc-line-hover)',
        }}
      />
    </div>
  )
}

function CompareSide({ cell, lead, quote }) {
  if (!cell) {
    return (
      <div className="text-[12.5px] text-[color:var(--color-rc-muted)] italic">
        Not asked
      </div>
    )
  }
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={
            'text-[16px] font-semibold tabular-nums ' +
            (lead ? 'text-[color:var(--color-rc-green)]' : 'text-[color:var(--color-rc-ink)]')
          }
        >
          {(Math.round(cell.score * 10) / 10).toFixed(1)}
        </span>
        <span className="text-[11.5px] text-[color:var(--color-rc-muted)]">/10</span>
      </div>
      <CompareBar value={cell.score} lead={lead} />
      {quote && cell.quote && (
        <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--color-rc-muted)] italic">
          &ldquo;{cell.quote}&rdquo;
        </p>
      )}
    </div>
  )
}

export default function CompareModal({ open, onClose, pair, stages }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)      // { a, b, questions }
  const [showQuotes, setShowQuotes] = useState(true)
  const supabase = createClient()

  const [A, B] = pair || []

  useEffect(() => {
    if (!open || !A || !B) return
    let alive = true
    ;(async () => {
      setLoading(true); setError(''); setData(null)
      try {
        const stageIds = [...new Set([A.latestStageId, B.latestStageId].filter(Boolean))]
        const [scoresRes, qRes] = await Promise.all([
          supabase.from('scores').select()
            .in('stage_id', stageIds.map(String)),
          supabase.from('questions').select('text, covers, source')
            .in('stage_id', stageIds).eq('approved', true),
        ])
        if (!alive) return
        if (scoresRes.error || qRes.error) throw new Error('Could not load the scores.')

        const pick = (c) => (scoresRes.data || []).find(
          (r) => String(r.stage_id) === String(c.latestStageId) &&
                 (r.candidate_name || '').toLowerCase() === (c.name || '').toLowerCase(),
        ) || null

        setData({ a: pick(A), b: pick(B), questions: qRes.data || [] })
      } catch (err) {
        if (alive) setError(err.message)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, A?.email, B?.email])

  const result = useMemo(() => {
    if (!data) return null
    const idx = requirementIndex(data.questions)
    return compareCandidates(
      { byRequirement: scoresByRequirement(data.a?.question_reviews, idx) },
      { byRequirement: scoresByRequirement(data.b?.question_reviews, idx) },
    )
  }, [data])

  const aName = A?.name || A?.email || 'Candidate A'
  const bName = B?.name || B?.email || 'Candidate B'
  const like = A && B ? sameStage(
    { stageId: A.latestStageId }, { stageId: B.latestStageId },
  ) : true

  const stageName = (id) => stages.find((s) => String(s.id) === String(id))?.name || null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compare"
      description="The requirements they differ on, largest gap first."
      size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      {loading ? (
        <p className="text-[13px] text-[color:var(--color-rc-muted)]">Loading…</p>
      ) : error ? (
        <p className="text-[13px] text-[color:var(--color-rc-red)]">{error}</p>
      ) : !result ? null : (
        <div>
          {/* Different stages means different questions. Saying so is the
              difference between a comparison and a false one. */}
          {!like && (
            <div className="mb-4 flex items-start gap-2.5 rounded-[12px] border border-[color:var(--color-rc-yellow)] bg-white px-3.5 py-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[color:var(--color-rc-warm)]" aria-hidden="true" />
              <p className="text-[12.5px] leading-relaxed text-[color:var(--color-rc-ink)]">
                These two sat different stages
                {stageName(A?.latestStageId) && stageName(B?.latestStageId)
                  ? ` (${stageName(A.latestStageId)} and ${stageName(B.latestStageId)})`
                  : ''}
                , so they answered different questions. Only requirements
                that appear on both sides are worth reading.
              </p>
            </div>
          )}

          {/* Names + overall, quiet on purpose */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 pb-3 border-b border-[color:var(--color-rc-line)]">
            {[[A, data.a, aName], [B, data.b, bName]].map(([cand, row, label], i) => (
              <div key={i} className="min-w-0">
                <div className="text-[14.5px] font-semibold text-[color:var(--color-rc-ink)] truncate"
                     style={{ fontFamily: 'var(--font-editorial), inherit' }}>
                  {label}
                </div>
                <div className="mt-0.5 text-[12px] text-[color:var(--color-rc-muted)] tabular-nums">
                  {row?.score != null ? `Overall ${(Math.round(row.score * 10) / 10).toFixed(1)}` : 'Not scored'}
                  {row?.recommendation ? ` · ${row.recommendation.replace('-', ' ')}` : ''}
                </div>
                <Link
                  href={`/interview/${cand?.latestStageId}/transcript?candidate=${encodeURIComponent(cand?.name || '')}`}
                  className="mt-1 inline-flex items-center gap-1 text-[12px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] underline underline-offset-2"
                >
                  Full interview <ArrowUpRight size={11} aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[14px] leading-relaxed text-[color:var(--color-rc-ink)]">
            {compareHeadline(result, aName, bName)}
          </p>

          {result.rows.length > 0 && (
            <label className="mt-3 inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showQuotes}
                onChange={(e) => setShowQuotes(e.target.checked)}
                className="h-3.5 w-3.5 accent-[color:var(--color-rc-ink)]"
              />
              <span className="text-[12.5px] text-[color:var(--color-rc-muted)]">
                Show what each of them actually said
              </span>
            </label>
          )}

          <div className="mt-4 grid gap-2.5">
            {result.rows.map((row) => (
              <div
                key={row.requirement}
                className={
                  'rounded-[12px] border bg-white px-4 py-3.5 ' +
                  (row.leader
                    ? 'border-[color:var(--color-rc-line-hover)]'
                    : 'border-[color:var(--color-rc-line)]')
                }
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[12.5px] font-medium text-[color:var(--color-rc-ink)]">
                    {row.requirement}
                  </span>
                  <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] font-semibold text-[color:var(--color-rc-muted)]">
                    {row.leader
                      ? `${row.leader === 'a' ? aName : bName} ahead`
                      : row.onlyOne
                        ? 'One side only'
                        : 'Level'}
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
                  <CompareSide cell={row.a} lead={row.leader === 'a'} quote={showQuotes} />
                  <CompareSide cell={row.b} lead={row.leader === 'b'} quote={showQuotes} />
                </div>
              </div>
            ))}
          </div>

          {result.rows.length === 0 && (
            <p className="mt-4 text-[13px] text-[color:var(--color-rc-muted)] italic">
              Neither interview has a per-question breakdown yet, so there is
              nothing to line up. Re-score one of them to compute it.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

