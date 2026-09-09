import Anthropic from '@anthropic-ai/sdk'
import { requireActiveRecruiter } from '@/lib/api-auth'
import { documentToMessageContent, parseJsonReply } from '@/lib/documents'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXPERIENCE_LEVELS = ['entry', 'mid', 'senior', 'lead']
const EMPLOYMENT_TYPES = ['full-time', 'part-time', 'contract', 'internship']

/**
 * Read a job description and propose the role setup.
 *
 * The recruiter never types this form. They upload the JD, the model
 * proposes every field, and they correct whatever is wrong. That is
 * deliberately the opposite of asking them questions: a form gets
 * abandoned, a filled-in card gets a glance and a click.
 *
 * Everything returned here is a PROPOSAL. Nothing is saved until the
 * recruiter confirms it on the next screen, which is what makes it
 * honest to base scoring on afterwards — the criteria are theirs, not
 * the model's.
 */
const PROMPT = `You are helping a recruiter set up a screening interview from a job description.

Read the job description and extract what is actually stated. Do not invent
requirements that are not there.

Return ONLY a raw JSON object, no markdown, no prose:

{
  "title": "<the job title, as written>",
  "department": "<department or function, or null>",
  "experience_level": "<one of: entry, mid, senior, lead>",
  "employment_type": "<one of: full-time, part-time, contract, internship>",
  "location": "<location and/or remote-hybrid-onsite, or null>",
  "salary_range": "<pay range exactly as written, or null if not stated>",
  "must_haves": [
    { "label": "<short requirement, 2-5 words>", "evidence": "<the phrase in the JD that states it>" }
  ],
  "nice_to_haves": [
    { "label": "<short requirement, 2-5 words>", "evidence": "<the phrase in the JD that states it>" }
  ],
  "summary": "<one sentence a recruiter would recognise as their own role>"
}

Rules:
- 3 to 6 must_haves. These become what candidates are scored against, so
  each one must be something an interview answer could actually demonstrate.
  "5 years experience" is not one — you cannot demonstrate it in an answer.
  "Owned a production migration" is.
- COVER THE WHOLE JOB. If the role owns several distinct areas — three
  marketing channels, or engineering plus on-call plus mentoring — there
  must be a must_have for each one before you write a second must_have
  about any of them. A role advertised as "SEO, email and social" that
  comes back scored on SEO and email has silently dropped a third of the
  job, and every candidate will be ranked as though social did not exist.
  Read the responsibilities section, not just the requirements list: the
  areas of ownership are usually stated there and only implied later.
- 0 to 4 nice_to_haves. Only genuine differentiators.
- Every must_have and nice_to_have needs an evidence phrase quoted from the
  job description. If you cannot quote it, do not include it.
- salary_range must be null unless the document actually states pay.
- Infer experience_level from stated years or scope. Default to "mid".
- Never include age, gender, nationality, marital status, photograph
  requirements or anything else that is not about doing the job, even if
  the document asks for them.`

function pick(value, allowed, fallback) {
  const v = String(value || '').toLowerCase().trim()
  return allowed.includes(v) ? v : fallback
}

function cleanCriteria(list, max) {
  if (!Array.isArray(list)) return []
  return list
    .map((c) => ({
      label: String(c?.label || '').trim().slice(0, 80),
      evidence: String(c?.evidence || '').trim().slice(0, 300),
    }))
    .filter((c) => c.label && c.evidence)
    .slice(0, max)
}

export async function POST(request) {
  /* Costs money and belongs to one recruiter. This route used to accept
     anyone with the URL, and never consulted the subscription — see
     lib/api-auth.js. */
  const gate = await requireActiveRecruiter()
  if (gate.response) return gate.response

  let file
  let pastedText = ''
  try {
    const form = await request.formData()
    file = form.get('jd')
    pastedText = String(form.get('text') || '').trim()
  } catch {
    return Response.json({ error: 'Could not read the upload.' }, { status: 400 })
  }

  if (!file && !pastedText) {
    return Response.json({ error: 'Upload a job description or paste the text.' }, { status: 400 })
  }

  let messages
  let jdText = pastedText
  if (file) {
    const doc = await documentToMessageContent(file, PROMPT)
    if (!doc.ok) return Response.json({ error: doc.error }, { status: 400 })
    messages = [{ role: 'user', content: doc.content }]
    if (doc.text) jdText = doc.text
  } else {
    messages = [{ role: 'user', content: PROMPT + '\n\n---\n' + pastedText + '\n---' }]
  }

  let parsed
  try {
    const res = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages,
    })
    parsed = parseJsonReply(res.content?.[0]?.text)
  } catch (err) {
    console.error('parse-jd failed:', err?.message ?? err)
    return Response.json({ error: 'Could not read that job description. Please try again.' }, { status: 502 })
  }

  if (!parsed || !parsed.title) {
    return Response.json({
      error: "That did not look like a job description. Check the file, or paste the text instead.",
    }, { status: 422 })
  }

  return Response.json({
    // Everything here is a proposal for the recruiter to confirm.
    title: String(parsed.title).trim().slice(0, 200),
    department: parsed.department ? String(parsed.department).trim().slice(0, 120) : null,
    experience_level: pick(parsed.experience_level, EXPERIENCE_LEVELS, 'mid'),
    employment_type: pick(parsed.employment_type, EMPLOYMENT_TYPES, 'full-time'),
    location: parsed.location ? String(parsed.location).trim().slice(0, 160) : null,
    salary_range: parsed.salary_range ? String(parsed.salary_range).trim().slice(0, 120) : null,
    must_haves: cleanCriteria(parsed.must_haves, 6),
    nice_to_haves: cleanCriteria(parsed.nice_to_haves, 4),
    summary: parsed.summary ? String(parsed.summary).trim().slice(0, 400) : null,
    // Kept so question generation and resume ranking can quote the source.
    jd_text: jdText ? jdText.slice(0, 20000) : null,
  })
}
