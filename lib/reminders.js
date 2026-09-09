/**
 * When to chase a candidate, and when to leave them alone.
 *
 * The whole risk of this feature is a machine emailing a stranger too
 * many times on a recruiter's behalf. Every rule below exists to cap
 * that, and the defaults are deliberately timid: two reminders, ever,
 * and nothing at all once the recruiter's own response window has
 * closed. A candidate who has decided not to interview should stop
 * hearing from us, not be worn down.
 *
 * Pure. No Supabase, no email, no clock of its own - `now` is passed in
 * so the rules can be tested at any point in time.
 */

const DAY = 24 * 60 * 60 * 1000

/** Days after the invite that a reminder may go out. Two, then silence. */
export const REMINDER_DAYS = [2, 4]
export const MAX_REMINDERS = REMINDER_DAYS.length

/** Never two reminders inside the same 24 hours, whatever else says. */
export const MIN_GAP_MS = DAY

export function daysSince(iso, now = new Date()) {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  return (now.getTime() - t) / DAY
}

/**
 * Should this invite get a reminder right now?
 *
 * Returns { send, reason }. The reason is always populated, including on
 * the happy path, because this runs unattended and the log is the only
 * place anyone will ever see why a candidate was or was not emailed.
 */
export function reminderDecision(invite, role, now = new Date()) {
  if (!invite?.candidate_email) return { send: false, reason: 'no-email' }
  if (invite.status === 'completed') return { send: false, reason: 'already-interviewed' }
  if (!invite.token) return { send: false, reason: 'no-token' }

  // A paused or archived role is one the recruiter has stepped away
  // from. Chasing candidates for it is worse than doing nothing.
  if (role && role.status !== 'active') return { send: false, reason: 'role-not-active' }

  const sent = Number(invite.reminder_count) || 0
  if (sent >= MAX_REMINDERS) return { send: false, reason: 'limit-reached' }

  const age = daysSince(invite.invited_at, now)
  if (age == null) return { send: false, reason: 'no-invite-date' }
  if (age < 0) return { send: false, reason: 'invited-in-the-future' }

  // Past the recruiter's own stated response window, we stop. They set
  // that number; it is not ours to overrun.
  const sla = Number(role?.interview_response_sla_days)
  const window = Number.isFinite(sla) && sla > 0 ? sla : 5
  if (age > window) return { send: false, reason: 'window-closed' }

  if (age < REMINDER_DAYS[sent]) return { send: false, reason: 'too-soon' }

  const sinceLast = invite.last_reminded_at
    ? now.getTime() - new Date(invite.last_reminded_at).getTime()
    : null
  if (sinceLast != null && sinceLast < MIN_GAP_MS) {
    return { send: false, reason: 'reminded-recently' }
  }

  return { send: true, reason: sent === 0 ? 'first-reminder' : 'final-reminder' }
}

/** Which of the two this is, for the wording of the email. */
export function reminderTone(invite) {
  const sent = Number(invite?.reminder_count) || 0
  return sent === 0 ? 'nudge' : 'last-call'
}

/**
 * How long the candidate has left, in the recruiter's own words.
 * Null when there is no meaningful deadline to quote.
 */
export function daysLeft(invite, role, now = new Date()) {
  const sla = Number(role?.interview_response_sla_days)
  const window = Number.isFinite(sla) && sla > 0 ? sla : 5
  const age = daysSince(invite?.invited_at, now)
  if (age == null) return null
  const left = Math.ceil(window - age)
  return left > 0 ? left : null
}

/**
 * Do not let one bad run empty the whole outbox. A cron that wakes up to
 * a backlog sends a batch and comes back tomorrow for the rest.
 */
export const MAX_PER_RUN = 50

/**
 * One reminder per person per stage, however many times they were
 * invited.
 *
 * A recruiter who pastes a list twice, or re-invites somebody they think
 * was missed, creates two invite rows for the same address on the same
 * stage. Both are perfectly valid rows and both would be chased, so the
 * candidate gets the same email twice within a second of itself. Found
 * exactly that way: the first live run sent one address two identical
 * reminders.
 *
 * The newest invite wins, because that is the link the recruiter most
 * recently meant them to use.
 */
export function dedupeInvites(invites = []) {
  const best = new Map()
  for (const inv of Array.isArray(invites) ? invites : []) {
    const email = String(inv?.candidate_email || '').trim().toLowerCase()
    if (!email) continue
    const key = `${inv?.stage_id}|${email}`
    const seen = best.get(key)
    if (!seen) { best.set(key, inv); continue }
    // Keep whichever has actually been reminded, so a duplicate can
    // never reset somebody's counter back to zero.
    const seenCount = Number(seen.reminder_count) || 0
    const invCount = Number(inv.reminder_count) || 0
    if (invCount > seenCount) { best.set(key, inv); continue }
    if (invCount === seenCount &&
        new Date(inv?.invited_at || 0) > new Date(seen?.invited_at || 0)) {
      best.set(key, inv)
    }
  }
  return [...best.values()]
}
