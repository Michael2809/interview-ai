import { createServiceClient } from '@/lib/supabase/service'

/**
 * Attach the name a candidate typed to the invite they arrived on.
 *
 * The recruiter invites an EMAIL. The candidate then types a NAME on the
 * interview page, and every transcript row carries that name. Without a
 * link between the two, dashboards showed one person twice: the invited
 * email still waiting, and "Rachel" who did the interview.
 *
 * Called when the interview starts, so the two merge from the first
 * answer, and again on completion in case the first call was lost.
 *
 * The invite is addressed by the token from the emailed link. It is a
 * random uuid only the invited person holds, and the only thing this
 * route can do is set the display name on that one invite.
 */
export async function POST(request) {
  let body
  try { body = await request.json() } catch { body = {} }

  const stageId = body?.stageId
  const inviteToken = String(body?.inviteToken || '')
  const candidateName = String(body?.candidateName || '').trim().slice(0, 120)

  if (!stageId || !inviteToken || !candidateName) {
    return Response.json({ linked: false })
  }
  if (!/^[0-9a-fA-F-]{32,36}$/.test(inviteToken)) {
    return Response.json({ error: 'Bad token.' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { error } = await svc
    .from('interviews')
    .update({ candidate_name: candidateName })
    .eq('stage_id', stageId)
    .eq('token', inviteToken)
    .eq('speaker', 'invite')

  if (error) {
    console.error('link-invite failed:', error)
    return Response.json({ linked: false }, { status: 500 })
  }
  return Response.json({ linked: true })
}
