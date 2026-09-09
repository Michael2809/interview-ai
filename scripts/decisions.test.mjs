/**
 * Guards the rule that the scorer never decides.
 *
 * Run: node scripts/decisions.test.mjs
 *
 * These cases exist because 'pending' is truthy. Three separate places
 * used to ask "has anyone decided?" by testing for a falsy status, and
 * all three broke silently the moment the scorer started writing
 * 'pending' instead of null.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasDecision, awaitingDecision, DECISION_STATUSES } from '../lib/decisions.js'

test('only a human decision counts as decided', () => {
  for (const s of DECISION_STATUSES) assert.equal(hasDecision(s), true, s)
  for (const s of ['pending', null, undefined, '', 'archived', 'in-progress']) {
    assert.equal(hasDecision(s), false, String(s))
  }
})

test('pending is awaiting review, exactly like the legacy null and empty rows', () => {
  assert.equal(awaitingDecision('pending'), true)
  assert.equal(awaitingDecision(null), true)
  assert.equal(awaitingDecision(''), true)
})

test('a decided candidate is not awaiting review', () => {
  for (const s of DECISION_STATUSES) assert.equal(awaitingDecision(s), false, s)
})

test('archived is neither decided nor awaiting', () => {
  assert.equal(hasDecision('archived'), false)
  assert.equal(awaitingDecision('archived'), false)
})

/* ── Cloudinary public_id extraction ─────────────────────────────────
 * Getting this wrong means either a failed delete (video survives a
 * deletion request) or a destroy call against the wrong id.
 */
import { publicIdFromUrl } from '../lib/cloudinary-url.js'

test('extracts the public_id from a real upload URL', () => {
  assert.equal(
    publicIdFromUrl('https://res.cloudinary.com/demo/video/upload/v1712345678/interview-videos/abc123.webm'),
    'interview-videos/abc123',
  )
})

test('survives transformation segments', () => {
  assert.equal(
    publicIdFromUrl('https://res.cloudinary.com/demo/video/upload/w_400,h_300/v1712/interview-videos/abc.mp4'),
    'interview-videos/abc',
  )
})

test('handles a public_id with dots and nested folders', () => {
  assert.equal(
    publicIdFromUrl('https://res.cloudinary.com/demo/video/upload/v1/interview-videos/2026/a.b.c.webm'),
    'interview-videos/2026/a.b.c',
  )
})

test('refuses anything that is not a Cloudinary upload URL', () => {
  for (const bad of [null, undefined, '', 'not a url', 'https://example.com/video.mp4', 'https://res.cloudinary.com/demo/video/upload/']) {
    assert.equal(publicIdFromUrl(bad), null, String(bad))
  }
})

/* ── Scored question set ─────────────────────────────────────────────
 * The interview page and both transcript-page score paths must send an
 * identical list. They previously disagreed, so the same interview
 * scored differently depending on which path fired.
 */
import { scoredQuestionTexts, INTRO_QUESTIONS } from '../lib/interview-questions.js'

test('no opening question moves the score', () => {
  // All three are asked, recorded and shown with evidence. None of them
  // count. How well someone talks about themselves is a measure of how
  // rehearsed they are, not of whether they can do the job, and while
  // two of these were scored a confident talker with none of the
  // requirements outranked a quiet one who had them all.
  const texts = scoredQuestionTexts([])
  assert.equal(texts.length, 0)
  for (const q of INTRO_QUESTIONS) {
    assert.equal(q.scored, false)
    assert.equal(texts.includes(q.text), false)
  }
})

test('the scored list is exactly the recruiter\'s own questions', () => {
  const texts = scoredQuestionTexts([{ text: 'Q1' }, { text: 'Q2' }])
  assert.deepEqual(texts, ['Q1', 'Q2'])
})

test('accepts plain strings and objects, and drops empties', () => {
  assert.deepEqual(
    scoredQuestionTexts(['A', { text: 'B' }, { text: null }, {}]).slice(-2),
    ['A', 'B'],
  )
})

test('every scoring path produces the identical list', () => {
  const dbQuestions = [{ text: 'Q1' }, { text: 'Q2' }, { text: 'Q3' }]
  // interview page: its live array, filtered to role questions
  const live = [{ type: 'intro' }, { type: 'ai', text: 'Q1' }, { type: 'ai', text: 'Q2' }, { type: 'ai', text: 'Q3' }]
  const fromInterview = scoredQuestionTexts(live.filter((q) => q.type === 'ai'))
  // transcript page: the approved rows straight from the database
  const fromTranscript = scoredQuestionTexts(dbQuestions)
  assert.deepEqual(fromInterview, fromTranscript)
})

