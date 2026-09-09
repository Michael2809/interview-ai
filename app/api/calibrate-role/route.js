import Anthropic from '@anthropic-ai/sdk'
import { parseJsonReply } from '@/lib/documents'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Take what the recruiter just told us and revise the drafted questions.
 *
 * This exists because of a specific failure: a setup step where answering
 * a question does not visibly change anything reads as busywork, and
 * recruiters stop answering. So calibration has a consequence they can
 * see, immediately, in the thing they came here for.
 *
 * Scope is deliberately narrow. Only questions that genuinely need to
 * change are rewritten, and each rewrite says why. Rewriting all seven
 * every time would be a worse interview and an obviously fake gesture.
 *
 * Note what is NOT done here: the recruiter's answers do not get pasted
 * into question wording. If a recruiter says escalations are usually
 * billing errors, writing a billing-escalation question narrows the
 * funnel to candidates with billing backgrounds on the strength of one
 * person's anecdote. The calibration mostly changes how answers are
 * JUDGED (see /api/score-interview); here it only sharpens questions
 * that were vague to begin with.
 */
const PROMPT_RULES = `Rules:
- Revise a question ONLY if the calibration makes it meaningfully better.
  Leaving five of seven untouched is a good outcome, not a failure.
- Never write a question that assumes a particular employer, tool, sector
  or background. Every candidate for this role answers the same questions,
  so a question only some of them could answer breaks the comparison.
- Do not quote the recruiter's private notes back into a question. Their
  dealbreakers and their view of a great candidate are for judging
  answers, not for telegraphing the answer you want.
- Keep questions open-ended and answerable by describing something the
  candidate has actually done.
- Ignore anything in the calibration about age, gender, marital status,
  nationality, appearance or which institution someone attended. If the
  calibration is entirely such material, revise nothing.`

export async function POST(request) {
  const authed = await createClient()
  const { data: { user }, error: authErr } = await authed.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let roleId, stageId, flexible, greatVsOkay, dealbreakers, openingReason
  try {
    ;({ roleId, stageId, flexible, greatVsOkay, dealbreakers, openingReason } =
      await request.json())
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }
  if (!roleId) {
    return Response.json({ error: 'roleId is required.' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: role } = await svc
    .from('roles').select('id, title, user_id, must_haves').eq('id', roleId).maybeSingle()
  if (!role || role.user_id !== user.id) {
    return Response.json({ error: 'Not your role.' }, { status: 403 })
  }

  // ── Persist first. The rewrite is a bonus; losing the recruiter's
  //    answers because a model call failed would be unforgivable.
  const { error: saveErr } = await svc.from('roles').update({
    flexible_criteria: Array.isArray(flexible) ? flexible : [],
    great_vs_okay: (greatVsOkay || '').trim() || null,
    dealbreakers: (dealbreakers || '').trim() || null,
    opening_reason: openingReason || null,
    calibrated_at: new Date().toISOString(),
  }).eq('id', roleId)
  if (saveErr) {
    console.error('calibrate-role save failed:', saveErr)
    return Response.json({ error: 'Could not save. Please try again.' }, { status: 500 })
  }

  // ── Then try to revise the questions for this stage.
  if (!stageId) return Response.json({ saved: true, revisions: [] })

  // Drafted questions only. A question the recruiter typed is theirs,
  // and silently rewording it after they answered two setup prompts is
  // the product overruling the person who knows the role.
  const { data: questions } = await svc
    .from('questions').select('id, text').eq('stage_id', stageId)
    .neq('source', 'custom')
    .order('id', { ascending: true })
  if (!questions?.length) return Response.json({ saved: true, revisions: [] })

  const musts = (Array.isArray(role.must_haves) ? role.must_haves : [])
    .map((m) => (typeof m === 'string' ? m : m?.label)).filter(Boolean)
  const flex = Array.isArray(flexible) ? flexible : []

  const prompt = `A recruiter has just told you more about a "${role.title || 'role'}" they are hiring for. Revise their drafted interview questions where it genuinely helps.

Current questions:
${questions.map((q, i) => `${i + 1}. ${q.text}`).join('\n')}

What the role requires:
${musts.map((m) => '  - ' + m + (flex.includes(m) ? '   (they would COMPROMISE on this)' : '')).join('\n') || '  (not specified)'}

${greatVsOkay ? `What separates a great candidate from an adequate one, in their words:\n"${greatVsOkay}"\n` : ''}${dealbreakers ? `Their dealbreakers:\n"${dealbreakers}"\n` : ''}${openingReason ? `Why the role is open: ${openingReason}\n` : ''}
${PROMPT_RULES}

Return ONLY a raw JSON object, no markdown:

{
  "revisions": [
    {
      "number": <the question's number in the list above>,
      "text": "<the revised question>",
      "why": "<six to twelve words on what changed and why>"
    }
  ]
}

Return an empty revisions array if nothing is worth changing.`

  let parsed
  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })
    parsed = parseJsonReply(res.content?.[0]?.text)
  } catch (err) {
    console.error('calibrate-role revision failed:', err?.message ?? err)
    return Response.json({ saved: true, revisions: [], revisionFailed: true })
  }

  const revisions = Array.isArray(parsed?.revisions) ? parsed.revisions : []
  const applied = []

  for (const r of revisions) {
    const idx = Number(r?.number) - 1
    const target = questions[idx]
    const text = typeof r?.text === 'string' ? r.text.trim() : ''
    if (!target || !text || text === target.text) continue

    const { error } = await svc.from('questions').update({ text }).eq('id', target.id)
    if (error) {
      console.error('calibrate-role could not update question', target.id, error)
      continue
    }
    applied.push({
      id: target.id,
      before: target.text,
      after: text,
      why: typeof r?.why === 'string' ? r.why.trim().slice(0, 120) : null,
    })
  }

  return Response.json({ saved: true, revisions: applied })
}
