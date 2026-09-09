import Anthropic from '@anthropic-ai/sdk'
import { requireActiveRecruiter } from '@/lib/api-auth'
import { parseJsonReply } from '@/lib/documents'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

/**
 * Draft the role questions.
 *
 * We generate TWO questions for each requirement and let the recruiter
 * pick. That is the whole point of this route: one forced question per
 * requirement takes the judgement away from the person who actually
 * knows the role. Two gives them a real choice without turning the page
 * into a writing exercise, and the first of each pair is pre-selected so
 * a recruiter who touches nothing still ships a sane interview.
 *
 * FIVE requirements, not seven. Every selected question spawns a
 * mandatory follow-up at interview time, so five is ten recorded answers
 * plus three unscored openers — roughly fifteen minutes. Seven would be
 * twenty-five, which is where candidates quit.
 *
 * Seniority and topics are NOT replaced by the JD criteria — they shape
 * how each question is pitched. The same requirement ("owns renewals")
 * is a different question for a first job than for a team lead, and a
 * route that reads only the criteria list loses that entirely.
 *
 * Warm-up and background questions are NOT generated here. They live in
 * lib/interview-questions.js and are prepended at interview time, so the
 * recruiter's list only ever contains questions they can change.
 */
const TARGET = 5

/**
 * Hard ceiling when the recruiter confirmed more requirements than the
 * default.
 *
 * The drawer tells them "every candidate is scored on these six things".
 * Capping generation at five silently breaks that promise: one
 * requirement they explicitly confirmed never gets asked about, and
 * nothing on the questions page says so. So the count follows what they
 * confirmed, and the interview-length line is what tells them the cost.
 *
 * Six is the ceiling because parse-jd will not return more, and because
 * seven requirements is a twenty-five minute interview.
 */
const MAX_TARGET = 6
const PER_REQUIREMENT = 2

/**
 * Stage levels are stored as 'introductory' | 'mid-level' | 'advanced',
 * but older stages and the resume path use 'easy' | 'medium' | 'hard'.
 * Both spellings are here on purpose: a missing key silently fell
 * through to medium, which is how an entry-level role ended up being
 * asked senior questions with nobody noticing.
 */
const LEVEL_GUIDANCE = {
    easy: `This is pitched at someone early in their career. Ask what they
did and how they did it. Do not ask them to have owned a strategy, set a
direction for other people, or defend a call made under commercial
pressure — they will not have had the chance, and a question nobody can
answer tells you nothing.`,
    medium: `This is pitched at someone with real experience but not
running the function. Ask for worked examples they personally drove, and
push one level past the description into why they chose that way over
the obvious alternative.`,
    hard: `This is pitched senior. Assume they can do the task and ask
about judgement instead: the trade-off they made, what it cost, what
they would do differently, and how they carried other people with them.
A question a competent junior could answer well is a wasted question
here.`,
}

const LEVEL_ALIAS = {
    introductory: 'easy',
    entry: 'easy',
    junior: 'easy',
    'mid-level': 'medium',
    mid: 'medium',
    intermediate: 'medium',
    standard: 'medium',
    advanced: 'hard',
    senior: 'hard',
    lead: 'hard',
}

function levelBlock(level) {
    const raw = String(level || '').toLowerCase().trim()
    const key = LEVEL_ALIAS[raw] || raw
    return LEVEL_GUIDANCE[key] || LEVEL_GUIDANCE.medium
}