/* ─────────────────────────────────────────────────────────────
 * Question grouping and the interview-length promise
 * ────────────────────────────────────────────────────────── */

import { groupQuestions, interviewShape, canAddCustomQuestion, customQuestionCount, CUSTOM_QUESTION_LIMIT } from '../lib/questions.js'

test('the two questions for one requirement are paired', () => {
  const { groups, custom } = groupQuestions([
    { id: 1, covers: 'Owns renewals', source: 'ai', approved: true },
    { id: 2, covers: 'Owns renewals', source: 'ai', approved: false },
    { id: 3, covers: 'Runs QBRs', source: 'ai', approved: true },
    { id: 4, covers: 'Runs QBRs', source: 'ai', approved: false },
  ])
  assert.equal(custom.length, 0)
  assert.equal(groups.length, 2)
  assert.deepEqual(groups.map((g) => g.options.length), [2, 2])
  assert.deepEqual(groups.map((g) => g.covers), ['Owns renewals', 'Runs QBRs'])
})

test('untagged questions are kept out of the requirement cards entirely', () => {
  // Every role created before requirements existed looks like this. As
  // one-option radio groups they rendered as "General competency" over
  // and over, each with a single choice and a Skip — a checkbox wearing
  // a costume, on a card claiming a requirement that is not there.
  const { groups, untagged } = groupQuestions([
    { id: 1, covers: null, source: 'ai' },
    { id: 2, covers: null, source: 'ai' },
    { id: 3, covers: null, source: 'ai' },
  ])
  assert.equal(groups.length, 0)
  assert.equal(untagged.length, 3)
})

test('a half-tagged stage splits, it does not pick one shape for everything', () => {
  const { groups, untagged } = groupQuestions([
    { id: 1, covers: 'Owns renewals', source: 'ai' },
    { id: 2, covers: 'Owns renewals', source: 'ai' },
    { id: 3, covers: null, source: 'ai' },
  ])
  assert.equal(groups.length, 1)
  assert.equal(groups[0].options.length, 2)
  assert.equal(untagged.length, 1)
})

test('untagged questions still count toward the interview length', () => {
  // They are source 'ai', so they get a follow-up at interview time like
  // any other drafted question. Counting them once would understate an
  // old role's interview by half.
  const shape = interviewShape([
    { id: 1, source: 'ai' },
    { id: 2, source: 'ai' },
  ])
  assert.equal(shape.answers, 7)   // 3 openers + 2 questions + 2 follow-ups
})

test("the recruiter's own questions are never grouped with the drafted ones", () => {
  const { groups, untagged, custom } = groupQuestions([
    { id: 1, covers: 'Owns renewals', source: 'ai' },
    { id: 2, covers: null, source: 'custom' },
    { id: 3, covers: null, source: 'custom' },
  ])
  assert.equal(groups.length, 1)
  assert.equal(untagged.length, 0)   // a custom question is not "untagged"
  assert.equal(custom.length, 2)
})

test('five drafted questions is thirteen answers and about fifteen minutes', () => {
  const shape = interviewShape(Array.from({ length: 5 }, (_, i) => ({ id: i, source: 'ai' })))
  assert.equal(shape.picked, 5)
  assert.equal(shape.answers, 13)   // 3 openers + 5 questions + 5 follow-ups
  assert.equal(shape.minutes, 15)
})

test('a custom question adds one answer, not two', () => {
  // Nothing follows up on a question the recruiter wrote, so it must not
  // be counted like one that does. Getting this wrong quietly overstates
  // every interview a recruiter customises.
  const withCustom = interviewShape([
    ...Array.from({ length: 5 }, (_, i) => ({ id: i, source: 'ai' })),
    { id: 98, source: 'custom' },
    { id: 99, source: 'custom' },
  ])
  assert.equal(withCustom.picked, 7)
  assert.equal(withCustom.answers, 15)
  assert.equal(withCustom.minutes, 18)
})

test('an empty stage still reports the three unscored openers', () => {
  const shape = interviewShape([])
  assert.equal(shape.picked, 0)
  assert.equal(shape.answers, 3)
})

