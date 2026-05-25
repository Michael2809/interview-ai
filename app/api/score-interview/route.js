import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(request) {
  const { transcript, stageName } = await request.json()

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
{"score": <number from 1 to 10>, "summary": "<2-3 sentence summary>"}`,
      },
    ],
  })

  const text = response.content[0].text.trim()
  const clean = text.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(clean)
    return Response.json(parsed)
  } catch {
    return Response.json({ error: 'Could not parse AI response: ' + text }, { status: 500 })
  }
}