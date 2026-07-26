import Anthropic from '@anthropic-ai/sdk'
import { NextResponse } from 'next/server'

const client = new Anthropic()

export async function POST(req) {
  try {
    const { jobTitle } = await req.json()
    if (!jobTitle) return NextResponse.json({ error: 'Job title required' }, { status: 400 })

    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `Generate 6 interview screening questions for a ${jobTitle} position. 
Return ONLY a valid JSON array of strings. No explanation, no markdown, no extra text.
Example format: ["Question 1?", "Question 2?", "Question 3?"]`
      }]
    })

    const raw = message.content[0].text.trim()
    const questions = JSON.parse(raw)
    return NextResponse.json({ questions })

  } catch (err) {
    console.error('Question generation error:', err)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}