test('a recruiter may write two of their own questions, not ten', () => {
  const drafted = [
    { id: 1, covers: 'A', source: 'ai' },
    { id: 2, covers: 'A', source: 'ai' },
  ]
  assert.equal(CUSTOM_QUESTION_LIMIT, 2)
  assert.equal(canAddCustomQuestion(drafted), true)
  assert.equal(canAddCustomQuestion([...drafted, { id: 3, source: 'custom' }]), true)
  assert.equal(
    canAddCustomQuestion([...drafted, { id: 3, source: 'custom' }, { id: 4, source: 'custom' }]),
    false,
  )
})

test('drafted questions never count against the custom limit', () => {
  // Six requirements is twelve drafted rows. If those were counted the
  // recruiter could never write one of their own on a well-specified role,
  // which is exactly the role where they are most likely to want to.
  const twelveDrafted = Array.from({ length: 12 }, (_, i) => ({ id: i, source: 'ai', covers: `c${i % 6}` }))
  assert.equal(customQuestionCount(twelveDrafted), 0)
  assert.equal(canAddCustomQuestion(twelveDrafted), true)
})

test('an unchecked custom question still uses its slot', () => {
  // It is still on the stage and one click from being asked. Counting only
  // the ticked ones would let a recruiter stack up unlimited drafts.
  const questions = [
    { id: 1, source: 'custom', approved: true },
    { id: 2, source: 'custom', approved: false },
  ]
  assert.equal(customQuestionCount(questions), 2)
  assert.equal(canAddCustomQuestion(questions), false)
})

/* ─────────────────────────────────────────────────────────────
 * Reading a CV honestly
 * ────────────────────────────────────────────────────────── */

import { normaliseMatch, normaliseMatches, countEvidence, rankCandidates, mapWithLimit, isTransient, mergeCvRows } from '../lib/resumes.js'

test('a claim without a quote is never counted as evidence', () => {
  // The rule the whole ranking rests on. Asked whether a resume shows
  // something, a model will say yes and then fail to produce the line it
  // supposedly read. An unquoted yes is a guess.
  const m = normaliseMatch({ requirement: 'Grew flat content traffic', status: 'shown' })
  assert.equal(m.status, 'claimed')
  assert.equal(m.evidence, null)
})

test('a quote is kept only for what it actually supports', () => {
  const shown = normaliseMatch({
    requirement: 'Grew flat content traffic',
    status: 'shown',
    evidence: 'Took the blog from 18,000 to 61,000 sessions',
  })
  assert.equal(shown.status, 'shown')
  assert.match(shown.evidence, /61,000/)

  // A quote attached to a claim is not evidence of the claim.
  const claimed = normaliseMatch({
    requirement: 'Owned social media growth',
    status: 'claimed',
    evidence: 'Handled social media presence',
  })
  assert.equal(claimed.evidence, null)
})

test('an unrecognised verdict falls to absent, never to shown', () => {
  // Fail closed. A garbled reply must not manufacture a qualification.
  for (const status of ['yes', 'true', 'partial', '', undefined, null]) {
    assert.equal(normaliseMatch({ requirement: 'x', status }).status, 'absent')
  }
})

test('the buzzword CV and the wrong-trade CV do not look alike', () => {
  // Priya says she does all six and proves one. Joseph is a chef. Under a
  // pass/fail read they were both "1 of 6" and "0 of 6" with nothing to
  // separate the unproven from the absent.
  const priya = normaliseMatches([
    { requirement: 'a', status: 'shown', evidence: 'ran a campaign that returned 3x' },
    { requirement: 'b', status: 'claimed' },
    { requirement: 'c', status: 'claimed' },
    { requirement: 'd', status: 'claimed' },
  ])
  const joseph = normaliseMatches([
    { requirement: 'a', status: 'absent' },
    { requirement: 'b', status: 'absent' },
    { requirement: 'c', status: 'absent' },
    { requirement: 'd', status: 'absent' },
  ])
  assert.deepEqual(countEvidence(priya), { shown: 1, claimed: 3, total: 4 })
  assert.deepEqual(countEvidence(joseph), { shown: 0, claimed: 0, total: 4 })
})

