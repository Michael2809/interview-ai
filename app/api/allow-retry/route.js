import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * The recruiter lets a candidate who started but did not finish try
 * again: their internet died, their laptop crashed, they were cut off.
 *
 * Reopens the invite and retires the unfinished attempt, so the
 * one-attempt lock lets them back in. Their unfinished answers were
 * never shown or scored, and stay that way.
 *
 * Ownership is checked the same way as /api/delete-candidate:
 * stage -> role -> role.user_id must be the signed-in recruiter.
 */
export async function POST(request) {
  let body
  try { body = await request.json() } catch { body = {} }
  const stageId = body?.stageId
  const email = String(body?.email || '').trim()
  if (!stageId || !email) {
    return Response.json({ error: 'stageId and email are required.' }, { status: 400 })
  }

  const authed = await createClient()
  const { data: { user }, error: authErr } = await authed.auth.getUser()
  if (authErr || !user) return Response.json({ error: 'Not signed in.' }, { status: 401 })

  const svc = createServiceClient()
  const { data: stage } = await svc
    .from('stages').select('id, role_id').eq('id', stageId).maybeSingle()
  if (!stage) return Response.json({ error: 'Stage not found.' }, { status: 404 })
  const { data: role } = await svc
    .from('roles').select('id, user_id').eq('id', stage.role_id).maybeSingle()
  if (!role || role.user_id !== user.id) {
    return Response.json({ error: 'Not your candidate.' }, { status: 403 })
  }

  const { error: invErr } = await svc
    .from('interviews')
    .update({ status: 'invited' })
    .eq('stage_id', stageId).eq('speaker', 'invite').eq('candidate_email', email)
    .eq('status', 'in_progress')
  if (invErr) {
    console.error('allow-retry: invite reopen failed:', invErr)
    return Response.json({ error: 'Could not reopen the interview.' }, { status: 500 })
  }

  const { error: sesErr } = await svc
    .from('interviews')
    .update({ status: 'abandoned' })
    .eq('stage_id', stageId).eq('speaker', 'session_start')
    .eq('candidate_email', email.toLowerCase()).eq('status', 'in_progress')
  if (sesErr) console.error('allow-retry: session retire failed:', sesErr)

  return Response.json({ reopened: true })
}
