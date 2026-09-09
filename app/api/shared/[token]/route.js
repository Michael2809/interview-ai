import { createServiceClient } from '@/lib/supabase/service'
import {
  looksLikeShareToken, shareLinkState, publicScore, publicLine, publicSender,
} from '@/lib/share'
import { readCandidateInterview } from '@/lib/transcript'

/**
 * The one route a person with no account can reach.
 *
 * Read-only by construction: this file exports GET and nothing else, so
 * there is no verb behind a share token that can change anything. It
 * uses the service client, which bypasses RLS, so every line below is
 * written on the assumption that the caller is a stranger who may be
 * fuzzing it.
 *
 * The shape of the answer is decided in lib/share.js by whitelist, not
 * by deleting fields here. A column added to `interviews` or `scores`
 * next month is therefore excluded by default rather than quietly
 * shipped to whoever holds a link.
 */

export async function GET(_request, { params }) {
  const { token } = await params

  // Cheap gate first, so scanning /share/<junk> costs a regex and not a
  // database round trip.
  if (!looksLikeShareToken(token)) {
    return Response.json({ error: 'missing' }, { status: 404 })
  }

  const svc = createServiceClient()

  const { data: link, error: linkErr } = await svc
    .from('share_links')
    .select('id, token, user_id, stage_id, candidate_name, include_video, expires_at, revoked_at, view_count')
    .eq('token', token)
    .maybeSingle()

  if (linkErr) {
    console.error('shared: link lookup failed:', linkErr)
    return Response.json({ error: 'server' }, { status: 500 })
  }

  // Revocation and expiry are checked on every view, never only at
  // creation. A link the recruiter turned off five minutes ago must stop
  // working now, not when it would have expired anyway.
  const state = shareLinkState(link)
  if (!state.ok) {
    return Response.json({ error: state.reason }, { status: 404 })
  }

  const candidate = link.candidate_name

  /* ── The result itself ───────────────────────────────────────── */

  const [stageRes, linesRes, scoreRes] = await Promise.all([
    svc.from('stages').select('id, name, role_id').eq('id', link.stage_id).maybeSingle(),
    svc.from('interviews').select('id, speaker, content, candidate_name, video_url, session_id, created_at')
      .eq('stage_id', link.stage_id).order('created_at', { ascending: true }),
    // scores.stage_id is text while interviews.stage_id is bigint.
    svc.from('scores').select()
      .eq('stage_id', String(link.stage_id)).eq('candidate_name', candidate).maybeSingle(),
  ])

  const stage = stageRes.data || null
  if (!stage) return Response.json({ error: 'missing' }, { status: 404 })

  const [roleRes, settingsRes, questionsRes] = await Promise.all([
    svc.from('roles').select('id, title').eq('id', stage.role_id).maybeSingle(),
    svc.from('settings').select('company_name').eq('user_id', link.user_id).maybeSingle(),
    svc.from('questions').select('text, covers, source')
      .eq('stage_id', link.stage_id).eq('approved', true),
  ])

  // Same reader the recruiter's own page uses, so the attempt shown here
  // is the attempt shown there.
  const interview = readCandidateInterview(linesRes.data || [], candidate)

  /* ── Count the view ──────────────────────────────────────────── */
  // Deliberately not awaited into the response path. If this write fails
  // the client still gets their result; a wrong view counter is a
  // reporting annoyance, a failed page is a client who cannot read the
  // thing you sent them.
  svc.from('share_links')
    .update({ view_count: (link.view_count || 0) + 1, last_viewed_at: new Date().toISOString() })
    .eq('id', link.id)
    .then(({ error }) => { if (error) console.error('shared: view count failed:', error) })

  return Response.json({
    role: { title: roleRes.data?.title || null },
    stage: { name: stage.name || null },
    sender: publicSender(settingsRes.data),
    candidate: { name: candidate },
    score: publicScore(scoreRes.data),
    questions: (questionsRes.data || []).map((q) => ({
      text: q.text, covers: q.covers || null, source: q.source || 'ai',
    })),
    interview: {
      transcript: interview.transcript.map(publicLine),
      candidateQuestions: interview.candidateQuestions,
      // The recruiter can share a written result without a candidate's
      // face. When they chose that, the URL never leaves the server.
      videoUrl: link.include_video ? interview.videoUrl : null,
      startedAt: interview.startedAt,
      durationMs: interview.durationMs,
    },
  })
}