test('claims outrank silence, evidence outranks both, nobody is dropped', () => {
  const ranked = rankCandidates([
    { ok: true, name: 'silent', shown: 0, claimed: 0 },
    { ok: false, name: 'unreadable' },
    { ok: true, name: 'claims a lot', shown: 0, claimed: 5 },
    { ok: true, name: 'proves some', shown: 3, claimed: 1 },
    { ok: true, name: 'proves most', shown: 5, claimed: 0 },
  ])
  assert.deepEqual(
    ranked.map((r) => r.name),
    ['proves most', 'proves some', 'claims a lot', 'silent', 'unreadable'],
  )
  assert.equal(ranked.length, 5)
})

test('reading a batch keeps input order, whatever finishes first', () => {
  // The caller pairs results with filenames by position. Returning them in
  // completion order would quietly attribute one candidate's evidence to
  // another candidate's name, which is about the worst bug this code could
  // have and would look like a model failure, not an ordering one.
  const delays = [40, 5, 30, 1, 20, 10]
  return mapWithLimit(delays, 2, async (ms, i) => {
    await new Promise((r) => setTimeout(r, ms))
    return i
  }).then((out) => {
    assert.deepEqual(out, [0, 1, 2, 3, 4, 5])
  })
})

test('a batch never exceeds its concurrency, and never drops the tail', async () => {
  let live = 0
  let peak = 0
  const items = Array.from({ length: 11 }, (_, i) => i)
  const out = await mapWithLimit(items, 4, async (n) => {
    live++
    peak = Math.max(peak, live)
    await new Promise((r) => setTimeout(r, 5))
    live--
    return n * 2
  })
  assert.equal(peak, 4)
  assert.equal(out.length, 11)
  assert.equal(out[10], 20)
})

test('an empty upload does not hang', async () => {
  assert.deepEqual(await mapWithLimit([], 4, async () => 1), [])
})

test('only the failures worth retrying are retried', () => {
  for (const status of [429, 408, 409, 500, 503, 529]) {
    assert.equal(isTransient({ status }), true, `${status} should retry`)
  }
  // A corrupt PDF fails the same way every time. Retrying it just makes
  // the recruiter wait three times as long for the same answer.
  for (const status of [400, 401, 403, 404, 422]) {
    assert.equal(isTransient({ status }), false, `${status} should not retry`)
  }
  assert.equal(isTransient(new Error('boom')), false)
  assert.equal(isTransient(undefined), false)
})

test('adding more CVs keeps the ones already reviewed', () => {
  // The original code replaced the list. A recruiter who had corrected
  // three email addresses and ticked five people lost all of it by
  // uploading one more file, and the button said "Upload more".
  const reviewed = [
    { key: 'cv-0', fileName: 'a.pdf', email: 'fixed@x.example', include: true },
    { key: 'cv-1', fileName: 'b.pdf', email: 'b@x.example', include: false },
  ]
  const merged = mergeCvRows(reviewed, [{ key: 'cv-2', fileName: 'c.pdf' }])
  assert.equal(merged.length, 3)
  assert.equal(merged[0].email, 'fixed@x.example')
  assert.equal(merged[0].include, true)
})

test('re-uploading the same file replaces its row instead of duplicating it', () => {
  const existing = [
    { key: 'cv-0', fileName: 'a.pdf', shown: 0 },
    { key: 'cv-1', fileName: 'b.pdf', shown: 2 },
  ]
  const merged = mergeCvRows(existing, [{ key: 'cv-9', fileName: 'a.pdf', shown: 4 }])
  assert.equal(merged.length, 2)
  assert.equal(merged.filter((r) => r.fileName === 'a.pdf').length, 1)
  assert.equal(merged.find((r) => r.fileName === 'a.pdf').shown, 4)
})

test('merging into an empty list, and merging nothing, both behave', () => {
  assert.equal(mergeCvRows([], [{ fileName: 'a.pdf' }]).length, 1)
  assert.equal(mergeCvRows([{ fileName: 'a.pdf' }], []).length, 1)
  assert.deepEqual(mergeCvRows(), [])
})


/* ── Share links ─────────────────────────────────────────────────────
 * A share link is the only door into this product that does not need a
 * password, so the rules around it are worth more than a code review.
 */
import {
  newShareToken, looksLikeShareToken, shareLinkState, expiryFromKey,
  publicScore, publicLine, publicSender, EXPIRY_OPTIONS,
} from '../lib/share.js'

test('a fresh token is long, url-safe and never repeats', () => {
  const a = newShareToken()
  const b = newShareToken()
  assert.notEqual(a, b)
  assert.match(a, /^[A-Za-z0-9_-]+$/)
  assert.ok(a.length >= 40, `token too short: ${a.length}`)
  assert.equal(looksLikeShareToken(a), true)
})

