/**
 * Turning a model's read of a CV into something a recruiter can trust.
 *
 * Lives in lib/ rather than inside the route because two rules here are
 * the difference between an honest ranking and a flattering one, and
 * both are easy to weaken by accident later.
 */

export const MATCH_STATES = ['shown', 'claimed', 'absent']

/**
 * Normalise one requirement's verdict.
 *
 * THE RULE: "shown" requires a quote. A model asked whether a resume
 * demonstrates something will happily answer yes and then produce no
 * evidence, and an unquoted yes is indistinguishable from a guess. So a
 * "shown" with nothing to quote is downgraded to "claimed" — which is
 * not a punishment, it is just what it is.
 */
export function normaliseMatch(raw) {
  const asked = String(raw?.status || '').toLowerCase()
  const evidence = raw?.evidence ? String(raw.evidence).slice(0, 300) : null
  let status = MATCH_STATES.includes(asked) ? asked : 'absent'
  if (status === 'shown' && !evidence) status = 'claimed'
  return {
    requirement: String(raw?.requirement || '').slice(0, 120),
    status,
    evidence: status === 'shown' ? evidence : null,
  }
}

export function normaliseMatches(list, max = 8) {
  return (Array.isArray(list) ? list : []).slice(0, max).map(normaliseMatch)
}

export function countEvidence(matches = []) {
  return {
    shown: matches.filter((m) => m.status === 'shown').length,
    claimed: matches.filter((m) => m.status === 'claimed').length,
    total: matches.length,
  }
}

/**
 * Evidence first, then claims, then silence, then unreadable files.
 *
 * Claims rank above silence deliberately. Someone who says they ran email
 * campaigns without proving it is a better bet than someone who has never
 * mentioned email, and the interview is what settles which. Nothing is
 * ever removed from the list — a candidate a machine dropped never shows
 * up in any number the recruiter looks at.
 */
export function rankCandidates(results = []) {
  return [...results].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1
    if ((b.shown ?? 0) !== (a.shown ?? 0)) return (b.shown ?? 0) - (a.shown ?? 0)
    return (b.claimed ?? 0) - (a.claimed ?? 0)
  })
}

/**
 * True for the failures worth trying again: rate limits, and the
 * overloaded/5xx family. A malformed PDF fails identically forever, so
 * retrying it only makes the recruiter wait longer for the same answer.
 */
export function isTransient(err) {
  const status = err?.status ?? err?.response?.status
  if (typeof status !== 'number') return false
  return status === 429 || status === 408 || status === 409 || (status >= 500 && status < 600)
}

/**
 * Run `worker` over `items` with at most `limit` in flight.
 *
 * Results come back in the ORDER OF THE INPUT, not the order they
 * finished, because the caller pairs them with filenames by position.
 */
export async function mapWithLimit(items, limit, worker) {
  const list = Array.isArray(items) ? items : []
  const out = new Array(list.length)
  let next = 0
  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, list.length)) },
    async () => {
      while (true) {
        const i = next++
        if (i >= list.length) return
        out[i] = await worker(list[i], i)
      }
    },
  )
  await Promise.all(runners)
  return out
}

/** Total upload size we will attempt in one request, in bytes. */
export const MAX_BATCH_BYTES = 20 * 1024 * 1024

/**
 * Fold a freshly parsed batch into the rows already on screen.
 *
 * Two rules, both learned the hard way:
 *
 * 1. APPEND. Replacing was the original behaviour and it silently threw
 *    away everything the recruiter had already reviewed and corrected the
 *    moment they added one more file.
 * 2. A filename uploaded again REPLACES its old row rather than sitting
 *    beside it. Re-uploading a file means "read that one again", and two
 *    rows for one person is worse than either outcome.
 */
export function mergeCvRows(existing = [], incoming = []) {
  const names = new Set(incoming.map((c) => c.fileName))
  return [...existing.filter((r) => !names.has(r.fileName)), ...incoming]
}

