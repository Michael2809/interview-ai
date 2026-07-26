import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
    const body = await request.json()
    const { stageName, level, question, answer } = body

    const prompt = `You are an interviewer conducting a "${stageName}" interview at a "${level}" difficulty level.

You just asked the candidate this question:
"${question}"

The candidate answered:
"${answer}"

Ask ONE short follow-up question that digs a little deeper into their answer.
Match the difficulty to the "${level}" level.
Respond with ONLY the follow-up question, nothing else.`

    try {
        const result = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 300,
            messages: [{ role: 'user', content: prompt }],
        })

        return Response.json({ followUp: result.content[0].text.trim() })
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 })
    }
}