test('junk in the URL is rejected before the database is touched', () => {
  for (const junk of ['', 'abc', '../../etc/passwd', 'a'.repeat(200), null, undefined, 42, 'has spaces']) {
    assert.equal(looksLikeShareToken(junk), false, String(junk))
  }
})

test('a revoked link is dead even if it has not expired', () => {
  const row = { revoked_at: '2026-09-01T00:00:00Z', expires_at: '2099-01-01T00:00:00Z' }
  assert.deepEqual(shareLinkState(row, new Date('2026-09-08')), { ok: false, reason: 'revoked' })
})

test('an expired link is dead even if it was never revoked', () => {
  const row = { revoked_at: null, expires_at: '2026-09-01T00:00:00Z' }
  assert.deepEqual(shareLinkState(row, new Date('2026-09-08')), { ok: false, reason: 'expired' })
})

test('a link with no expiry stays usable, and a missing row is not a crash', () => {
  assert.equal(shareLinkState({ revoked_at: null, expires_at: null }).ok, true)
  assert.deepEqual(shareLinkState(null), { ok: false, reason: 'missing' })
})

test('expiry is measured from now, and "never" really means no date', () => {
  const now = new Date('2026-09-08T00:00:00Z')
  assert.equal(expiryFromKey('7d', now), new Date('2026-09-15T00:00:00Z').toISOString())
  assert.equal(expiryFromKey('never', now), null)
  // An unknown key must not silently become "never".
  assert.equal(expiryFromKey('forever-please', now), null)
  assert.ok(EXPIRY_OPTIONS.some((o) => o.key === '7d'))
})

test('the shared payload never carries the recruiter private hiring status', () => {
  const row = {
    score: 7.2, summary: 'Solid.', recommendation: 'hire', status: 'rejected',
    confidence: 80, strengths: [{ title: 'a' }], concerns: [], question_reviews: [],
  }
  const out = publicScore(row)
  assert.equal('status' in out, false)
  assert.equal(out.recommendation, 'hire')
  assert.equal(out.score, 7.2)
})

test('a transcript line crossing the boundary loses the candidate email', () => {
  const line = {
    id: 5, speaker: 'candidate', content: 'I led the migration.',
    candidate_email: 'someone@example.com', token: 'uuid-here', session_id: 'sess-1',
    candidate_name: 'Priya', video_url: 'https://x/y.webm',
  }
  const out = publicLine(line)
  assert.deepEqual(Object.keys(out).sort(), ['content', 'id', 'speaker'])
})

test('the sender is a company name or nothing at all', () => {
  assert.deepEqual(publicSender({ company_name: 'Acme' }), { companyName: 'Acme' })
  assert.deepEqual(publicSender({ company_name: '   ' }), {})
  assert.deepEqual(publicSender(null), {})
})

test('a score row that does not exist yet does not throw', () => {
  assert.equal(publicScore(null), null)
  const empty = publicScore({})
  assert.deepEqual(empty.strengths, [])
  assert.deepEqual(empty.question_reviews, [])
})

/* ── Which attempt gets shown ────────────────────────────────────────
 * The recruiter page and the share page must pick the same one. That is
 * why the logic moved into lib/transcript.js, and why it is tested here
 * rather than trusted.
 */
import {
  splitSessions, pickLatestSpokenSession, transcriptOnly, readCandidateInterview,
} from '../lib/transcript.js'

const at = (n) => new Date(Date.UTC(2026, 8, 8, 10, n)).toISOString()

test('attempts are grouped by session_id, not by the per-row token', () => {
  const rows = [
    { id: 1, session_id: 's1', token: 'x1', speaker: 'interviewer', content: 'Q1', created_at: at(0) },
    { id: 2, session_id: 's1', token: 'x2', speaker: 'candidate',   content: 'A1', created_at: at(1) },
    { id: 3, session_id: 's2', token: 'x3', speaker: 'interviewer', content: 'Q1', created_at: at(9) },
  ]
  const groups = splitSessions(rows)
  assert.equal(groups.length, 2)
  assert.equal(groups[0].length, 2)
})

