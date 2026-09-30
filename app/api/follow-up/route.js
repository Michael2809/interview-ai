import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * The interviewer's next move after the candidate speaks.
 *
 * A real interviewer does not ask a question, take the answer and read the
 * next line off a sheet. They react. Something interesting gets dug into,
 * something vague gets pinned down, a dodge gets a gentle "can I ask why?",
 * a misunderstanding gets the question rephrased, and when there is nothing
 * more to get they say "okay, thanks" and move on.
 *
 * This route is that reaction. It sees the WHOLE exchange on the current
 * question so far (the question, every follow-up, every answer) and returns
 * one of two moves:
 *
 *   { action: 'ask',     kind, say }   say one more thing and listen again
 *   { action: 'move_on', kind, say }   close this question, say is a short
 *                                      closing line spoken before the next one
 *
 * The client owns the clock. It tells us how many follow-ups have been asked
 * and the most it will allow, and it cuts the conversation off itself when
 * the time budget runs out. This route only decides what a good interviewer
 * would do next.
 *
 * `required` means the first reply on this question may not be a move_on:
 * every drafted role question gets at least one real reaction, so no
 * candidate gets a shallower interview than the next one.
 */

const KINDS = new Set(['probe', 'specifics', 'refusal', 'redirect', 'clarify', 'unclear', 'hypothetical', 'wrap'])

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const {
    stageName, level, roleTitle,
    question,
    required = false,
    maxFollowUps = 3,
  } = body || {}

  // `thread` is every turn on this question after the original ask:
  // [{ asked: <what the interviewer said>, answer: <what the candidate said> }]
  // The first entry's `asked` is the original question itself.
  // Older clients send a single { question, answer } — accept that too.
  let thread = Array.isArray(body?.thread) ? body.thread : null
  if (!thread && body?.answer) thread = [{ asked: question, answer: body.answer }]
  thread = (thread || [])
    .filter((t) => t && typeof t.answer === 'string')
    .map((t) => ({ asked: String(t.asked || ''), answer: String(t.answer || '').slice(0, 4000) }))

  if (!question || thread.length === 0 || !thread[thread.length - 1].answer.trim()) {
    return Response.json({ action: 'move_on', kind: 'wrap', say: '' })
  }

  const followUpsAsked = Math.max(0, thread.length - 1)
  const mustAsk = !!required && followUpsAsked === 0
  const lastTurn = followUpsAsked + 1 >= maxFollowUps

  const prompt = buildPrompt({
    stageName, level, roleTitle, question, thread,
    followUpsAsked, maxFollowUps, mustAsk, lastTurn,
  })

  try {
    const result = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const raw = (result.content?.[0]?.text || '').trim()
    const move = parseMove(raw)
    if (!move) return Response.json(fallback(mustAsk))

    // The model said move on when it was not allowed to. Rare, but a
    // required question with no reaction at all is the one thing this
    // route exists to prevent.
    if (move.action === 'move_on' && mustAsk) return Response.json(fallback(true))

    return Response.json(move)
  } catch (error) {
    console.error('follow-up generation failed:', error?.message ?? error)
    // Fail soft: the interview carries on with a plain closing line.
    return Response.json({ action: 'move_on', kind: 'wrap', say: '' })
  }
}

/**
 * Pull the JSON out of the model's reply and hold it to the contract.
 * Anything that would sound broken when spoken aloud is rejected.
 */
function parseMove(raw) {
  if (!raw) return null
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  let obj
  try { obj = JSON.parse(raw.slice(start, end + 1)) } catch { return null }

  const action = obj?.action === 'ask' ? 'ask' : obj?.action === 'move_on' ? 'move_on' : null
  if (!action) return null
  const kind = KINDS.has(obj?.kind) ? obj.kind : (action === 'ask' ? 'probe' : 'wrap')
  let say = typeof obj?.say === 'string' ? obj.say.replace(/\s+/g, ' ').trim() : ''

  // Never read out anything that looks like instructions or markup.
  if (/[{}<>[\]]|NONE|JSON/.test(say)) return null

  if (action === 'ask') {
    // The prompt asks for a question mark, but a clarifying line like
    // "Any job is fine, I just mean a time you had a tough target." is a
    // perfectly good thing to say and still hands the turn back. Only
    // reject what cannot be spoken: empty or rambling.
    if (say.length < 8 || say.length > 400) return null
  } else {
    // Closing lines stay short. A long one is the model sneaking in a question.
    if (say.includes('?') || say.length > 120) say = ''
  }
  return { action, kind, say }
}

/**
 * Used only when a reaction is required and the model gave us nothing
 * usable. Neutral, works after any answer, and still makes the
 * candidate go one level deeper.
 */
function fallback(mustAsk) {
  if (!mustAsk) return { action: 'move_on', kind: 'wrap', say: '' }
  return {
    action: 'ask',
    kind: 'specifics',
    say: 'Can you walk me through one specific time that happened, and what you personally did?',
  }
}

