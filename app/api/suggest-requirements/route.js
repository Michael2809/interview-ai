import Anthropic from '@anthropic-ai/sdk'
import { requireActiveRecruiter } from '@/lib/api-auth'
import { parseJsonReply } from '@/lib/documents'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Propose what a role should be scored on, for recruiters with no JD.
 *
 * The "Set it up yourself" path used to collect a job title, a seniority
 * and a summary, and nothing at all about what the person has to be able
 * to do. Question generation then guessed the requirements from the job
 * title and nobody was ever told. This turns that silent guess into a
 * visible list the recruiter ticks, so a hand-typed role ends up with
 * requirements a human confirmed, exactly like a role read off a JD.
 *
 * THE WORDING IS THE WHOLE THING.
 *
 * A list of skill nouns — "SEO", "Klaviyo", "Leadership" — would be
 * worse than no list. You cannot interview someone against a noun, so
 * the model would have to invent what "good SEO" means at question time,
 * which is the guessing this route exists to remove, moved one step
 * later. Every line has to name something a person has DONE, because
 * that is what a question can be written against and what a score can
 * quote evidence for.
 */
const SUGGESTION_COUNT = 10

const PROMPT_RULES = `Rules, in order of importance:

1. Every line names something the candidate has DONE, not something they
   "know" or "are". "Has taken a content site from flat traffic to
   growing" is right. "SEO", "Strong communicator" and "Detail-oriented"
   are all wrong — nobody can demonstrate a noun or an adjective in an
   interview answer.
2. Never a tool, platform or certification name. "Has built lifecycle
   email flows that drove revenue" is right; "Klaviyo" is not. Knowing a
   tool is not the same as being good at the job it is used for.
3. Never years of experience, age, education, or anything else that is
   not about doing the work.
4. Six to fourteen words. Long enough to be specific, short enough to
   scan down a list of ten.
5. Cover the whole job, not ten angles on its most obvious part. A
   marketing role that is really three channels should have lines about
   each. A management role should have lines about the managing, not
   only the craft.
6. Pitch them at the stated seniority. A first job cannot have owned a
   strategy or carried a team; a lead who has only ever executed is not
   a lead.
7. No two lines that a single answer would satisfy.`

export async function POST(request) {
  /* Costs money and belongs to one recruiter. This route used to accept
     anyone with the URL, and never consulted the subscription — see
     lib/api-auth.js. */
  const gate = await requireActiveRecruiter()
  if (gate.response) return gate.response

    const body = await request.json().catch(() => ({}))
    const roleTitle = String(body?.roleTitle || '').trim()
    const experienceLevel = String(body?.experienceLevel || '').trim()
    const employmentType = String(body?.employmentType || '').trim()
    const department = String(body?.department || '').trim()
    const summary = String(body?.summary || '').trim()

    if (roleTitle.length < 2) {
        return Response.json({ error: 'A job title is required.' }, { status: 400 })
    }

    const context = [
        `Job title: ${roleTitle}`,
        experienceLevel ? `Seniority: ${experienceLevel}` : null,
        employmentType ? `Employment: ${employmentType}` : null,
        department ? `Department: ${department}` : null,
        summary ? `What the recruiter said about it: ${summary}` : null,
    ].filter(Boolean).join('\n')

    const prompt = `A recruiter is hiring for this role and has no job description to upload.

${context}

Propose exactly ${SUGGESTION_COUNT} things a candidate could be interviewed and scored on. They will tick the ones that apply, so offer a real spread rather than ten variations on one theme — it is fine if some do not fit, that is what ticking is for.

${PROMPT_RULES}

Return ONLY a raw JSON object, no markdown:

{ "suggestions": ["<line>", "<line>", ...] }`

    try {
        const result = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }],
        })

        const raw = result.content?.[0]?.text || ''
        const parsed = parseJsonReply(raw)

        const seen = new Set()
        const suggestions = []
        const source = Array.isArray(parsed?.suggestions)
            ? parsed.suggestions
            // Prose fallback: one per line, stripped of bullets and numbering.
            : raw.split('\n').map((l) => l.trim().replace(/^[-*\d.)\s]+/, ''))

        for (const item of source) {
            const label = String(typeof item === 'string' ? item : item?.label || '').trim().slice(0, 80)
            if (label.length < 8) continue
            const key = label.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
            if (!key || seen.has(key)) continue
            seen.add(key)
            suggestions.push(label)
            if (suggestions.length >= SUGGESTION_COUNT) break
        }

        if (!suggestions.length) {
            return Response.json({ error: 'Unable to suggest requirements. Please try again.' }, { status: 502 })
        }

        return Response.json({ suggestions })
    } catch (error) {
        console.error('suggest-requirements failed:', error)
        return Response.json({ error: 'Unable to suggest requirements. Please try again.' }, { status: 500 })
    }
}
