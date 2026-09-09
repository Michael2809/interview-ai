import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const UNKNOWN = 'UNKNOWN'

/**
 * Answer a candidate's question at the end of their interview.
 *
 * CLOSED BOOK. The model may use the facts assembled below and nothing
 * else — not its own knowledge of the company, not a plausible guess, not
 * an inference from the job title.
 *
 * This is the one place in Recrewt where a hallucination lands on the
 * customer rather than on us. A made-up headcount is embarrassing. A
 * made-up salary or start date is a candidate holding a screenshot of a
 * promise the recruiter never made, about a client's budget the recruiter
 * may not even be allowed to disclose.
 *
 * So when a fact is missing the model must reply UNKNOWN, and we hand the
 * candidate an honest "I don't have that, I've noted it for the recruiter"
 * instead. The unanswered question is returned so the interview page can
 * log it — which turns the limitation into something useful: the recruiter
 * finds out what candidates actually wanted to know.
 */
function buildFacts({ settings, role, stageName }) {
  const facts = []
  const add = (label, value) => {
    const v = (value == null ? '' : String(value)).trim()
    if (v) facts.push(`${label}: ${v}`)
  }

  add('Company name', settings?.company_name)
  add('What the company does', settings?.company_about)
  add('Company size', settings?.company_headcount)
  add('Website', settings?.company_website)
  add('Where people work', settings?.work_model)
  add('Working hours', settings?.working_hours)
  add('Benefits', settings?.benefits)
  add('What happens after this interview', settings?.hiring_process)
  add('Role title', role?.title)
  add('Role summary', role?.description)
  add('Seniority', role?.experience_level)
  add('Interview stage', stageName)

  // Pay is disclosed only when the recruiter chose to. Agencies frequently
  // are not permitted to reveal a client's budget, so the default is never
  // to say — and 'defer' gets its own scripted line rather than a number.
  const visibility = role?.salary_visibility || 'hide'
  if (visibility === 'show' && role?.salary_range) {
    add('Pay range for this role', role.salary_range)
  } else if (visibility === 'defer') {
    facts.push(
      'Pay: do not state a number. If asked, say compensation is discussed at the next stage.',
    )
  } else {
    // Deliberately routed through UNKNOWN rather than given a scripted
    // refusal. A refusal phrased as an answer would come back
    // answered:true, and the question would never reach the recruiter's
    // unanswered list — so they would never learn that candidates keep
    // asking about pay, which is exactly the thing worth knowing.
    facts.push('Pay: NOT AVAILABLE. Treat any question about pay, salary, compensation or budget as unanswerable.')
  }

  return facts
}

export async function POST(request) {
  let stageId, question
  try {
    ;({ stageId, question } = await request.json())
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!stageId || typeof question !== 'string' || !question.trim()) {
    return Response.json({ error: 'stageId and question are required.' }, { status: 400 })
  }
  const asked = question.trim().slice(0, 500)

  const svc = createServiceClient()

  const { data: stage } = await svc
    .from('stages').select('id, name, role_id').eq('id', stageId).maybeSingle()
  if (!stage) return Response.json({ error: 'Interview not found.' }, { status: 404 })

  const { data: role } = await svc
    .from('roles')
    .select('id, title, description, experience_level, salary_range, salary_visibility, user_id')
    .eq('id', stage.role_id).maybeSingle()

  let settings = null
  if (role?.user_id) {
    const { data } = await svc
      .from('settings')
      .select('company_name, company_about, company_headcount, company_website, work_model, working_hours, hiring_process, benefits')
      .eq('user_id', role.user_id).maybeSingle()
    settings = data
  }

  const facts = buildFacts({ settings, role, stageName: stage.name })

  const prompt = `You are the interviewer, answering a candidate's question at the end of their interview.

These are the ONLY facts you may use:
${facts.length ? facts.map((f) => '- ' + f).join('\n') : '- (no company details have been provided)'}

The candidate asked:
"${asked}"

Rules, in order of importance:

1. Answer ONLY from the facts above. You have no other knowledge of this
   company, this role, or this hiring process. If the facts do not contain
   the answer, or the relevant fact is marked NOT AVAILABLE, reply with
   exactly: ${UNKNOWN}
   Do not guess, do not generalise from the job title, do not say what is
   "typical" for companies like this.

2. Never reveal anything about the interview itself: the scoring, what a
   good answer looks like, how they performed, how they compare to other
   candidates, or how the AI evaluation works. If asked any of that, reply
   with exactly: ${UNKNOWN}

3. Never make a commitment on the employer's behalf. No promises about
   outcomes, timelines beyond what the facts state, or next steps.

4. If it is answerable, reply in one or two short sentences, warm and
   plain, the way an interviewer would say it out loud. No bullet points,
   no preamble, no "great question".

Reply with the answer, or with exactly ${UNKNOWN}.`

  let text = ''
  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    text = (res.content?.[0]?.text || '').trim()
  } catch (err) {
    console.error('candidate-question failed:', err?.message ?? err)
    // Fail closed. Silence is recoverable; a wrong answer is not.
    return Response.json({
      answered: false,
      answer: "I don't have that to hand, but I've noted it for the recruiter.",
      unanswered: asked,
    })
  }

  const normalized = text.replace(/[."'\s]/g, '').toUpperCase()
  if (!text || normalized === UNKNOWN || normalized.startsWith(UNKNOWN)) {
    return Response.json({
      answered: false,
      answer: "I don't have that to hand, but I've noted it for the recruiter to answer.",
      unanswered: asked,
    })
  }

  return Response.json({ answered: true, answer: text })
}
