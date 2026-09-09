import { AssemblyAI } from 'assemblyai'
import { createServiceClient } from '@/lib/supabase/service'

const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY })

const BUCKET = 'interview-videos'
const FILENAME = /^([0-9]+)-audio-[0-9]+\.(webm|mp4)$/

/**
 * Takes a filename, not a URL.
 *
 * It used to take the signed audio URL straight from the candidate's
 * browser, which meant the browser had to be able to sign storage
 * objects - and the policy that allowed that let anyone with the public
 * key download every recording in the bucket. The signing happens here
 * now, with the service key, and the URL is handed to AssemblyAI without
 * ever passing through a client.
 */
export async function POST(request) {
  const { audioFilename, stageId, candidateName, sessionId } = await request.json()

  const match = FILENAME.exec(String(audioFilename || ''))
  if (!match || match[1] !== String(stageId)) {
    return Response.json({ error: 'Unrecognised audio file.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: signed, error: signErr } = await supabase
    .storage.from(BUCKET).createSignedUrl(audioFilename, 60 * 60 * 2)
  if (signErr || !signed?.signedUrl) {
    console.error('analyze-audio: signing failed:', signErr)
    return Response.json({ error: 'Could not read the audio.' }, { status: 502 })
  }
  const audioUrl = signed.signedUrl

  try {
    const transcript = await client.transcripts.transcribe({
      audio_url: audioUrl,
      sentiment_analysis: true,
      entity_detection: true,
      iab_categories: false,
     speech_models: ['universal-3-pro'],
      disfluencies: true,
    })

    if (transcript.status === 'error') {
      console.error('AssemblyAI error:', transcript.error)
      return Response.json({ error: transcript.error }, { status: 500 })
    }

    const words = transcript.words || []
    const totalWords = words.length
    const duration = transcript.audio_duration || 1

    // Calculate speaking pace (words per minute)
    const wordsPerMinute = Math.round((totalWords / duration) * 60)

    // Count filler words
    const fillerWords = ['um', 'uh', 'like', 'you know', 'basically', 'literally', 'actually', 'so', 'right']
    const fillerCount = words.filter(w => fillerWords.includes(w.text.toLowerCase())).length

    // Average confidence
    const avgConfidence = words.length > 0
      ? Math.round(words.reduce((sum, w) => sum + (w.confidence || 0), 0) / words.length * 100)
      : 0

    // Sentiment summary
    const sentiments = transcript.sentiment_analysis_results || []
    const positiveCount = sentiments.filter(s => s.sentiment === 'POSITIVE').length
    const negativeCount = sentiments.filter(s => s.sentiment === 'NEGATIVE').length
    const neutralCount = sentiments.filter(s => s.sentiment === 'NEUTRAL').length

    const analysis = {
      transcript: transcript.text,
      wordsPerMinute,
      fillerWordCount: fillerCount,
      avgPronunciationConfidence: avgConfidence,
      sentimentBreakdown: {
        positive: positiveCount,
        negative: negativeCount,
        neutral: neutralCount,
      },
      totalWords,
      durationSeconds: Math.round(duration),
    }

    // Save analysis to database
    await supabase.from('interviews').insert({
      stage_id: stageId,
      speaker: 'analysis',
      content: JSON.stringify(analysis),
      candidate_name: candidateName,
      // Comes from the interview client so this analysis binds to the attempt
      // that produced it, rather than floating free across all of a
      // candidate's attempts.
      session_id: sessionId ?? null,
    })

    return Response.json({ success: true, analysis })

  } catch (err) {
    console.error('Analysis error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}