/**
 * One interview per candidate.
 *
 * A candidate may not sit the same interview twice and keep the better
 * attempt. The lock starts when the REAL questions start (after the
 * warm-up), never on first click: honest people open the link on a
 * phone and switch to a laptop, or reload when the camera prompt fails,
 * and none of that should cost them their interview.
 *
 * Two ways in:
 *   - An email invite. The link carries a token only that person holds,
 *     and the invite row records whether it has been started. Strong.
 *   - A plain link with no token. The candidate gives their email, and
 *     the lock is per email per stage, backed by a same-browser lock in
 *     the page itself. Someone using a different email AND a different
 *     browser can still get round it; without logins nothing can stop that.
 *
 * The role's "allow a retake" setting still works: one retake, within
 * two hours of finishing the first attempt.
 *
 * Server only: every function takes a service-role Supabase client.
 */

export const RETRY_WINDOW_MS = 2 * 60 * 60 * 1000

const UUID = /^[0-9a-fA-F-]{32,36}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normaliseEmail(value) {
  const e = String(value || '').trim().toLowerCase()
  return EMAIL.test(e) ? e : ''
}

// completed_at is stored without a time zone; it is always written as UTC.
function utcMs(ts) {
  if (!ts) return NaN
  const s = String(ts)
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z').getTime()
}

async function retakeAllowed(svc, roleRetry, stageId, email, finishedAt) {
  if (!roleRetry) return false
  const at = utcMs(finishedAt)
  if (!Number.isFinite(at) || Date.now() - at > RETRY_WINDOW_MS) return false
  if (!email) return true
  // One retake only: two finished attempts and the door is shut.
  const { data } = await svc
    .from('interviews').select('id')
    .eq('stage_id', stageId).eq('speaker', 'session_start')
    .eq('candidate_email', email).eq('status', 'completed')
  return (data || []).length < 2
}

/**
 * May this person start the real questions now?
 * Returns { allowed, reason?, inviteEmail?, inviteId?, retake? }.
 * reason: 'started' (began before and did not finish) | 'completed'.
 */
export async function checkAttempt(svc, { stageId, inviteToken, email }) {
  const { data: stage } = await svc
    .from('stages').select('id, role_id').eq('id', stageId).maybeSingle()
  if (!stage) return { allowed: false, reason: 'not-found' }
  const { data: role } = await svc
    .from('roles').select('interview_retry_allowed').eq('id', stage.role_id).maybeSingle()
  const roleRetry = !!role?.interview_retry_allowed

  // ── Email invite ──────────────────────────────────────────────
  if (inviteToken && UUID.test(String(inviteToken))) {
    const { data: invite } = await svc
      .from('interviews').select('id, status, completed_at, candidate_email')
      .eq('stage_id', stageId).eq('token', inviteToken).eq('speaker', 'invite')
      .maybeSingle()
    if (invite) {
      const inviteEmail = normaliseEmail(invite.candidate_email)
      if (invite.status === 'in_progress') {
        return { allowed: false, reason: 'started', inviteEmail }
      }
      if (invite.status === 'completed') {
        const ok = await retakeAllowed(svc, roleRetry, stageId, inviteEmail, invite.completed_at)
        return ok
          ? { allowed: true, retake: true, inviteEmail, inviteId: invite.id }
          : { allowed: false, reason: 'completed', inviteEmail }
      }
      return { allowed: true, inviteEmail, inviteId: invite.id }
    }
    // A token we do not recognise is treated like a plain link.
  }

  // ── Plain link ────────────────────────────────────────────────
  const e = normaliseEmail(email)
  if (!e) return { allowed: true }
  const { data: sessions } = await svc
    .from('interviews').select('status, completed_at, created_at')
    .eq('stage_id', stageId).eq('speaker', 'session_start').eq('candidate_email', e)
    .order('created_at', { ascending: false })
  const list = sessions || []
  if (list.length === 0) return { allowed: true }
  if (list.some((s) => s.status === 'in_progress')) return { allowed: false, reason: 'started' }
  const lastDone = list.find((s) => s.status === 'completed')
  if (lastDone) {
    const ok = await retakeAllowed(svc, roleRetry, stageId, e, lastDone.completed_at || lastDone.created_at)
    return ok ? { allowed: true, retake: true } : { allowed: false, reason: 'completed' }
  }
  return { allowed: true }
}

/**
 * Take the lock: mark the invite as started and attach the name the
 * candidate typed, so the recruiter sees one person, not an email and a
 * name. For a plain link the lock is the session row the page writes
 * next, which carries the email.
 */
export async function claimAttempt(svc, { stageId, inviteToken, email, candidateName }) {
  const result = await checkAttempt(svc, { stageId, inviteToken, email })
  if (!result.allowed) return result
  if (result.inviteId) {
    const name = String(candidateName || '').trim().slice(0, 120)
    const { error } = await svc
      .from('interviews')
      .update({ status: 'in_progress', ...(name ? { candidate_name: name } : {}) })
      .eq('id', result.inviteId)
    if (error) console.error('claimAttempt: invite update failed:', error)
  }
  return result
}