test('an abandoned attempt never wins over one the candidate spoke in', () => {
  // Opening the link and walking away writes a marker and one question.
  const spoken = [{ speaker: 'candidate', content: 'hello' }]
  const abandoned = [{ speaker: 'interviewer', content: 'Q1' }]
  assert.equal(pickLatestSpokenSession([spoken, abandoned]), spoken)
})

test('the latest spoken attempt wins when there are several', () => {
  const first = [{ speaker: 'candidate', content: 'old' }]
  const second = [{ speaker: 'candidate', content: 'new' }]
  assert.equal(pickLatestSpokenSession([first, second]), second)
})

test('bookkeeping rows are not mistaken for things somebody said', () => {
  const rows = [
    { speaker: 'session_start', content: '' },
    { speaker: 'interviewer', content: 'Q' },
    { speaker: 'candidate', content: 'A' },
    { speaker: 'video', content: '' },
    { speaker: 'analysis', content: '{}' },
    { speaker: 'audio', content: '' },
    { speaker: 'invite', content: '' },
    { speaker: 'candidate_qa', content: '{}' },
  ]
  assert.deepEqual(transcriptOnly(rows).map((r) => r.speaker), ['interviewer', 'candidate'])
})

test('one read gives both surfaces the same interview', () => {
  const rows = [
    { id: 1, candidate_name: 'Priya', session_id: 's1', speaker: 'session_start', content: '', created_at: at(0) },
    { id: 2, candidate_name: 'Priya', session_id: 's1', speaker: 'interviewer', content: 'Q1', created_at: at(1) },
    { id: 3, candidate_name: 'Priya', session_id: 's1', speaker: 'candidate', content: 'A1', created_at: at(3) },
    { id: 4, candidate_name: 'Priya', session_id: 's1', speaker: 'video', content: '', video_url: 'https://v/1.webm', created_at: at(4) },
    { id: 5, candidate_name: 'Priya', session_id: 's1', speaker: 'candidate_qa', content: '{"question":"Remote?","answered":false}', created_at: at(5) },
    { id: 6, candidate_name: 'Someone Else', session_id: 's9', speaker: 'candidate', content: 'not mine', created_at: at(6) },
  ]
  const out = readCandidateInterview(rows, 'Priya')
  assert.equal(out.transcript.length, 2)
  assert.equal(out.videoUrl, 'https://v/1.webm')
  assert.equal(out.candidateQuestions[0].question, 'Remote?')
  assert.equal(out.durationMs, 3 * 60 * 1000)
  assert.equal(out.attemptCount, 1)
})

test('candidate names match case-insensitively, as legacy rows require', () => {
  // The transcript path and the video path historically disagreed on
  // casing, which used to unbind a candidate from their own recording.
  const rows = [
    { id: 1, candidate_name: 'priya', speaker: 'candidate', content: 'A', created_at: at(0) },
    { id: 2, candidate_name: 'Priya', speaker: 'video', content: '', video_url: 'https://v/2.webm', created_at: at(1) },
  ]
  const out = readCandidateInterview(rows, 'PRIYA')
  assert.equal(out.videoUrl, 'https://v/2.webm')
})

test('a candidate with no rows at all reads as empty, not as a crash', () => {
  const out = readCandidateInterview([], 'Nobody')
  assert.deepEqual(out.transcript, [])
  assert.equal(out.videoUrl, null)
  assert.equal(out.durationMs, null)
  assert.equal(out.attemptCount, 0)
})

/* ── Comparing two candidates ────────────────────────────────────────
 * The failure mode to guard against is a confident ranking built on a
 * rounding difference, or on two people who never answered the same
 * questions.
 */
import {
  requirementIndex, scoresByRequirement, compareCandidates, compareHeadline,
  sameStage, MEANINGFUL_GAP,
} from '../lib/compare.js'

const QUESTIONS = [
  { text: 'Tell me about owning an API test suite', covers: 'Owned automated API test suite', source: 'ai' },
  { text: 'Describe a flaky test you fixed',        covers: 'Diagnosed and resolved flaky tests', source: 'ai' },
  { text: 'What do you like about us?',             covers: null, source: 'custom' },
]

test('a question is tied back to its requirement even after punctuation drifts', () => {
  const idx = requirementIndex(QUESTIONS)
  // The scorer echoed the question back with different punctuation.
  assert.equal(
    idx.get('tell me about owning an api test suite'),
    'Owned automated API test suite',
  )
  // A recruiter's own question is labelled as theirs, not given a
  // requirement it never claimed.
  assert.equal(idx.get('what do you like about us'), 'Your own question')
})

