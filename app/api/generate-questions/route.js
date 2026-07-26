import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Generates ONLY role-specific competency questions.
 *
 * Warm-up / introduction questions used to be baked into this
 * response — they've been moved to the interview runtime so the
 * recruiter's approval list contains only genuinely AI-generated
 * questions. See INTRO_QUESTIONS in app/interview/[stageId]/page.js.
 */
export async function POST(request) {
    const body = await request.json()
    const { stageName, level, topics } = body

    const prompt = `You are helping a recruiter prepare an interview for a "${stageName}" stage at "${level}" difficulty.
Topics to cover: ${topics || 'general skills and competency'}.

Generate 7 competency and skills-based interview questions that test the candidate's actual knowledge and ability. These should be scenario-based, practical, or knowledge-probing questions that go deep on what the candidate knows. Match the "${level}" difficulty level.

Do NOT include any warm-up, background, or "tell me about yourself" style questions — those are added automatically at interview time.

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

        return Response.json({ questions })
    } catch (error) {
        console.error('generate-questions failed:', error)
        return Response.json({ error: 'Unable to generate questions. Please try again.' }, { status: 500 })
    }
}