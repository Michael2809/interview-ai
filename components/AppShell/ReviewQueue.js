'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'

/**
 * ReviewQueue — shared, page-agnostic queue navigation.
 *
 * The Candidate List writes its currently-visible, currently-sorted,
 * currently-filtered list into sessionStorage under `QUEUE_KEY`. When
 * the recruiter opens any candidate transcript, the transcript page
 * mounts `<QueueNav>` which reads that queue and lets them page
 * through it forward/backward without leaving the review flow.
 *
 * The queue is intentionally *not* rebuilt on the transcript page —
 * so filters, search, and sort survive across a session's reviews.
 */

const QUEUE_KEY = 'recrewt:review-queue:v1'
const QUEUE_MAX_AGE_MS = 12 * 60 * 60 * 1000 // 12h — stale queues are ignored

/** Write the queue. Items should be [{ stageId, candidateName, href }]. */
export function writeReviewQueue(items) {
  if (typeof window === 'undefined') return
  try {
    const clean = (items || [])
      .filter((it) => it && it.stageId && it.candidateName && it.href)
      .map((it) => ({
        stageId: String(it.stageId),
        candidateName: String(it.candidateName),
        href: String(it.href),
      }))
    sessionStorage.setItem(
      QUEUE_KEY,
      JSON.stringify({ items: clean, updatedAt: Date.now() }),
    )
  } catch {
    // sessionStorage may be full or blocked — silent no-op.
  }
}

/** Read the queue. Returns [] if none or stale. */
export function readReviewQueue() {
  if (typeof window === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(QUEUE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!parsed || !Array.isArray(parsed.items)) return []
    if (typeof parsed.updatedAt !== 'number') return parsed.items
    if (Date.now() - parsed.updatedAt > QUEUE_MAX_AGE_MS) return []
    return parsed.items
  } catch {
    return []
  }
}

/** Clear the queue — called when the recruiter finishes the last candidate. */
export function clearReviewQueue() {
  if (typeof window === 'undefined') return
  try { sessionStorage.removeItem(QUEUE_KEY) } catch {}
}

/**
 * QueueNav — the compact "Review Queue · N of M" bar at the top of
 * the transcript page. Handles three states:
 *
 *   1. Queue exists AND current candidate is in it — shows position
 *      + Prev / Next buttons.
 *   2. Queue exists AND current is the last item AND user clicks Next —
 *      shows the "You're all caught up." state with a Return button.
 *   3. No queue OR current candidate isn't in the queue — renders
 *      nothing so the transcript's existing back-link continues to work.
 */
export default function QueueNav({ stageId, candidateName, backHref = '/candidates' }) {
  const router = useRouter()
  const [queue, setQueue] = useState(null)

  // Read the queue after mount so SSR stays deterministic.
  useEffect(() => {
    setQueue(readReviewQueue())
  }, [])

  const position = useMemo(() => {
    if (!Array.isArray(queue) || queue.length === 0) return -1
    const sid = String(stageId || '')
    const name = String(candidateName || '')
    return queue.findIndex(
      (it) => String(it.stageId) === sid && String(it.candidateName) === name,
    )
  }, [queue, stageId, candidateName])

  if (queue == null) return null // still hydrating
  if (queue.length === 0 || position < 0) return null // not in a queue

  const total = queue.length
  const idx = position
  const prev = idx > 0 ? queue[idx - 1] : null
  const next = idx < total - 1 ? queue[idx + 1] : null
  const isLast = idx === total - 1

  return (
    <nav
      aria-label="Review queue"
      className="mb-6 flex items-center justify-between gap-3 py-2 print:hidden"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Link
          href={backHref}
          aria-label="Return to Candidate List"
          className={
            'inline-flex items-center gap-1.5 text-[13px] text-[color:var(--color-rc-muted)] ' +
            'hover:text-[color:var(--color-rc-ink)] transition-colors duration-150 ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded'
          }
        >
          <ArrowLeft size={13} aria-hidden="true" />
          <span className="hidden sm:inline">Candidate List</span>
        </Link>
        <span aria-hidden="true" className="h-4 w-px bg-[color:var(--color-rc-line)]" />
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
            Review Queue
          </div>
          <div className="text-[13.5px] tabular-nums text-[color:var(--color-rc-ink)] leading-tight">
            <span className="font-semibold">{idx + 1}</span>
            <span className="text-[color:var(--color-rc-muted)]"> of {total}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => prev && router.push(prev.href)}
          disabled={!prev}
          aria-label="Previous candidate"
          className={
            'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-[8px] text-[12.5px] font-medium ' +
            'text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] ' +
            'hover:bg-[color:var(--color-rc-soft)] transition-colors duration-150 ' +
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[color:var(--color-rc-muted)] ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
          }
          title={prev ? `Previous · ${prev.candidateName}` : 'First candidate in queue'}
        >
          <ArrowLeft size={13} aria-hidden="true" />
          <span className="hidden sm:inline">Previous</span>
        </button>
        <button
          type="button"
          onClick={() => next && router.push(next.href)}
          disabled={!next}
          aria-label={next ? 'Review next candidate' : 'No more candidates awaiting review.'}
          className={
            'inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-[12.5px] font-medium ' +
            'bg-[color:var(--color-rc-ink)] text-white ' +
            'hover:bg-black transition-colors duration-150 ' +
            'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[color:var(--color-rc-ink)] ' +
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-1'
          }
          title={next ? `Next · ${next.candidateName}` : 'No more candidates awaiting review.'}
        >
          <span className="hidden sm:inline">Review Next</span>
          <ArrowRight size={13} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}

/**
 * CaughtUp — renders the "You're all caught up" panel. Called from the
 * transcript page when the recruiter clicks Next on the last item.
 * Not currently wired automatically — the recruiter chooses to click
 * Return via QueueNav's Candidate List link instead. Available here
 * for a future flow that captures the after-verdict "next" click.
 */
export function CaughtUp({ backHref = '/candidates' }) {
  return (
    <div className="rounded-[18px] bg-white border border-[color:var(--color-rc-line)] p-8 md:p-10 text-center">
      <div className="mx-auto h-10 w-10 rounded-full grid place-items-center bg-[color:var(--color-rc-soft)] text-[color:var(--color-rc-green)]">
        <CheckCircle2 size={18} aria-hidden="true" />
      </div>
      <h2
        className="mt-4 text-[22px] leading-tight font-semibold tracking-[-0.02em] text-[color:var(--color-rc-ink)]"
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        You&rsquo;re all caught up.
      </h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[46ch] mx-auto">
        You&rsquo;ve reviewed every candidate in this queue.
      </p>
      <div className="mt-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-[10px] text-[13.5px] font-medium bg-[color:var(--color-rc-ink)] text-white hover:bg-black transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
        >
          Return to Candidate List
        </Link>
      </div>
    </div>
  )
}
