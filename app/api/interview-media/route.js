import { createServiceClient } from '@/lib/supabase/service'

/**
 * Record a candidate's uploaded media, and sign it, on the server.
 *
 * The candidate's browser uploads the file to storage itself - that part
 * needs no read rights. What it used to do next was call
 * `createSignedUrl` from the browser, and signing an object requires
 * SELECT on it. The only policy that made that work was
 *
 *     allow downloads: SELECT on bucket 'interview-videos' TO public
 *
 * which let anyone holding the public key list and download every
 * interview recording in the bucket - every candidate, every customer.
 * The anon key ships inside the JavaScript bundle, so "anyone" means
 * anyone who opened devtools.
 *
 * Signing moved here, behind the service key, and the signed URL is
 * never returned to the caller. It goes straight onto the `interviews`
 * row, which only the owning recruiter (or a share link they minted) can
 * read. A stranger who guesses a filename gets a saved row they cannot
 * see and no URL.
 */

const VIDEO_TTL = 60 * 60 * 24 * 30   // 30 days
const AUDIO_TTL = 60 * 60 * 24 * 7    // 7 days
const BUCKET = 'interview-videos'

/**
 * Filenames the interview client generates, and nothing else.
 *
 *   video: `${stageId}-${Date.now()}.webm`
 *   audio: `${stageId}-audio-${Date.now()}.webm|mp4`
 *
 * The stage prefix is checked against the stageId in the body below, so
 * a caller cannot ask us to sign a recording that belongs to a different
 * stage than the one they claim to be in.
 */
const FILENAME = /^([0-9]+)-(audio-)?[0-9]+\.(webm|mp4)$/

export async function POST(request) {
  let body
  try { body = await request.json() } catch { body = {} }

  const { stageId, sessionId, candidateName, filename, kind } = body || {}

  if (!stageId || !filename || !candidateName) {
    return Response.json({ error: 'stageId, candidateName and filename are required.' }, { status: 400 })
  }
  if (kind !== 'video' && kind !== 'audio') {
    return Response.json({ error: 'kind must be video or audio.' }, { status: 400 })
  }

  const match = FILENAME.exec(String(filename))
  if (!match) {
    return Response.json({ error: 'Unrecognised filename.' }, { status: 400 })
  }
  if (match[1] !== String(stageId)) {
    return Response.json({ error: 'That file does not belong to this stage.' }, { status: 403 })
  }

  const svc = createServiceClient()

  const { data: signed, error: signErr } = await svc
    .storage.from(BUCKET)
    .createSignedUrl(filename, kind === 'video' ? VIDEO_TTL : AUDIO_TTL)

  if (signErr || !signed?.signedUrl) {
    console.error('interview-media: signing failed:', signErr)
    return Response.json({ error: 'Could not save the recording.' }, { status: 502 })
  }

  const { error: insErr } = await svc.from('interviews').insert({
    stage_id: stageId,
    speaker: kind,
    content: kind === 'video' ? filename : 'Audio recording',
    candidate_name: candidateName,
    video_url: signed.signedUrl,
    session_id: sessionId ?? null,
  })

  if (insErr) {
    console.error('interview-media: row insert failed:', insErr)
    return Response.json({ error: 'Could not save the recording.' }, { status: 500 })
  }

  return Response.json({ saved: true })
}
