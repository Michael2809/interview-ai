import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

const WARMUP_QUESTIONS = [
  "Tell me a little about yourself and what you've been up to recently.",
  "Walk me through your background — what kind of work or experience have you had so far?",
  "What made you interested in applying for this kind of role?",
]

export async function POST(request) {
    const body = await request.json()
    const { stageName, level, topics } = body

    const prompt = `You are helping a recruiter prepare an interview for a "${stageName}" stage at "${level}" difficulty.
Topics to cover: ${topics || 'general skills and competency'}.

Generate 7 competency and skills-based interview questions that test the candidate's actual knowledge and ability. These should be scenario-based, practical, or knowledge-probing questions that go deep on what the candidate knows. Match the "${level}" difficulty level.

Do NOT include any warm-up or background questions — those are already handled separately.

Respond with ONLY the questions, one per line, no numbering, no extra text.`

    try {
        const result = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
        })

        const text = result.content[0].text
        const aiQuestions = text
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)

        // Warm-up questions always come first, then competency questions
        const questions = [...WARMUP_QUESTIONS, ...aiQuestions]

        return Response.json({ questions })
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 })
    }
}