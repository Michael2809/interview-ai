import { createServiceClient } from '@/lib/supabase/service'

/**
 * Mark one interview attempt finished.
 *
 * This exists so the candidate's browser needs no write permission on
 * `interviews` beyond inserting its own transcript rows. It used to be a
 * direct `supabase.from('interviews').update(...)` from the candidate
 * page, which quietly did nothing: candidates are anonymous, and the
 * only UPDATE policy on that table is for authenticated users. It
 * appeared to work in testing purely because the recruiter was signed in
 * in the same browser.
 *
 * The attempt is addressed by `session_id` - a uuid the client generates
 * when the interview starts. Guessing one is not worth doing: the only
 * thing this route can do is set a status flag on a row that already
 * exists.
 */
export async function POST(request) {
  let body
  try { body = await request.json() } catch { body = {} }

  const stageId = body?.stageId
  const sessionId = body?.sessionId
  // The token from the invite link, when the candidate arrived by one.
  const inviteToken = body?.inviteToken

  if (!stageId || !sessionId) {
    return Response.json({ error: 'stageId and sessionId are required.' }, { status: 400 })
  }

  // A uuid or nothing. Keeps a malformed value from reaching PostgREST
  // as a filter it will reject with a 500-shaped error.
  if (!/^[0-9a-fA-F-]{32,36}$/.test(String(sessionId))) {
    return Response.json({ error: 'Bad session id.' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { error } = await svc
    .from('interviews')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('stage_id', stageId)
    .eq('session_id', sessionId)
    .eq('speaker', 'session_start')

  if (error) {
    console.error('interview-complete failed:', error)
    return Response.json({ error: 'Could not mark the interview complete.' }, { status: 500 })
  }

  /* Close the invite this candidate arrived on.
   *
   * Nothing used to connect the two. The invite row holds an email, the
   * transcript rows hold a typed-in name, and no code carried the token
   * across - so the product could not answer "did the person we emailed
   * actually turn up". Reminders need that answer, because the one
   * unforgivable behaviour here is chasing somebody who already sat the
   * interview. Best effort: a candidate who pasted a bare link has no
   * token, and that costs them one reminder, not a broken interview. */
  if (inviteToken) {
    const { error: inviteErr } = await svc
      .from('interviews')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('stage_id', stageId)
      .eq('token', inviteToken)
      .eq('speaker', 'invite')
    if (inviteErr) console.error('interview-complete: invite close failed:', inviteErr)
  }

  return Response.json({ completed: true })
}
