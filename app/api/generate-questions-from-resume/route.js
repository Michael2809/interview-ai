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

    const prompt = `You are an interview question generator for a recruiter.
The recruiter is hiring for an interview stage called "${stageName}" at "${level}" difficulty.
Focus topics: ${topics || 'general fit and experience'}.

Generate 5 personalized interview questions tailored to this specific candidate's resume. The questions should:
- Reference specific experiences, skills, projects, or roles from the resume
- Match the "${level}" difficulty level
- Cover the requested topics where relevant
- Be open-ended (not yes/no questions)

Return ONLY a JSON array of 5 strings, no other text, no markdown. Example: ["Question 1", "Question 2", "Question 3", "Question 4", "Question 5"]`

    let messages

    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // Send PDF directly to Claude — no parsing needed
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
      // Extract text for .docx / .txt
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