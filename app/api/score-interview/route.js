import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// ─── Recommendation bands (score 0-10) ─────────────
function recommendationFromScore(score) {
  const s = Number(score)
  if (!Number.isFinite(s)) return 'hold'
  if (s >= 8.5) return 'strong-hire'
  if (s >= 6.5) return 'hire'
  if (s >= 4.5) return 'hold'
  return 'reject'
}

function statusFromRecommendation(rec) {
  if (rec === 'strong-hire' || rec === 'hire') return 'shortlisted'
  if (rec === 'hold') return 'on-hold'
  return 'rejected'
}

// ─── Confidence (server-side, deterministic) ────────
function median(nums) {
  if (!nums.length) return 0
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function stddev(nums) {
  if (nums.length < 2) return 0
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length
  const variance = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / nums.length
  return Math.sqrt(variance)
}

function computeConfidence({ transcript, questionReviews, llmConsistency, llmCoveragePct, speechClarityPct }) {
  const candidateTurns = (transcript || []).filter(
    (l) => l.speaker && l.speaker !== 'interviewer' && l.content,
  )
  const wordCounts = candidateTurns
    .map((t) => (t.content || '').trim().split(/\s+/).filter(Boolean).length)
    .filter((n) => n > 0)

  const volume = Math.round(100 * (1 - Math.exp(-candidateTurns.length / 6)))
  const medWords = median(wordCounts)
  const depth = Math.max(0, Math.min(100, Math.round((medWords / 40) * 100)))
  const consistency = Math.max(0, Math.min(100, Math.round(llmConsistency ?? 75)))
  const coverage = Math.max(0, Math.min(100, Math.round(llmCoveragePct ?? 80)))
  const clarity = Math.max(0, Math.min(100, Math.round(speechClarityPct ?? 75)))

  const perQ = (questionReviews || []).map((q) => Number(q.score)).filter((n) => Number.isFinite(n))
  const sd = stddev(perQ)
  const varianceScore = Math.max(0, Math.min(100, Math.round(100 - (sd / 3.5) * 100)))

  const overall = Math.round(
    volume * 0.30 +
    depth * 0.25 +
    consistency * 0.15 +
    coverage * 0.15 +
    clarity * 0.10 +
    varianceScore * 0.05,
  )
  const clamped = Math.max(0, Math.min(100, overall))

  const factors = [
    { key: 'volume', val: volume, plus: candidateTurns.length + ' substantive answers',
      minus: candidateTurns.length < 6 ? candidateTurns.length + ' substantive answers only' : null },
    { key: 'depth', val: depth, plus: 'Detailed responses (median ' + Math.round(medWords) + ' words)',
      minus: medWords < 15 ? 'Short answers (median ' + Math.round(medWords) + ' words)' : null },
    { key: 'consistency', val: consistency, plus: 'Consistent reasoning',
      minus: consistency < 55 ? 'Some contradictions noted' : null },
    { key: 'coverage', val: coverage, plus: 'Answered every question',
      minus: coverage < 70 ? 'Skipped or hedged ' + (100 - coverage) + '% of questions' : null },
    { key: 'clarity', val: clarity, plus: 'Clear delivery',
      minus: clarity < 60 ? 'Poor speech clarity' : null },
    { key: 'variance', val: varianceScore, plus: 'Stable across topics',
      minus: sd > 2.5 ? 'Uneven answers across questions' : null },
  ]

  const positives = factors
    .filter((f) => f.val >= 65)
    .sort((a, b) => b.val - a.val)
    .slice(0, 3)
    .map((f) => ({ polarity: '+', label: f.plus }))
  const negatives = factors
    .filter((f) => f.minus)
    .sort((a, b) => a.val - b.val)
    .slice(0, 2)
    .map((f) => ({ polarity: '-', label: f.minus }))
  const reasons = [...positives, ...negatives].slice(0, 5)

  return { confidence: clamped, reasons }
}

function confidenceBand(pct) {
  if (pct >= 85) return { key: 'high', label: 'High',
    copy: 'Evidence is strong and consistent. Act on the recommendation.' }
  if (pct >= 65) return { key: 'fair', label: 'Fair',
    copy: 'A couple of soft signals. Skim the transcript before deciding.' }
  if (pct >= 45) return { key: 'mixed', label: 'Mixed',
    copy: 'Evidence is uneven. A second review is worth your time.' }
  return { key: 'low', label: 'Low',
    copy: 'The AI is not confident. Watch the interview yourself before deciding.' }
}

// ─── Prompt builder ──────────────────────────
function buildPrompt({ formatted, stageName, questions }) {
  const askedList = (questions || []).map((q, i) => (i + 1) + '. ' + q).join('\n') || '(No question list provided.)'
  return `You are evaluating a candidate interview for the "${stageName || 'interview'}" stage.

IMPORTANT — how to read this transcript:
The transcript below is RAW, UNEDITED speech-to-text. It was produced by an
automatic recogniser with no human correction. It therefore contains:
  - no punctuation and no sentence boundaries
  - misrecognised words ("handing" for "handling", "since correctly" for
    "incorrectly", "Engine engineer" for "a backend engineer")
  - filler words, false starts and self-corrections that every speaker produces

These are artefacts of the recogniser and of ordinary speech. They are NOT
evidence about the candidate. Do not penalise them.

Judge ONLY: the substance of the reasoning, the specificity and concreteness of
the examples, whether the answer actually addresses the question asked, and
whether claims are supported. Where a word is clearly a mistranscription, infer
what the candidate meant and evaluate that. A candidate who explains something
correctly in messy, unpunctuated speech has answered well.

Questions the interviewer was told to ask:
${askedList}

Transcript:
${formatted}

Return ONLY a raw JSON object - no markdown, no backticks, no prose outside the JSON.

{
  "score": <number 0.0 to 10.0, one decimal>,
  "summary": "<2-3 sentence executive verdict for the recruiter>",
  "strengths": [
    { "title": "<3-5 word label>", "evidence": "<one direct or paraphrased line grounded in the transcript>" }
  ],
  "concerns": [
    { "title": "<3-5 word label>", "evidence": "<one line grounded in the transcript>" }
  ],
  "question_reviews": [
    {
      "question": "<question text or paraphrase>",
      "score": <number 0.0 to 10.0>,
      "recommendation": "<Strong|Good|Weak|Poor>",
      "reasoning": "<one sentence explaining the score>",
      "evidence_quote": "<the candidate's own words that support the score>"
    }
  ],
  "internal_consistency": <0-100 - how internally consistent the candidate's claims were>,
  "coverage_percent":    <0-100 - how many of the asked questions received a substantive answer>
}

Scoring scale — use the WHOLE range, including the top:
  9.0-10.0  Excellent. Specific, concrete, well-reasoned. Names real decisions,
            trade-offs or numbers. Directly answers what was asked. A 10 is
            attainable and SHOULD be given when an answer genuinely earns it.
  7.5-8.9   Strong. Solid substance and a real example, with some depth left
            unexplored.
  6.0-7.4   Adequate. Answers the question but stays general, or gives an
            example without detail.
  4.0-5.9   Weak. Vague, partly off-question, or claims without support.
  0.0-3.9   Poor. Does not answer, or the substance is wrong.

Calibrate honestly in both directions. Do not cluster scores in the middle out
of caution: a strong answer marked 7 is as much an error as a weak answer marked
9. Reserve low scores for genuinely weak substance, not for messy delivery.

Rules:
- Include 1-5 strengths and 0-3 concerns. Only include concerns if they genuinely apply.
- Every strength and concern MUST have an evidence sentence rooted in what the candidate said.
- A concern must be about substance. Never raise a concern about grammar,
  fluency, filler words, punctuation or transcription quality.
- Include one question_reviews entry per asked question if you can identify their answer, otherwise omit that entry.
- Use these bands for the top-level score: 8.5+ = Strong Hire, 6.5-8.4 = Hire, 4.5-6.4 = Hold, <4.5 = Reject.`
}

// ─── POST ──────────────────────────
// Idempotency window: if a scored row for this (stage_id, candidate_name)
// already exists AND was written within the last SCORE_TTL_MS, return the
// cached row instead of paying for another LLM call. This absorbs the
// duplicate requests that happen when the interview page's finishInterview
// and the transcript page's safety-net kick both fire for the same
// interview. Manual re-score (recruiter clicks Retry) still overrides via
// the `force: true` flag.
const SCORE_TTL_MS = 5 * 60 * 1000

export async function POST(request) {
  const body = await request.json()
  const { transcript, stageName, stageId, candidateName, questions, speechClarityPct, force } = body

  // ── Short-window idempotency ─────────────────────
  // Concurrent requests are common: the interview page fires one and
  // the transcript page may fire another before the first lands.
  // Serving the existing row here prevents wasted LLM spend and,
  // more importantly, prevents two upserts racing on the unique key.
  if (!force && stageId && candidateName) {
    try {
      const existing = await supabase
        .from('scores')
        .select()
        .eq('stage_id', stageId)
        .eq('candidate_name', candidateName)
        .maybeSingle()
      if (existing.data && existing.data.score != null) {
        const ageMs = Date.now() - new Date(existing.data.created_at).getTime()
        if (Number.isFinite(ageMs) && ageMs < SCORE_TTL_MS) {
          return Response.json({ ...existing.data, cached: true })
        }
      }
    } catch (err) {
      console.warn('idempotency check failed, continuing to re-score:', err)
    }
  }

  const formatted = (transcript || [])
    .map((line) => line.speaker + ': ' + line.content)
    .join('\n')

  const prompt = buildPrompt({ formatted, stageName, questions })

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = (response.content[0] && response.content[0].text) ? response.content[0].text.trim() : ''
  const clean = text.replace(/```json|```/g, '').trim()

  let parsed
  try {
    parsed = JSON.parse(clean)
  } catch {
    return Response.json({ error: 'Could not parse AI response: ' + text }, { status: 500 })
  }

  const scoreNum = Math.max(0, Math.min(10, Number(parsed.score) || 0))

  const strengths = Array.isArray(parsed.strengths)
    ? parsed.strengths.filter((s) => s && s.title && s.evidence).slice(0, 5)
    : []
  const concerns = Array.isArray(parsed.concerns)
    ? parsed.concerns.filter((c) => c && c.title && c.evidence).slice(0, 3)
    : []
  const questionReviews = Array.isArray(parsed.question_reviews)
    ? parsed.question_reviews
        .filter((q) => q && q.question)
        .map((q) => ({
          question: String(q.question).slice(0, 400),
          score: Math.max(0, Math.min(10, Number(q.score) || 0)),
          recommendation: q.recommendation || null,
          reasoning: q.reasoning || null,
          evidence_quote: q.evidence_quote || null,
        }))
    : []

  const recommendation = recommendationFromScore(scoreNum)
  const status = statusFromRecommendation(recommendation)

  const { confidence, reasons } = computeConfidence({
    transcript,
    questionReviews,
    llmConsistency: parsed.internal_consistency,
    llmCoveragePct: parsed.coverage_percent,
    speechClarityPct,
  })
  const band = confidenceBand(confidence)

  const payload = {
    score: Number(scoreNum.toFixed(1)),
    summary: parsed.summary || '',
    recommendation,
    status,
    confidence,
    confidence_band: band.key,
    confidence_copy: band.copy,
    confidence_reasons: reasons,
    strengths,
    concerns,
    question_reviews: questionReviews,
  }

  if (stageId && candidateName) {
    // CRITICAL: check the upsert error. Prior code awaited without
    // inspecting the result — a schema mismatch, RLS block, or size
    // constraint would fail silently and the endpoint would return
    // 200 with a computed payload but no persisted row. That's the
    // exact failure mode where recruiters saw "Automatic Analysis
    // Failed" despite the server returning 200.
    const { error: upsertErr } = await supabase.from('scores').upsert({
      stage_id: stageId,
      candidate_name: candidateName,
      score: payload.score,
      summary: payload.summary,
      status: payload.status,
      recommendation: payload.recommendation,
      confidence: payload.confidence,
      confidence_copy: payload.confidence_copy,
      confidence_reasons: payload.confidence_reasons,
      strengths: payload.strengths,
      concerns: payload.concerns,
      question_reviews: payload.question_reviews,
    }, { onConflict: 'stage_id,candidate_name' })
    if (upsertErr) {
      console.error('scores upsert failed:', upsertErr)
      return Response.json(
        { error: 'Failed to persist score. ' + upsertErr.message },
        { status: 500 },
      )
    }
  } else {
    // Persistence context missing — the caller can still use the
    // returned payload but the recruiter surface won't pick it up.
    console.warn('score-interview: missing stageId or candidateName; skipping persist', { stageId, candidateName })
  }

  return Response.json(payload)
}
