/**
 * Putting two candidates next to each other.
 *
 * A recruiter does not decide by staring at 7.4 and 6.9. They decide by
 * finding the one or two requirements where the two people are actually
 * different, and reading what each said there. So the comparison is
 * built per requirement, and sorted by the size of the gap: the rows
 * that could change your mind come first, and the rows where they are
 * level sink to the bottom.
 *
 * Pure. No React, no Supabase.
 */

/** The scorer echoes question text back, not ids. Match on the words. */
export function normaliseQuestionKey(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

/**
 * requirement label for each question, from the stage's question rows.
 * Custom questions get a label of their own rather than a made-up
 * requirement: nobody ever claimed they mapped to one.
 */
export function requirementIndex(questions = []) {
  const map = new Map()
  for (const q of questions) {
    const key = normaliseQuestionKey(q?.text)
    if (!key) continue
    map.set(key, q?.source === 'custom' ? 'Your own question' : (q?.covers || null))
  }
  return map
}

/**
 * One candidate's per-requirement scores.
 *
 * A requirement can carry more than one question if the recruiter picked
 * more than one for it, so scores are averaged rather than last-wins.
 */
export function scoresByRequirement(questionReviews = [], reqIndex = new Map()) {
  const acc = new Map()
  for (const qr of Array.isArray(questionReviews) ? questionReviews : []) {
    const req = reqIndex.get(normaliseQuestionKey(qr?.question)) || null
    if (!req) continue
    /* Not `Number(qr.score)` alone: Number(null) and Number('') are both
       0, and 0 is finite, so an answer the scorer left blank would have
       counted as a hard zero and dragged the requirement down with it. */
    const raw = qr?.score
    if (raw === null || raw === undefined || raw === '') continue
    const n = Number(raw)
    if (!Number.isFinite(n)) continue
    if (!acc.has(req)) acc.set(req, { total: 0, count: 0, quote: null })
    const slot = acc.get(req)
    slot.total += n
    slot.count += 1
    if (!slot.quote && qr?.evidence_quote) slot.quote = String(qr.evidence_quote)
  }
  const out = new Map()
  for (const [req, v] of acc) {
    out.set(req, { score: v.total / v.count, quote: v.quote })
  }
  return out
}

/** How far apart two scores have to be before it is a real difference. */
export const MEANINGFUL_GAP = 1.5

/**
 * The comparison table.
 *
 * Every requirement either candidate was asked about appears exactly
 * once. A requirement only one of them faced is kept and marked, rather
 * than dropped — "we never asked her that" is itself worth knowing
 * before you pick between them.
 */
export function compareCandidates(a, b) {
  const aScores = a?.byRequirement instanceof Map ? a.byRequirement : new Map()
  const bScores = b?.byRequirement instanceof Map ? b.byRequirement : new Map()

  const requirements = [...new Set([...aScores.keys(), ...bScores.keys()])]

  const rows = requirements.map((requirement) => {
    const av = aScores.get(requirement) || null
    const bv = bScores.get(requirement) || null
    const both = !!av && !!bv
    const gap = both ? av.score - bv.score : null
    let leader = null
    if (both && Math.abs(gap) >= MEANINGFUL_GAP) leader = gap > 0 ? 'a' : 'b'
    return {
      requirement,
      a: av,
      b: bv,
      gap,
      absGap: both ? Math.abs(gap) : null,
      leader,                       // null when level, or when only one sat it
      onlyOne: both ? null : (av ? 'a' : 'b'),
    }
  })

  // Biggest real differences first; rows only one candidate faced next;
  // level rows last. Ties fall back to alphabetical so the order is
  // stable between renders.
  rows.sort((x, y) => {
    const rank = (r) => (r.leader ? 0 : r.onlyOne ? 1 : 2)
    const dr = rank(x) - rank(y)
    if (dr !== 0) return dr
    if (x.absGap != null && y.absGap != null && x.absGap !== y.absGap) return y.absGap - x.absGap
    return String(x.requirement).localeCompare(String(y.requirement))
  })

  const wins = { a: 0, b: 0 }
  for (const r of rows) if (r.leader) wins[r.leader] += 1

  return { rows, wins, decided: wins.a !== wins.b }
}

/**
 * One line a recruiter can act on, or an honest admission that there
 * isn't one. Never invents a winner out of a rounding difference.
 */
export function compareHeadline(result, aName, bName) {
  const { wins, rows } = result || { wins: { a: 0, b: 0 }, rows: [] }
  const comparable = rows.filter((r) => r.leader || r.absGap != null).length
  if (comparable === 0) {
    return 'These two were not asked about enough of the same things to compare.'
  }
  if (wins.a === 0 && wins.b === 0) {
    return 'No meaningful gap on any requirement. Watch both, or separate them on something the interview did not cover.'
  }
  if (wins.a === wins.b) {
    return `${aName} and ${bName} each lead on ${wins.a}. They are strong in different places, not one above the other.`
  }
  const [lead, leadWins, other] = wins.a > wins.b ? [aName, wins.a, wins.b] : [bName, wins.b, wins.a]
  return `${lead} is clearly ahead on ${leadWins} requirement${leadWins === 1 ? '' : 's'}${other > 0 ? `, behind on ${other}` : ''}.`
}

/**
 * Are these two even comparable?
 *
 * Two people who sat different stages answered different questions, and
 * putting their numbers side by side implies a fairness that is not
 * there. The UI says so rather than quietly ranking them.
 */
export function sameStage(a, b) {
  return !!a?.stageId && !!b?.stageId && String(a.stageId) === String(b.stageId)
}
