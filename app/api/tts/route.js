import crypto from 'crypto'
import { createServiceClient } from '../../../lib/supabase/service'

/**
 * Text-to-speech for interview questions.
 *
 * Replaces the browser's `window.speechSynthesis`, whose voice depended on the
 * candidate's operating system — Samantha on a Mac, Microsoft Zira on Windows,
 * sometimes nothing at all on Linux. Now every candidate hears the same voice.
 *
 * Caching
 * -------
 * Audio is keyed by a hash of the exact text plus VOICE_VERSION. The same
 * question is therefore synthesized once, ever, across all candidates and all
 * roles. Repeat plays and the "repeat question" button cost nothing.
 *
 * Bump VOICE_VERSION whenever the interviewer voice changes, so cached audio
 * in the old voice is superseded rather than mixed with the new one.
 *
 * Privacy
 * -------
 * Question text can contain candidate personal data (see
 * /api/generate-questions-from-resume). It is sent only to our own Modal
 * deployment, never to a third-party TTS vendor. Cached audio lives in a
 * PRIVATE Supabase bucket and is served via short-lived signed URLs, so it is
 * protected the same way the rest of the candidate data is.
 */

const BUCKET = 'interview-audio'
// v2: audio is now MP3 rather than uncompressed WAV. v1 entries were ~290 KB
// each, which stalled on mobile connections and made audio.play() hang with no
// error. Bumping the version supersedes that cache rather than mixing formats.
const VOICE_VERSION = 'v2'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour — longer than any interview

function cacheKey(text) {
  const hash = crypto
    .createHash('sha256')
    .update(`${VOICE_VERSION}::${text}`)
    .digest('hex')
  return `tts/${VOICE_VERSION}/${hash}.mp3`
}

async function signedUrl(supabase, key) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, SIGNED_URL_TTL_SECONDS)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function POST(request) {
  let text
  try {
    const body = await request.json()
    text = typeof body?.text === 'string' ? body.text.trim() : ''
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!text) {
    return Response.json({ error: '`text` is required' }, { status: 400 })
  }
  if (text.length > 2000) {
    return Response.json(
      { error: '`text` exceeds 2000 characters' },
      { status: 400 },
    )
  }

  const modalUrl = process.env.RECREWT_TTS_URL
  const modalToken = process.env.RECREWT_TTS_TOKEN
  if (!modalUrl || !modalToken) {
    // Not configured — the client falls back to browser speech.
    return Response.json({ error: 'TTS not configured' }, { status: 503 })
  }

  const supabase = createServiceClient()
  const key = cacheKey(text)

  // --- cache hit ----------------------------------------------------
  const existing = await supabase.storage
    .from(BUCKET)
    .list(key.substring(0, key.lastIndexOf('/')), {
      search: key.substring(key.lastIndexOf('/') + 1),
      limit: 1,
    })

  if (!existing.error && existing.data?.length > 0) {
    const url = await signedUrl(supabase, key)
    if (url) return Response.json({ url, cached: true })
  }

  // --- cache miss: synthesize ---------------------------------------
  let audio
  let upstreamType = 'audio/mpeg'
  try {
    const response = await fetch(modalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${modalToken}`,
      },
      body: JSON.stringify({ text }),
      // A cold GPU container can take ~60s to load the 2B model. Anything
      // beyond this and the client is better off using browser speech.
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('TTS upstream failed', response.status, detail.slice(0, 200))
      return Response.json(
        { error: 'Speech generation failed' },
        { status: 502 },
      )
    }
    upstreamType = response.headers.get('content-type') || 'audio/mpeg'
    audio = Buffer.from(await response.arrayBuffer())
  } catch (err) {
    console.error('TTS request error', err?.name ?? err)
    return Response.json({ error: 'Speech generation failed' }, { status: 502 })
  }

  // --- store, then hand back a signed URL ---------------------------
  const upload = await supabase.storage.from(BUCKET).upload(key, audio, {
    contentType: upstreamType,
    upsert: true,
  })

  if (upload.error) {
    // Storage failed but we do have the audio. Return it inline rather than
    // failing the interview — the next request will simply regenerate.
    console.error('TTS cache upload failed', upload.error.message)
    return new Response(audio, {
      headers: { 'Content-Type': upstreamType, 'Cache-Control': 'no-store' },
    })
  }

  const url = await signedUrl(supabase, key)
  if (!url) {
    return new Response(audio, {
      headers: { 'Content-Type': upstreamType, 'Cache-Control': 'no-store' },
    })
  }

  return Response.json({ url, cached: false })
}
