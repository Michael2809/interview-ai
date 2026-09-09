/**
 * Telling the recruiter an interview came back.
 *
 * Two surfaces promised this and neither delivered: the bell in the app
 * reads a `notifications` table nothing ever wrote to, and Settings has
 * a "notify me when an interview completes" switch that saved a boolean
 * and did nothing else. A switch that lies is worse than one that is
 * missing, so both are wired to the same moment - the score landing.
 *
 * Pure decisions live here; the sending lives in the score route.
 */

/**
 * Does this recruiter want an email?
 *
 * Absent settings means yes. The column defaults to true, and somebody
 * who has never opened Settings has not opted out of anything - going
 * quiet on them would be us deciding for them.
 */
export function wantsCompletionEmail(settings) {
  if (!settings) return true
  return settings.notify_on_completion !== false
}

/** Where to send it, if anywhere. */
export function recruiterEmail(settings, authEmail) {
  const chosen = String(settings?.email || '').trim()
  if (chosen) return chosen
  const fallback = String(authEmail || '').trim()
  return fallback || null
}

/**
 * A one-line verdict for a subject line.
 *
 * Deliberately not just the number. "7.4" in a subject line means
 * nothing at a glance on a phone; "Hire" does.
 */
const LABEL = {
  'strong-hire': 'Strong hire',
  'hire': 'Hire',
  'hold': 'Hold',
  'reject': 'Reject',
}

export function verdictLabel(recommendation, score) {
  if (recommendation && LABEL[recommendation]) return LABEL[recommendation]
  /* Not `Number(score)` alone. Number(null) and Number('') are 0, and 0
     is finite, so a candidate who was never scored would have gone out
     with "Reject" in the subject line - the product telling a recruiter
     to bin somebody it never assessed. */
  if (score === null || score === undefined || score === '') return 'Scored'
  const n = Number(score)
  if (!Number.isFinite(n)) return 'Scored'
  if (n >= 8.5) return LABEL['strong-hire']
  if (n >= 6.5) return LABEL.hire
  if (n >= 4.5) return LABEL.hold
  return LABEL.reject
}

/**
 * The in-app notification row.
 *
 * `href` points at the transcript with the candidate preselected, so the
 * bell is a way into the work rather than an announcement about it.
 */
export function completionNotification({ userId, stageId, roleId, candidateName, roleTitle, score, recommendation }) {
  return {
    user_id: userId,
    kind: 'scoring_completed',
    title: `${candidateName} finished the ${roleTitle || 'interview'}`,
    body: `${verdictLabel(recommendation, score)}${Number.isFinite(Number(score)) ? ` · ${Number(score).toFixed(1)}/10` : ''}`,
    href: `/interview/${stageId}/transcript?candidate=${encodeURIComponent(candidateName)}`,
    candidate_name: candidateName,
    stage_id: stageId,
    role_id: roleId ?? null,
    metadata: { score: score ?? null, recommendation: recommendation ?? null },
  }
}
