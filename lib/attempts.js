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
 * There is no self-serve retake. A second try only ever happens because
 * the recruiter chose "Allow another attempt" for that one person.
 *
 * Server only: every function takes a service-role Supabase client.
 */

const UUID = /^[0-9a-fA-F-]{32,36}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normaliseEmail(value) {
  const e = String(value || '').trim().toLowerCase()
  return EMAIL.test(e) ? e : ''
}

/**
 * May this person start the real questions now?
 * Returns { allowed, reason?, inviteEmail?, inviteId? }.
 * reason: 'started' (began before and did not finish) | 'completed'.
 */
export async function checkAttempt(svc, { stageId, inviteToken, email }) {
  const { data: stage } = await svc
    .from('stages').select('id').eq('id', stageId).maybeSingle()
  if (!stage) return { allowed: false, reason: 'not-found' }

  // ── Email invite ──────────────────────────────────────────────
  if (inviteToken && UUID.test(String(inviteToken))) {
    const { data: invite } = await svc
      .from('interviews').select('id, status, candidate_email')
      .eq('stage_id', stageId).eq('token', inviteToken).eq('speaker', 'invite')
      .maybeSingle()
    if (invite) {
      const inviteEmail = normaliseEmail(invite.candidate_email)
      if (invite.status === 'in_progress') {
        return { allowed: false, reason: 'started', inviteEmail }
      }
      if (invite.status === 'completed') {
        return { allowed: false, reason: 'completed', inviteEmail }
      }
      return { allowed: true, inviteEmail, inviteId: invite.id }
    }
    // A token we do not recognise is treated like a plain link.
  }

  // ── Plain link ────────────────────────────────────────────────
  const e = normaliseEmail(email)
  if (!e) return { allowed: true }
  const { data: sessions } = await svc
    .from('interviews').select('status')
    .eq('stage_id', stageId).eq('speaker', 'session_start').eq('candidate_email', e)
  const list = sessions || []
  if (list.some((s) => s.status === 'completed')) return { allowed: false, reason: 'completed' }
  if (list.some((s) => s.status === 'in_progress')) return { allowed: false, reason: 'started' }
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
