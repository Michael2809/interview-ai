"use client"

/**
 * The page a hiring manager opens.
 *
 * Read-only, no account, no navigation into the rest of the product.
 * There is deliberately no link back to the app, no candidate switcher
 * and no way to reach another result: whoever holds this link sees one
 * candidate and nothing else.
 *
 * It does not reuse the recruiter transcript page's components on
 * purpose. Those carry notes fields, a delete button, hiring-status
 * controls and a review queue, and threading a "read only" flag through
 * all of them would be one missed branch away from handing a client the
 * delete button. A separate render of the same data is the safer shape.
 */

import { useEffect, useState, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { ChevronDown, Play, Lock } from 'lucide-react'
import { STATE_COPY } from '@/lib/share'

/* ── Small shared bits, matching the recruiter surface ──────────── */

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
  if (n >= 85) return 'High'
  if (n >= 65) return 'Fair'
  if (n >= 45) return 'Mixed'
  return 'Low'
}

function scoreDisplay(score) {
  const n = Number(score)
  if (!Number.isFinite(n)) return null
  return (Math.round(n * 10) / 10).toFixed(1)
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

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
}

function normaliseQuestionKey(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function SectionLabel({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
      {children}
    </div>
  )
}

function recColor(rec) {
  if (rec === 'strong-hire' || rec === 'hire') return 'var(--color-rc-green)'
  if (rec === 'hold') return 'var(--color-rc-orange)'
  if (rec === 'reject') return 'var(--color-rc-red)'
  return 'var(--color-rc-muted)'
}

/* ── Blocks ─────────────────────────────────────────────────────── */

function Verdict({ score }) {
  const rec = score?.recommendation || recommendationFromScore(score?.score)
  const value = scoreDisplay(score?.score)
  const band = confidenceBand(score?.confidence)

  if (!score || (value == null && !rec)) {
    return (
      <div className="mt-8 rounded-[18px] border border-[color:var(--color-rc-line)] bg-white p-6">
        <SectionLabel>Assessment</SectionLabel>
        <p className="mt-3 text-[14px] leading-relaxed text-[color:var(--color-rc-muted)]">
          This interview has not been analysed yet. The transcript below is
          complete; the scoring is still to come.
        </p>
      </div>
    )
  }

  return (
    <div className="mt-8 rounded-[18px] border border-[color:var(--color-rc-line)] bg-white p-6 md:p-7">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        {value != null && (
          <div>
            <SectionLabel>Overall</SectionLabel>
            <div
              className="mt-1 text-[40px] leading-none font-semibold tabular-nums text-[color:var(--color-rc-ink)]"
              style={{ fontFamily: 'var(--font-editorial), inherit' }}
            >
              {value}
              <span className="text-[18px] text-[color:var(--color-rc-muted)] font-normal">/10</span>
            </div>
          </div>
        )}
        {rec && (
          <div>
            <SectionLabel>Recommendation</SectionLabel>
            <div
              className="mt-2 text-[19px] font-semibold"
              style={{ color: recColor(rec), fontFamily: 'var(--font-editorial), inherit' }}
            >
              {RECOMMENDATION_LABEL[rec] || rec}
            </div>
          </div>
        )}
        {band && (
          <div>
            <SectionLabel>Confidence</SectionLabel>
            <div className="mt-2 text-[19px] font-semibold text-[color:var(--color-rc-ink)]">
              {band}
              {Number.isFinite(Number(score.confidence)) && (
                <span className="ml-1.5 text-[13px] font-normal text-[color:var(--color-rc-muted)] tabular-nums">
                  {score.confidence}%
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {score.confidence_copy && (
        <p className="mt-5 pt-5 border-t border-[color:var(--color-rc-line)] text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[68ch]">
          {score.confidence_copy}
        </p>
      )}
    </div>
  )
}

function EvidenceCard({ title, evidence, concern }) {
  return (
    <div className="rounded-[16px] bg-white border border-[color:var(--color-rc-line)] p-5">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full"
          style={{ background: concern ? 'var(--color-rc-red)' : 'var(--color-rc-green)' }}
        />
        <div className="min-w-0">
          <h4
            className="text-[15.5px] leading-tight font-semibold tracking-[-0.012em] text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {title}
          </h4>
          {evidence && (
            <p className="mt-2 text-[13.5px] leading-relaxed">
              <span className="italic text-[color:var(--color-rc-ink)] opacity-90">&ldquo;{evidence}&rdquo;</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function QuestionRow({ qr, index, tag }) {
  const [open, setOpen] = useState(false)
  const value = scoreDisplay(qr?.score)
  return (
    <div className="rounded-[16px] bg-white border border-[color:var(--color-rc-line)] overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 md:px-5 py-4 flex items-start gap-3 hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
      >
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={'mt-1.5 shrink-0 text-[color:var(--color-rc-muted)] transition-transform ' + (open ? 'rotate-0' : '-rotate-90')}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
              Q{index}
            </span>
            {tag && <span className="text-[11.5px] leading-snug text-[color:var(--color-rc-muted)]">{tag}</span>}
          </div>
          <div className="mt-0.5 text-[14.5px] font-medium text-[color:var(--color-rc-ink)] leading-relaxed">
            {qr.question}
          </div>
        </div>
        {value != null && (
          <span className="shrink-0 inline-flex items-center h-6 px-2 rounded-full bg-[color:var(--color-rc-soft)] text-[12.5px] font-semibold text-[color:var(--color-rc-ink)] tabular-nums">
            {value}/10
          </span>
        )}
      </button>

      {open && (
        <div className="px-4 md:px-5 pb-5 border-t border-[color:var(--color-rc-line)]">
          {qr.evidence_quote && (
            <div className="mt-5">
              <SectionLabel>Candidate said</SectionLabel>
              <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--color-rc-ink)]">
                <span className="italic">&ldquo;{qr.evidence_quote}&rdquo;</span>
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
        </div>
      )}
    </div>
  )
}

function Recording({ url, durationMs }) {
  const [open, setOpen] = useState(false)
  if (!url) return null
  return (
    <section className="mt-10">
      <SectionLabel>Recording</SectionLabel>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 flex items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded p-1 -m-1"
        >
          <span className="shrink-0 h-10 w-10 rounded-full bg-[color:var(--color-rc-ink)] grid place-items-center">
            <Play size={14} className="text-white ml-0.5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-[13.5px] font-medium text-[color:var(--color-rc-ink)]">
              {durationMs ? formatDurationMs(durationMs) : 'Interview recording'}
            </span>
            <span className="block text-[12.5px] text-[color:var(--color-rc-muted)]">Watch the interview</span>
          </span>
        </button>
      ) : (
        <video
          controls
          autoPlay
          preload="metadata"
          src={url}
          className="mt-3 w-full max-w-[640px] rounded-lg bg-black"
          aria-label="Candidate interview recording"
        />
      )}
    </section>
  )
}

function Transcript({ lines, candidateName }) {
  const [open, setOpen] = useState(false)
  if (!Array.isArray(lines) || lines.length === 0) return null
  return (
    <section className="mt-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-2 text-[13.5px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded"
      >
        <ChevronDown size={13} aria-hidden="true" className={'transition-transform ' + (open ? 'rotate-0' : '-rotate-90')} />
        {open ? 'Hide full transcript' : 'Read the full transcript'}
      </button>
      {open && (
        <div className="mt-4 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-5 md:p-6 grid gap-4">
          {lines.map((line) => {
            const isInterviewer = line.speaker === 'interviewer'
            return (
              <div key={line.id} className={isInterviewer ? '' : 'pl-4 border-l-2 border-[color:var(--color-rc-line-hover)]'}>
                <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
                  {isInterviewer ? 'Interviewer' : (candidateName || 'Candidate')}
                </div>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[color:var(--color-rc-ink)]">
                  {String(line.content || '').trim()}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Unavailable({ reason }) {
  const copy = STATE_COPY[reason] || STATE_COPY.missing
  return (
    <main className="min-h-screen bg-[color:var(--color-rc-bg)] grid place-items-center px-6">
      <div className="max-w-[420px] text-center">
        <span className="inline-grid place-items-center h-11 w-11 rounded-full bg-white border border-[color:var(--color-rc-line)]">
          <Lock size={16} className="text-[color:var(--color-rc-muted)]" aria-hidden="true" />
        </span>
        <h1
          className="mt-5 text-[22px] font-semibold text-[color:var(--color-rc-ink)]"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
        >
          {copy.title}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--color-rc-muted)]">{copy.body}</p>
      </div>
    </main>
  )
}

/* ── Page ───────────────────────────────────────────────────────── */

export default function SharedResultPage() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch(`/api/shared/${token}`)
        const json = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok) { setError(json?.error || 'missing'); return }
        setData(json)
      } catch {
        if (alive) setError('missing')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [token])

  // Requirement tags are matched back by wording: the scorer echoes the
  // question text rather than an id.
  const tagByQuestion = useMemo(() => {
    const map = {}
    for (const q of data?.questions || []) {
      const key = normaliseQuestionKey(q.text)
      if (key) map[key] = q.source === 'custom' ? 'Recruiter question' : (q.covers || null)
    }
    return map
  }, [data])

  if (loading) {
    return (
      <main className="min-h-screen bg-[color:var(--color-rc-bg)] grid place-items-center">
        <p className="text-[13.5px] text-[color:var(--color-rc-muted)]">Loading the result…</p>
      </main>
    )
  }

  if (error || !data) return <Unavailable reason={error} />

  const { role, stage, sender, candidate, score, interview } = data
  const reviews = score?.question_reviews || []
  const strengths = score?.strengths || []
  const concerns = score?.concerns || []
  const unansweredCount = (interview?.candidateQuestions || []).filter((q) => !q.answered).length

  return (
    <main className="min-h-screen bg-[color:var(--color-rc-bg)]">
      <div className="mx-auto w-full max-w-[860px] px-5 md:px-8 py-10 md:py-14">

        {/* Who sent this, and what it is */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[color:var(--color-rc-muted)]">
          <span>{sender?.companyName ? `${sender.companyName} shared this with you` : 'Shared with you'}</span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1">
            <Lock size={11} aria-hidden="true" /> Read only
          </span>
        </div>

        <h1
          className="mt-3 text-[30px] md:text-[36px] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
        >
          {candidate?.name}
        </h1>
        <p className="mt-1.5 text-[14px] text-[color:var(--color-rc-muted)]">
          {[role?.title, stage?.name].filter(Boolean).join(' · ')}
          {interview?.startedAt && (
            <>
              {(role?.title || stage?.name) && <span aria-hidden="true"> · </span>}
              Interviewed {formatDate(interview.startedAt)}
            </>
          )}
        </p>

        <Verdict score={score} />

        {score?.summary && (
          <section className="mt-10">
            <SectionLabel>Summary</SectionLabel>
            <p className="mt-4 text-[15.5px] md:text-[16.5px] leading-relaxed text-[color:var(--color-rc-ink)] max-w-[68ch]">
              {score.summary}
            </p>
          </section>
        )}

        {strengths.length > 0 && (
          <section className="mt-10">
            <SectionLabel>Strengths</SectionLabel>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {strengths.map((s, i) => (
                <EvidenceCard key={'s' + i} title={s.title} evidence={s.evidence} />
              ))}
            </div>
          </section>
        )}

        {concerns.length > 0 && (
          <section className="mt-10">
            <SectionLabel>Concerns</SectionLabel>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {concerns.map((c, i) => (
                <EvidenceCard key={'c' + i} title={c.title} evidence={c.evidence} concern />
              ))}
            </div>
          </section>
        )}

        {reviews.length > 0 && (
          <section className="mt-10">
            <SectionLabel>Question by question</SectionLabel>
            <div className="mt-4 grid gap-3">
              {reviews.map((qr, i) => (
                <QuestionRow
                  key={i}
                  qr={qr}
                  index={i + 1}
                  tag={tagByQuestion[normaliseQuestionKey(qr.question)] || null}
                />
              ))}
            </div>
          </section>
        )}

        <Recording url={interview?.videoUrl} durationMs={interview?.durationMs} />

        {(interview?.candidateQuestions || []).length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline justify-between gap-3">
              <SectionLabel>They asked</SectionLabel>
              {unansweredCount > 0 && (
                <span className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
                  {unansweredCount} unanswered
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] text-[color:var(--color-rc-muted)]">
              Asked by the candidate at the end. Not part of the score.
            </p>
            <div className="mt-3 grid gap-2.5">
              {interview.candidateQuestions.map((qa, i) => (
                <div
                  key={i}
                  className={
                    'rounded-[12px] border bg-white px-4 py-3.5 ' +
                    (qa.answered
                      ? 'border-[color:var(--color-rc-line)]'
                      : 'border-[color:var(--color-rc-yellow)]')
                  }
                >
                  <p className="text-[13.5px] font-medium text-[color:var(--color-rc-ink)]">{qa.question}</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--color-rc-muted)]">
                    {qa.answered ? qa.answer : 'Nobody has answered this yet.'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <Transcript lines={interview?.transcript} candidateName={candidate?.name} />

        <footer className="mt-16 pt-6 border-t border-[color:var(--color-rc-line)] text-[12px] text-[color:var(--color-rc-muted)]">
          <p>
            Interviewed and assessed by{' '}
            <a
              href="https://recrewtai.com"
              className="underline underline-offset-2 hover:text-[color:var(--color-rc-ink)]"
            >
              Recrewt AI
            </a>
            . The recommendation is a machine assessment, not a hiring decision.
          </p>
          <p className="mt-1.5">
            Please keep this link private — it contains one person&rsquo;s interview.
          </p>
        </footer>
      </div>
    </main>
  )
}
