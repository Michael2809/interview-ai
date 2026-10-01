import { createServiceClient } from '@/lib/supabase/service'
import { checkAttempt, claimAttempt } from '@/lib/attempts'

/**
 * May this candidate start the interview? And, with `claim: true`, take
 * the one-attempt lock as the real questions begin.
 *
 * Called by the anonymous candidate page. It answers yes or no, and the
 * invited email for an invite link (so the page need not ask for it). It
 * reveals nothing else: no names, no transcripts, no other candidates.
 * See lib/attempts.js for the rules.
 */
export async function POST(request) {
  let body
  try { body = await request.json() } catch { body = {} }

  const stageId = body?.stageId
  if (!stageId) return Response.json({ error: 'stageId is required.' }, { status: 400 })

  const args = {
    stageId,
    inviteToken: body?.inviteToken || null,
    email: body?.email || '',
    candidateName: body?.candidateName || '',
  }

  try {
    const svc = createServiceClient()
    const r = body?.claim ? await claimAttempt(svc, args) : await checkAttempt(svc, args)
    return Response.json({
      allowed: !!r.allowed,
      reason: r.reason || null,
      inviteEmail: r.inviteEmail || null,
    })
  } catch (err) {
    console.error('interview-access failed:', err?.message ?? err)
    // Fail open. A broken check must not lock an honest candidate out of
    // the interview they were invited to.
    return Response.json({ allowed: true, reason: null, inviteEmail: null })
  }
}
