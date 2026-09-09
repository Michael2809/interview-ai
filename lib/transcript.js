/**
 * Reading a stage's `interviews` rows into one candidate's interview.
 *
 * This lives in lib/ for one reason: two surfaces now render the same
 * interview. The recruiter opens /interview/[stageId]/transcript, and a
 * hiring manager with a share link opens /share/[token] and must see the
 * SAME attempt, the same answers, the same recording. If the two derived
 * that independently they would drift, and the first time anyone noticed
 * would be a client saying "that is not what I was sent".
 *
 * Everything here is pure. No Supabase, no React, no window.
 */

/**
 * Split one candidate's rows into separate interview attempts.
 *
 * Every row in `interviews` carries its own `token`, because the column
 * defaults to gen_random_uuid() and the insert never supplies one. The
 * token identifies a ROW, not a SESSION, and must never be used to group.
 *
 * `session_id` is the real grouping key — stamped client-side on every
 * row of one attempt. Rows written before that column existed fall back
 * to splitting at each `session_start` marker.
 */
export function splitSessions(lines = []) {
  const rows = Array.isArray(lines) ? lines : []
  if (rows.length === 0) return []

  if (rows.some((l) => l?.session_id)) {
    const byId = new Map()
    const ungrouped = []
    for (const line of rows) {
      if (!line?.session_id) { ungrouped.push(line); continue }
      if (!byId.has(line.session_id)) byId.set(line.session_id, [])
      byId.get(line.session_id).push(line)
    }
    const groups = [...byId.values()]
    if (ungrouped.length) groups.push(ungrouped)
    groups.sort(
      (a, b) => new Date(a[0]?.created_at || 0) - new Date(b[0]?.created_at || 0),
    )
    return groups
  }

  const groups = []
  let current = null
  for (const line of rows) {
    if (line?.speaker === 'session_start' || current === null) {
      current = []
      groups.push(current)
    }
    current.push(line)
  }
  return groups
}

/**
 * The attempt worth showing: the most recent one the candidate actually
 * spoke in.
 *
 * Opening the link and walking away creates a session holding only a
 * marker and the first question. Showing that instead of real answers
 * would be worse than showing nothing.
 */
export function pickLatestSpokenSession(sessions = []) {
  if (!Array.isArray(sessions) || sessions.length === 0) return []
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (sessions[i].some((l) => l?.speaker === 'candidate')) return sessions[i]
  }
  return sessions[sessions.length - 1]
}

/** Speakers that are bookkeeping rows, not things anybody said. */
const NON_SPEECH = new Set([
  'video', 'invite', 'analysis', 'audio', 'session_start', 'candidate_qa',
])

/** Just the spoken turns, in order. */
export function transcriptOnly(lines = []) {
  return (Array.isArray(lines) ? lines : []).filter(
    (l) => l && !NON_SPEECH.has(l.speaker),
  )
}

/**
 * What the candidate asked at the end.
 *
 * Held apart from the transcript on purpose: it never reaches scoring,
 * and counting it as candidate speech would inflate the answer-volume
 * signals the confidence figure leans on.
 */
export function candidateQuestionsFrom(lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .filter((l) => l?.speaker === 'candidate_qa')
    .map((l) => { try { return JSON.parse(l.content) } catch { return null } })
    .filter(Boolean)
}

export function videoUrlFrom(lines = []) {
  const v = (Array.isArray(lines) ? lines : []).find((l) => l?.speaker === 'video')
  return v?.video_url || null
}

export function analysisFrom(lines = []) {
  const a = (Array.isArray(lines) ? lines : []).find((l) => l?.speaker === 'analysis')
  if (!a) return null
  try { return JSON.parse(a.content) } catch { return null }
}

/**
 * When the interview ran and how long it took.
 *
 * `lines` is one attempt's rows; `spoken` is that attempt already
 * filtered to speech. Both are passed in rather than recomputed so a
 * caller that already has them does not filter twice.
 */
export function timingFrom(lines = [], spoken = null) {
  const speech = spoken || transcriptOnly(lines)
  const marker = (Array.isArray(lines) ? lines : []).find((l) => l?.speaker === 'session_start')
  const startedAt = marker?.created_at || speech[0]?.created_at || null
  const finishedAt = speech[speech.length - 1]?.created_at || null
  let durationMs = null
  if (startedAt && finishedAt) {
    const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
    if (Number.isFinite(ms) && ms >= 0) durationMs = ms
  }
  return { startedAt, finishedAt, durationMs }
}

/**
 * Everything one candidate's interview amounts to, from the stage's raw
 * rows. One call, so both surfaces agree by construction.
 */
export function readCandidateInterview(allLines = [], candidateName = '') {
  const target = String(candidateName || '').toLowerCase()
  const mine = (Array.isArray(allLines) ? allLines : []).filter(
    (l) => String(l?.candidate_name || '').toLowerCase() === target,
  )
  const sessions = splitSessions(mine)
  const attempt = pickLatestSpokenSession(sessions)
  const spoken = transcriptOnly(attempt)
  return {
    lines: attempt,
    transcript: spoken,
    candidateQuestions: candidateQuestionsFrom(attempt),
    videoUrl: videoUrlFrom(attempt),
    analysis: analysisFrom(attempt),
    attemptCount: sessions.length,
    abandonedCount: sessions.filter((s) => !s.some((l) => l?.speaker === 'candidate')).length,
    ...timingFrom(attempt, spoken),
  }
}