function buildPrompt({ stageName, level, roleTitle, question, thread, followUpsAsked, maxFollowUps, mustAsk, lastTurn }) {
  const exchange = thread.map((t, i) => {
    const who = i === 0 ? 'YOU ASKED (the main question)' : 'YOU FOLLOWED UP'
    return `${who}:\n"${t.asked}"\n\nCANDIDATE:\n"${t.answer}"`
  }).join('\n\n')

  const rules = []
  if (mustAsk) {
    rules.push('This is your FIRST reaction to this question. You MUST choose "ask". Every candidate gets at least one real reaction on this question.')
  }
  if (lastTurn && !mustAsk) {
    rules.push(`You have already asked ${followUpsAsked} follow-up${followUpsAsked === 1 ? '' : 's'}. You may ask at most one more. Only ask if it would clearly get something new, otherwise move on.`)
  }
  if (followUpsAsked >= maxFollowUps) {
    rules.push('You have used all your follow-ups on this question. You MUST choose "move_on".')
  }

  return `You are a warm, sharp, experienced human interviewer running a live
first-round screening interview${roleTitle ? ` for a ${roleTitle} role` : ''}
("${stageName || 'interview'}", ${level || 'standard'} difficulty). You are
talking with the candidate right now, out loud. Decide your next move the way
a good human interviewer would.

The candidate's words are RAW speech-to-text: no punctuation, and some words
are misrecognised. Judge what they meant, never how they said it.

THE CONVERSATION ON THIS QUESTION SO FAR
${exchange}

Read the candidate's LAST reply in the context of everything above, work out
which of these it is, and react like a person would:

1. A real, relevant answer.
   Pick the single most interesting, surprising, odd or unclear thing they
   said and dig into it. Good targets: a claim with no number or scale, an
   outcome with no "how", "we" where their own part is unclear, a decision
   with no alternatives or trade-off, something that doesn't quite add up
   with what they said earlier, a detail you are curious about.
   kind: "probe"

2. Vague or generic ("I'm a team player", "I always communicate well").
   Ask for one concrete, real example.
   kind: "specifics"

3. They decline, dodge or ask to skip ("I'd rather not answer", "can we skip
   this", "I don't want to talk about that", "pass").
   - If they have NOT declined earlier in this exchange: respond like a kind
     human. No pressure. Ask, gently, why, and offer an easy way out, e.g.
     "Sure, no problem. Can I ask what makes you prefer not to go into it? If
     it's confidential, a different example is completely fine." Adapt it,
     don't copy it.
     kind: "refusal", action: "ask"
   - If they already declined once, OR they gave a reason (confidentiality,
     NDA, personal), accept it gracefully and move on. Never push twice.
     If they offered a substitute answer instead, treat it as case 1.
     kind: "refusal", action: "move_on"

4. Off-topic: they answered a different question.
   Briefly and politely steer them back to what you actually asked.
   Only once. If they drift again, move on.
   kind: "redirect"

5. They ask you something about the question ("what do you mean?", "like in
   my current job?"). Rephrase or clarify the question simply, then ask it
   again. kind: "clarify"

6. Unclear or garbled, looks like the microphone failed or it's nonsense.
   If it looks like a transcription problem, ask them to say that again.
   If it is deliberate nonsense or a joke, redirect once, then move on.
   kind: "unclear"

7. "I don't know" or "I haven't done that".
   Once, ask how they WOULD approach it, or about the closest thing they
   have done. If they still have nothing, move on kindly.
   kind: "hypothetical"

8. Complete, and nothing new is worth getting. Move on.
   kind: "wrap"

HOW YOU TALK
- One short, natural, spoken sentence or two. You can start with a brief
  human acknowledgement ("Okay.", "Got it.", "Interesting.", "Right.") but
  not every time, and never praise or judge the answer ("Great answer",
  "Perfect", "That's wrong").
- When you probe, refer to something they ACTUALLY said, in plain words.
- Ask only ONE question at a time, and end with it, so the candidate knows
  it's their turn.
- Never ask about their grammar, accent, fluency or pace.
- Never reveal what the role is looking for or how they are being scored.
- Don't repeat a follow-up you already asked.
- Keep it professional and kind, even if the answer was rude or silly.
- When you move on, "say" is a short closing line of 2 to 6 words with NO
  question mark, like "Okay, thanks for that." or "Got it, let's move on."
  or "No problem at all." It is spoken just before the next question.
${rules.length ? '\nLIMITS FOR THIS TURN\n- ' + rules.join('\n- ') + '\n' : ''}
Reply with ONLY this JSON, nothing else:
{"action": "ask" | "move_on", "kind": "<one of: probe, specifics, refusal, redirect, clarify, unclear, hypothetical, wrap>", "say": "<exactly what you will say out loud>"}`
}