test('two questions on one requirement average rather than last-wins', () => {
  const idx = new Map([['q one', 'Testing'], ['q two', 'Testing']])
  const out = scoresByRequirement(
    [{ question: 'q one', score: 8 }, { question: 'q two', score: 4 }],
    idx,
  )
  assert.equal(out.get('Testing').score, 6)
})

test('an unscored answer does not drag a requirement to zero', () => {
  const idx = new Map([['q one', 'Testing'], ['q two', 'Testing']])
  const out = scoresByRequirement(
    [{ question: 'q one', score: 8 }, { question: 'q two', score: null }],
    idx,
  )
  assert.equal(out.get('Testing').score, 8)
})

function pair(aMap, bMap) {
  return compareCandidates({ byRequirement: new Map(aMap) }, { byRequirement: new Map(bMap) })
}

test('a small difference is not called a win', () => {
  const r = pair([['Testing', { score: 7.0 }]], [['Testing', { score: 6.2 }]])
  assert.equal(r.rows[0].leader, null)
  assert.deepEqual(r.wins, { a: 0, b: 0 })
})

test('a difference at the threshold is called', () => {
  const r = pair([['Testing', { score: 8.0 }]], [['Testing', { score: 8.0 - MEANINGFUL_GAP }]])
  assert.equal(r.rows[0].leader, 'a')
  assert.deepEqual(r.wins, { a: 1, b: 0 })
})

test('the requirement they differ most on is listed first', () => {
  const r = pair(
    [['Level', { score: 7 }], ['Miles apart', { score: 9 }]],
    [['Level', { score: 7 }], ['Miles apart', { score: 3 }]],
  )
  assert.equal(r.rows[0].requirement, 'Miles apart')
})

test('a requirement only one of them was asked is kept and marked', () => {
  const r = pair([['Only A', { score: 8 }]], [['Only B', { score: 8 }]])
  const onlyA = r.rows.find((x) => x.requirement === 'Only A')
  assert.equal(onlyA.onlyOne, 'a')
  assert.equal(onlyA.leader, null)
  assert.deepEqual(r.wins, { a: 0, b: 0 })
})

test('level candidates get an honest headline, not a winner', () => {
  const r = pair([['Testing', { score: 7 }]], [['Testing', { score: 7 }]])
  const line = compareHeadline(r, 'Priya', 'Marcus')
  assert.match(line, /No meaningful gap/)
})

test('trading requirements is reported as different, not better', () => {
  const r = pair(
    [['A thing', { score: 9 }], ['B thing', { score: 3 }]],
    [['A thing', { score: 3 }], ['B thing', { score: 9 }]],
  )
  assert.deepEqual(r.wins, { a: 1, b: 1 })
  assert.match(compareHeadline(r, 'Priya', 'Marcus'), /different places/)
})

test('a clear lead is stated plainly', () => {
  const r = pair(
    [['A thing', { score: 9 }], ['B thing', { score: 9 }]],
    [['A thing', { score: 3 }], ['B thing', { score: 3 }]],
  )
  assert.match(compareHeadline(r, 'Priya', 'Marcus'), /^Priya is clearly ahead on 2 requirements/)
})

test('no shared requirements refuses to compare at all', () => {
  const r = pair([['Only A', { score: 8 }]], [['Only B', { score: 2 }]])
  assert.match(compareHeadline(r, 'Priya', 'Marcus'), /not asked about enough of the same things/)
})

test('candidates from different stages are not treated as like-for-like', () => {
  assert.equal(sameStage({ stageId: 61 }, { stageId: '61' }), true)
  assert.equal(sameStage({ stageId: 61 }, { stageId: 62 }), false)
  assert.equal(sameStage({ stageId: null }, { stageId: 61 }), false)
})

test('comparing two candidates with no scores at all does not throw', () => {
  const r = compareCandidates(null, undefined)
  assert.deepEqual(r.rows, [])
  assert.match(compareHeadline(r, 'A', 'B'), /not asked about enough/)
})

/* ── Reminders ───────────────────────────────────────────────────────
 * This is the only part of the product that emails a stranger without a
 * human pressing a button, so the tests are about restraint, not reach.
 */
import { reminderDecision, daysLeft, MAX_REMINDERS, REMINDER_DAYS } from '../lib/reminders.js'

const ACTIVE = { status: 'active', interview_response_sla_days: 5 }
const NOW = new Date('2026-09-09T12:00:00Z')
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()

