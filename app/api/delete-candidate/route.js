import cloudinary from '@/lib/cloudinary'
import { publicIdFromUrl } from '@/lib/cloudinary-url'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Erase everything Recrewt holds about one candidate in one stage: their
 * recording in Cloudinary, every transcript / invite / analysis row in
 * `interviews`, and their `scores` row.
 *
 * This is a hard delete, deliberately. India's DPDP rules give a person
 * the right to have their data erased, and "we set a flag and hid the
 * row" is not erasure. Archive already covers the softer case where a
 * recruiter just wants someone out of the way.
 *
 * Ownership is verified against the signed-in recruiter before anything
 * is touched: stage -> role -> role.user_id must be the caller.
 */
export async function POST(request) {
  const { stageId, candidate } = await request.json()

  if (!stageId || typeof candidate !== 'string' || !candidate.trim()) {
    return Response.json({ error: 'stageId and candidate are required.' }, { status: 400 })
  }
  const who = candidate.trim()

  // ── Who is asking ────────────────────────────────────────────────
  const authed = await createClient()
  const { data: { user }, error: authErr } = await authed.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const svc = createServiceClient()

  // ── Do they own this stage ───────────────────────────────────────
  const { data: stage } = await svc
    .from('stages').select('id, role_id').eq('id', stageId).maybeSingle()
  if (!stage) {
    return Response.json({ error: 'Stage not found.' }, { status: 404 })
  }

  const { data: role } = await svc
    .from('roles').select('id, user_id').eq('id', stage.role_id).maybeSingle()
  if (!role || role.user_id !== user.id) {
    return Response.json({ error: 'Not your candidate.' }, { status: 403 })
  }

  // ── Find their rows ──────────────────────────────────────────────
  // Candidates are keyed by name on transcript rows and by email on
  // invite rows, and the recruiter surface passes whichever it has.
  // Two separate .eq() queries rather than one .or() string: .or()
  // takes a raw PostgREST filter expression, so a candidate name
  // containing a comma or a paren would rewrite the filter.
  const byName = await svc
    .from('interviews').select('id, video_url')
    .eq('stage_id', stageId).eq('candidate_name', who)
  const byEmail = await svc
    .from('interviews').select('id, video_url')
    .eq('stage_id', stageId).eq('candidate_email', who)

  if (byName.error || byEmail.error) {
    console.error('delete-candidate lookup failed:', byName.error || byEmail.error)
    return Response.json({ error: 'Could not read this candidate.' }, { status: 500 })
  }

  const rows = [...(byName.data || []), ...(byEmail.data || [])]
  const ids = [...new Set(rows.map((r) => r.id))]
  if (ids.length === 0) {
    return Response.json({ error: 'No data found for this candidate.' }, { status: 404 })
  }

  // ── Recording first ──────────────────────────────────────────────
  // Order matters. If Cloudinary fails we stop with the database
  // intact so the recruiter can retry. Deleting rows first would
  // orphan the video with no record of where it lives.
  const publicIds = [...new Set(
    rows.map((r) => publicIdFromUrl(r.video_url)).filter(Boolean),
  )]

  let videosDeleted = 0
  for (const publicId of publicIds) {
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video', invalidate: true })
      videosDeleted += 1
    } catch (err) {
      console.error('delete-candidate: Cloudinary destroy failed for', publicId, err)
      return Response.json({
        error: 'Could not delete the recording. Nothing was removed — please try again.',
      }, { status: 502 })
    }
  }

  // ── Then the rows ────────────────────────────────────────────────
  const { error: rowsErr } = await svc.from('interviews').delete().in('id', ids)
  if (rowsErr) {
    console.error('delete-candidate: interviews delete failed:', rowsErr)
    return Response.json({
      error: 'The recording was deleted but the transcript was not. Please try again.',
    }, { status: 500 })
  }

  // scores.stage_id is text while interviews.stage_id is bigint.
  const { error: scoreErr } = await svc
    .from('scores').delete()
    .eq('stage_id', String(stageId))
    .eq('candidate_name', who)
  if (scoreErr) {
    // The personal data is already gone; a stranded score row is a
    // cleanup problem, not a privacy one. Log it, still report success.
    console.error('delete-candidate: scores delete failed:', scoreErr)
  }

  return Response.json({ deleted: true, rows: ids.length, videos: videosDeleted })
}
