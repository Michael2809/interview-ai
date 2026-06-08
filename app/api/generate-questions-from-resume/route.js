import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('resume')
    const stageName = formData.get('stageName')
    const level = formData.get('level')
    const topics = formData.get('topics')

    if (!file) {
      return Response.json({ error: 'No file provided' }, { status: 400 })
    }

    const fileName = (file.name || '').toLowerCase()
    const mimeType = (file.type || '').toLowerCase()
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const prompt = `You are an experienced human interviewer reviewing a candidate's resume before their interview for a "${stageName}" stage at "${level}" difficulty.
Focus topics: ${topics || 'general fit and experience'}.

Generate exactly 10 interview questions that follow the natural flow a real human interviewer would use:

- Questions 1-3: Warm-up and background questions. Ask the candidate to walk you through their background, education, or work history in a natural way. Do NOT quote specific institution names, committee names, or copy lines from the resume verbatim. Keep it conversational — like "tell me about your most recent experience" or "walk me through your educational background."

- Questions 4-10: Competency and skills questions. Go deep on testing actual knowledge, technical ability, or practical skills relevant to the role. These should be scenario-based, skills-testing, or knowledge-probing questions based on what the resume suggests the candidate knows. Match the "${level}" difficulty.

Rules:
- Never ask questions that name-drop specific colleges, clubs, committees, or organizations from the resume. Use that information only to inform the depth and direction of your questions.
- Questions must be open-ended, not yes/no.
- Sound like a real interviewer talking to a person, not a form generator.

Return ONLY a JSON array of 10 strings, no other text, no markdown. Example: ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5", "Question 6", "Question 7", "Question 8", "Question 9", "Question 10"]`

    let messages

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      messages = [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: buffer.toString('base64'),
            },
          },
          { type: 'text', text: prompt },
        ],
      }]
    } else {
      let resumeText = ''

      if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword' ||
        fileName.endsWith('.docx') ||
        fileName.endsWith('.doc')
      ) {
        const result = await mammoth.extractRawText({ buffer })
        resumeText = result.value
      } else if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
        resumeText = buffer.toString('utf-8')
      } else {
        return Response.json({ error: 'Unsupported file type. Please upload a PDF, Word doc (.docx), or text file (.txt).' }, { status: 400 })
      }

      if (!resumeText || resumeText.trim().length === 0) {
        return Response.json({ error: 'Could not read the document. Make sure it has readable text.' }, { status: 400 })
      }

      messages = [{
        role: 'user',
        content: `${prompt}\n\nHere is the candidate's resume:\n---\n${resumeText}\n---`,
      }]
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages,
    })

    let text = response.content[0].text.trim()
    text = text.replace(/```json/g, '').replace(/```/g, '').trim()
    const questions = JSON.parse(text)

    return Response.json({ questions })
  } catch (err) {
    console.error('Resume route error:', err)
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}