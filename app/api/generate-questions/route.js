import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
    const body = await request.json()
    const { stageName, level, topics } = body

    const prompt = `You are helping a recruiter prepare an interview.

Draft 4 interview questions for this stage:
- Stage: ${stageName}
- Difficulty level: ${level}
- Topics to cover: ${topics || 'general'}

Match the difficulty to the level given. Keep each question to one or two sentences.
Respond with ONLY the questions, one per line, no numbering, no extra text.`

    try {
        const result = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
        })

        const text = result.content[0].text
        const questions = text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)

        return Response.json({ questions: questions })
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 })
    }
}