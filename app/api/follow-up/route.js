import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Decide whether the candidate's answer warrants a follow-up, and if so, write
 * one grounded in what they actually said.
 *
 * Returns { followUp: string } or { followUp: null }.
 *
 * Design notes
 * ------------
 * The model decides IF a follow-up is warranted, not just what it should be.
 * The previous behaviour asked a hardcoded sentence whenever an answer was under
 * 25 words, which was backwards twice over: it prodded candidates who had
 * nothing left to add, and it never probed the long, confident answers where the
 * interesting gaps actually live.
 *
 * The transcript is raw speech-to-text, so the same caveat as scoring applies —
 * never follow up on how something was said, only on what is missing from it.
 */

const NONE = 'NONE'

export async function POST(request) {
  let stageName, level, question, answer
  try {
    const body = await request.json()
    ;({ stageName, level, question, answer } = body)
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!question || !answer || !String(answer).trim()) {
    return Response.json({ followUp: null })
  }

  const prompt = `You are conducting a "${stageName || 'interview'}" interview at "${level || 'standard'}" difficulty.

You asked:
"${question}"

The candidate answered (this is RAW speech-to-text: no punctuation, and some
words are misrecognised — judge the substance, never the phrasing):
"${answer}"

Decide whether ONE follow-up question would genuinely add information.

Ask a follow-up only if there is a specific, identifiable gap, such as:
- they described an outcome but not how they arrived at it
- they claimed a result with no scale, number or timeframe
- they described what "we" did without saying what THEY did
- they named a decision but not the alternatives or trade-offs
- they answered a different question than the one asked

Do NOT ask a follow-up if:
- the answer is already specific and complete
- the only follow-up you can think of is generic ("tell me more", "can you give
  an example") with no particular gap in mind
- the candidate clearly has no further experience to draw on — pressing would
  produce nothing and only make the interview feel adversarial

If a follow-up is warranted, write ONE short, conversational question that
references something concrete the candidate actually said. Do not preface it.
Match the "${level || 'standard'}" difficulty.

If no follow-up is warranted, reply with exactly: ${NONE}

Reply with ONLY the question, or ONLY ${NONE}.`

  try {
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = (result.content?.[0]?.text || '').trim()

    // Treat anything that looks like a refusal as "no follow-up". Being strict
    // here matters: a stray "NONE." reaching the candidate as a spoken question
    // would be worse than skipping the follow-up entirely.
    const normalized = text.replace(/[."'\s]/g, '').toUpperCase()
    if (!text || normalized === NONE || normalized.startsWith(NONE)) {
      return Response.json({ followUp: null })
    }

    // A "follow-up" that isn't a question is almost certainly the model
    // narrating rather than asking. Skip rather than speak it.
    if (!text.includes('?')) {
      return Response.json({ followUp: null })
    }

    return Response.json({ followUp: text })
  } catch (error) {
    console.error('follow-up generation failed:', error?.message ?? error)
    // Fail closed: no follow-up, interview advances normally.
    return Response.json({ followUp: null })
  }
}