const invite = (over = {}) => ({
  candidate_email: 'someone@example.com',
  token: 'tok-1',
  invited_at: daysAgo(3),
  reminder_count: 0,
  last_reminded_at: null,
  status: 'invited',
  ...over,
})

test('a candidate who already interviewed is never chased', () => {
  const d = reminderDecision(invite({ status: 'completed' }), ACTIVE, NOW)
  assert.equal(d.send, false)
  assert.equal(d.reason, 'already-interviewed')
})

test('nothing goes out before the first reminder day', () => {
  const d = reminderDecision(invite({ invited_at: daysAgo(REMINDER_DAYS[0] - 0.5) }), ACTIVE, NOW)
  assert.equal(d.send, false)
  assert.equal(d.reason, 'too-soon')
})

test('the first reminder goes out on time', () => {
  const d = reminderDecision(invite({ invited_at: daysAgo(REMINDER_DAYS[0]) }), ACTIVE, NOW)
  assert.equal(d.send, true)
  assert.equal(d.reason, 'first-reminder')
})

test('the second waits for its own day, not just the gap', () => {
  const early = reminderDecision(
    invite({ reminder_count: 1, invited_at: daysAgo(3), last_reminded_at: daysAgo(1) }),
    ACTIVE, NOW,
  )
  assert.equal(early.send, false)
  assert.equal(early.reason, 'too-soon')

  const due = reminderDecision(
    invite({ reminder_count: 1, invited_at: daysAgo(REMINDER_DAYS[1]), last_reminded_at: daysAgo(2) }),
    ACTIVE, NOW,
  )
  assert.equal(due.send, true)
  assert.equal(due.reason, 'final-reminder')
})

test('there is never a third reminder', () => {
  const d = reminderDecision(
    invite({ reminder_count: MAX_REMINDERS, invited_at: daysAgo(4), last_reminded_at: daysAgo(2) }),
    ACTIVE, NOW,
  )
  assert.equal(d.send, false)
  assert.equal(d.reason, 'limit-reached')
})

test('two reminders cannot land in the same day even if the schedule says so', () => {
  const d = reminderDecision(
    invite({ reminder_count: 1, invited_at: daysAgo(4), last_reminded_at: daysAgo(0.2) }),
    ACTIVE, NOW,
  )
  assert.equal(d.send, false)
  assert.equal(d.reason, 'reminded-recently')
})

test('once the recruiter own response window closes, we go quiet', () => {
  const d = reminderDecision(invite({ invited_at: daysAgo(9) }), ACTIVE, NOW)
  assert.equal(d.send, false)
  assert.equal(d.reason, 'window-closed')
})

test('a short window is respected rather than overrun', () => {
  const role = { status: 'active', interview_response_sla_days: 1 }
  const d = reminderDecision(invite({ invited_at: daysAgo(2) }), role, NOW)
  assert.equal(d.send, false)
  assert.equal(d.reason, 'window-closed')
})

test('a paused or archived role stops chasing its candidates', () => {
  for (const status of ['paused', 'archived']) {
    const d = reminderDecision(invite(), { status, interview_response_sla_days: 5 }, NOW)
    assert.equal(d.send, false, status)
    assert.equal(d.reason, 'role-not-active')
  }
})

test('an invite with no email or no link is skipped, not guessed at', () => {
  assert.equal(reminderDecision(invite({ candidate_email: null }), ACTIVE, NOW).reason, 'no-email')
  assert.equal(reminderDecision(invite({ token: null }), ACTIVE, NOW).reason, 'no-token')
})

test('a bad or future invite date never triggers a send', () => {
  assert.equal(reminderDecision(invite({ invited_at: null }), ACTIVE, NOW).send, false)
  assert.equal(reminderDecision(invite({ invited_at: 'not a date' }), ACTIVE, NOW).send, false)
  const future = new Date(NOW.getTime() + 86400000).toISOString()
  assert.equal(reminderDecision(invite({ invited_at: future }), ACTIVE, NOW).reason, 'invited-in-the-future')
})

test('the deadline quoted to the candidate counts down and then disappears', () => {
  assert.equal(daysLeft(invite({ invited_at: daysAgo(2) }), ACTIVE, NOW), 3)
  assert.equal(daysLeft(invite({ invited_at: daysAgo(6) }), ACTIVE, NOW), null)
})