/** The same question in different words is worse than one question. */
function normalise(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export async function POST(request) {
  /* Costs money and belongs to one recruiter. This route used to accept
     anyone with the URL, and never consulted the subscription — see
     lib/api-auth.js. */
  const gate = await requireActiveRecruiter()
  if (gate.response) return gate.response

    const body = await request.json()
    const { stageName, level, topics, roleTitle, mustHaves, greatVsOkay, flexible } = body

    const flex = Array.isArray(flexible) ? flexible : []
    const criteria = (Array.isArray(mustHaves) ? mustHaves : [])
        .map((m) => (typeof m === 'string' ? m : m?.label))
        .filter(Boolean)
        .slice(0, MAX_TARGET)

    // One group per confirmed requirement. Falls back to TARGET when the
    // role was typed by hand and has no criteria to count.
    const target = criteria.length || TARGET

    const topicLine = topics
        ? `The recruiter also wants these covered, so work them into the questions above where they fit: ${topics}.`
        : ''

    const criteriaBlock = criteria.length
        ? `The recruiter confirmed this role requires:
${criteria.map((c, i) => `${i + 1}. ${c}${flex.includes(c) ? '   (they would compromise on this one)' : ''}`).join('\n')}

Write exactly ${PER_REQUIREMENT} questions for EACH requirement above, in
that order. The two must not be the same question reworded — they should
get at the requirement from genuinely different angles, for example one
asking them to walk through a time they did it and one asking how they
handled it going wrong. List the stronger one first.

${topicLine}`
        : `Cover these topics: ${topics || 'the core skills and competencies of the role'}.
Pick the ${target} things that matter most for this role, and write
${PER_REQUIREMENT} questions for each, stronger one first.`

    const barBlock = greatVsOkay
        ? `
The recruiter says this is what separates a great candidate from an
adequate one:
"${greatVsOkay}"

Aim the questions at ground where that difference would actually show.
Never quote this back to the candidate: telegraphing the answer you want
is how you get a rehearsed one.
`
        : ''

    const prompt = `You are helping a recruiter prepare a screening interview${roleTitle ? ` for a "${roleTitle}" role` : ''}${stageName ? `, "${stageName}" stage` : ''}.

SENIORITY AND DIFFICULTY
${levelBlock(level)}

${criteriaBlock}
${barBlock}
Every question must be answerable by describing something the candidate
has actually done. No hypotheticals, no puzzles, no trivia.

Every candidate for this role is asked the same questions so their answers
can be compared, so never write a question that assumes a particular
employer, tool, sector or background a candidate may not have.

Do NOT write warm-up, background or "tell me about yourself" questions.
Those are asked automatically at interview time.

Return ONLY a raw JSON object, no markdown:

{
  "groups": [
    {
      "covers": "<the requirement these are for, copied exactly>",
      "questions": ["<stronger question>", "<the alternative>"]
    }
  ]
}`

    try {
        const result = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2500,
            messages: [{ role: 'user', content: prompt }],
        })

        const raw = result.content?.[0]?.text || ''
        const parsed = parseJsonReply(raw)

        const seen = new Set()
        const groups = []

        for (const g of Array.isArray(parsed?.groups) ? parsed.groups : []) {
            const covers = g?.covers ? String(g.covers).trim().slice(0, 120) : null
            const options = []
            for (const q of Array.isArray(g?.questions) ? g.questions : []) {
                const text = String(typeof q === 'string' ? q : q?.text || '').trim()
                if (!text) continue
                const key = normalise(text)
                if (!key || seen.has(key)) continue
                seen.add(key)
                options.push({ text, covers })
                if (options.length >= PER_REQUIREMENT) break
            }
            if (options.length) groups.push({ covers, options })
            if (groups.length >= target) break
        }

        // The model occasionally replies in prose, or with a flat list,
        // despite the instruction. One question per line is a safe reading
        // of that: the recruiter loses the pairing and the criterion tags,
        // which still beats showing them nothing at all.
        if (!groups.length) {
            const flat = (Array.isArray(parsed?.questions) ? parsed.questions : [])
                .map((q) => String(typeof q === 'string' ? q : q?.text || '').trim())
                .filter(Boolean)

            const lines = flat.length
                ? flat
                : raw
                      .split('\n')
                      .map((l) => l.trim().replace(/^[-*\d.)\s]+/, ''))
                      .filter((l) => l.length > 15 && l.includes('?'))

            for (const text of lines) {
                const key = normalise(text)
                if (!key || seen.has(key)) continue
                seen.add(key)
                groups.push({ covers: null, options: [{ text, covers: null }] })
                if (groups.length >= target) break
            }
        }

        if (!groups.length) {
            return Response.json({ error: 'Unable to generate questions. Please try again.' }, { status: 502 })
        }

        // The flat list is what a recruiter ships if they change nothing:
        // the first option of each group. Older callers read this too.
        const questions = groups.map((g) => g.options[0])

        return Response.json({ groups, questions })
    } catch (error) {
        console.error('generate-questions failed:', error)
        return Response.json({ error: 'Unable to generate questions. Please try again.' }, { status: 500 })
    }
}
