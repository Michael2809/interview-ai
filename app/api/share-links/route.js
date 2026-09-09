import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { newShareToken, expiryFromKey, DEFAULT_EXPIRY, EXPIRY_OPTIONS } from '@/lib/share'

/**
 * Create, list and revoke share links.
 *
 * Every method here belongs to the signed-in recruiter. The public read
 * path is a different route (/api/shared/[token]) with no write verbs on
 * it at all, which is deliberate: the only thing a link holder can reach
 * is a handful of selects.
 */

/**
 * Does this recruiter own this stage, and did this candidate actually
 * sit it?
 *
 * The second half matters as much as the first. Without it a recruiter
 * could mint a link for a candidate name they typed by hand, and the
 * public route would happily serve whatever rows matched that name in
 * that stage - including none, producing a link that renders an empty
 * result to a client.
 */
async function ownsCandidate(svc, userId, stageId, candidate) {
  const { data: stage } = await svc
    .from('stages').select('id, role_id').eq('id', stageId).maybeSingle()
  if (!stage) return { ok: false, status: 404, error: 'Stage not found.' }

  const { data: role } = await svc
    .from('roles').select('id, title, user_id').eq('id', stage.role_id).maybeSingle()
  if (!role || role.user_id !== userId) {
    return { ok: false, status: 403, error: 'Not your stage.' }
  }

  const { data: rows } = await svc
    .from('interviews').select('id')
    .eq('stage_id', stageId).eq('candidate_name', candidate).limit(1)
  if (!rows || rows.length === 0) {
    return { ok: false, status: 404, error: 'No interview found for that candidate.' }
  }

  return { ok: true, stage, role }
}

async function requireUser() {
  const authed = await createClient()
  const { data: { user }, error } = await authed.auth.getUser()
  if (error || !user) return null
  return user
}

/* ── List ───────────────────────────────────────────────────────── */

export async function GET(request) {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const stageId = searchParams.get('stageId')
  const candidate = (searchParams.get('candidate') || '').trim()
  if (!stageId || !candidate) {
    return Response.json({ error: 'stageId and candidate are required.' }, { status: 400 })
  }

  const svc = createServiceClient()
  const owned = await ownsCandidate(svc, user.id, stageId, candidate)
  if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status })

  const { data, error } = await svc
    .from('share_links')
    .select('id, token, label, include_video, expires_at, revoked_at, view_count, last_viewed_at, created_at')
    .eq('user_id', user.id)
    .eq('stage_id', stageId)
    .eq('candidate_name', candidate)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('share-links list failed:', error)
    return Response.json({ error: 'Could not load your links.' }, { status: 500 })
  }

  return Response.json({ links: data || [] })
}

/* ── Create ─────────────────────────────────────────────────────── */

export async function POST(request) {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })

  let body
  try { body = await request.json() } catch { body = {} }

  const stageId = body?.stageId
  const candidate = String(body?.candidate || '').trim()
  const expiryKey = EXPIRY_OPTIONS.some((o) => o.key === body?.expiry)
    ? body.expiry
    : DEFAULT_EXPIRY
  const includeVideo = body?.includeVideo !== false
  const label = String(body?.label || '').trim().slice(0, 120) || null

  if (!stageId || !candidate) {
    return Response.json({ error: 'stageId and candidate are required.' }, { status: 400 })
  }

  const svc = createServiceClient()
  const owned = await ownsCandidate(svc, user.id, stageId, candidate)
  if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status })

  const { data, error } = await svc
    .from('share_links')
    .insert({
      token: newShareToken(),
      user_id: user.id,
      stage_id: stageId,
      candidate_name: candidate,
      label,
      include_video: includeVideo,
      expires_at: expiryFromKey(expiryKey),
    })
    .select('id, token, label, include_video, expires_at, revoked_at, view_count, last_viewed_at, created_at')
    .single()

  if (error) {
    console.error('share-links create failed:', error)
    return Response.json({ error: 'Could not create the link.' }, { status: 500 })
  }

  return Response.json({ link: data })
}

/* ── Revoke ─────────────────────────────────────────────────────── */

/**
 * Revoked, not deleted.
 *
 * The row stays so the recruiter can still see that a link existed, who
 * it was labelled for and how many times it was opened. A deleted row
 * answers none of that, and "did they ever look at it" is the first
 * thing anyone asks.
 */
export async function PATCH(request) {
  const user = await requireUser()
  if (!user) return Response.json({ error: 'Not signed in.' }, { status: 401 })

  let body
  try { body = await request.json() } catch { body = {} }
  const id = body?.id
  if (!id) return Response.json({ error: 'id is required.' }, { status: 400 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('share_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)          // ownership, enforced in the filter
    .select('id, revoked_at')
    .maybeSingle()

  if (error) {
    console.error('share-links revoke failed:', error)
    return Response.json({ error: 'Could not revoke the link.' }, { status: 500 })
  }
  if (!data) return Response.json({ error: 'Link not found.' }, { status: 404 })

  return Response.json({ revoked: true, id: data.id })
}
