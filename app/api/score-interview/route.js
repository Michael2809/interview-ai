import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const { transcript, stageName, stageId, candidateName } = await request.json()
  const formatted = transcript
    .map((line) => line.speaker + ': ' + line.content)
    .join('\n')
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 500,
    messages: [
      {
        role: 'user',
        content: `You are evaluating a candidate interview for the "${stageName}" stage.
Here is the transcript:
${formatted}

Respond with only a raw JSON object, no markdown, no backticks, no explanation:
{
  "score": <number from 1 to 10>,
  "summary": "<2-3 sentence evaluation>",
  "status": "<shortlisted|on-hold|rejected>"
}

Use these guidelines for status:
- "shortlisted": strong answers, clear fit, score 7-10
- "on-hold": decent but uncertain, needs more consideration, score 4-6
- "rejected": poor performance, weak answers, score 1-3`,
      },
    ],
  })
  const text = response.content[0].text.trim()
  const clean = text.replace(/```json|```/g, '').trim()
  try {
    const parsed = JSON.parse(clean)

    // Save to DB using service role key if stageId and candidateName are provided
    if (stageId && candidateName) {
      await supabase.from('scores').upsert({
        stage_id: stageId,
        candidate_name: candidateName,
        score: parsed.score,
        summary: parsed.summary,
        status: parsed.status || 'on-hold',
      }, { onConflict: 'stage_id,candidate_name' })
    }

    return Response.json(parsed)
  } catch {
    return Response.json({ error: 'Could not parse AI response: ' + text }, { status: 500 })
  }
}