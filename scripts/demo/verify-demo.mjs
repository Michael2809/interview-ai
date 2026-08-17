#!/usr/bin/env node
/**
 * Read-only consistency audit for the seeded demo workspace.
 *
 * Makes zero writes. Fetches everything back out of Supabase (scoped to
 * the demo account's own user_id) and checks it against the same rules
 * the app itself uses, plus the fixtures' own claims:
 *
 *   1. Dashboard metrics — recomputes the app's own dashboard aggregation
 *      logic (app/dashboard/page.js loadData) against the raw rows and
 *      reports the numbers it would render.
 *   2. Per-role pipeline distribution — invited/completed/waiting per role.
 *   3. Every score's evidence quotes are literal substrings of that
 *      candidate's actual stored transcript (not the fixture file — the
 *      real DB rows, post-insert).
 *   4. Every score/recommendation/status combination is internally
 *      consistent with the app's own banding rules.
 *   5. Billing/usage counters.
 *
 * Usage: node --env-file=.env.local scripts/demo/verify-demo.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { CANDIDATES } from './fixtures.mjs'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEMO_EMAIL = process.env.DEMO_ACCOUNT_EMAIL

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const problems = []
const info = []
function fail(msg) { problems.push(msg) }
function note(msg) { info.push(msg) }

// ── App's own banding rules (app/api/score-interview/route.js) ──
function expectedRecommendation(score) {
  if (score >= 8.5) return 'strong-hire'
  if (score >= 6.5) return 'hire'
  if (score >= 4.5) return 'hold'
  return 'reject'
}
function plausibleStatuses(recommendation) {
  // status may equal the "natural" mapping, be overridden to 'rejected'
  // (role filled by someone else), or be null (pending recruiter review).
  const natural = recommendation === 'strong-hire' || recommendation === 'hire'
    ? 'shortlisted' : recommendation === 'hold' ? 'on-hold' : 'rejected'
  return [natural, 'rejected', null]
}

async function main() {
  const { data: userList } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const user = (userList?.users || []).find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase())
  if (!user) { console.error('Demo user not found — run npm run demo:seed first.'); process.exit(1) }
  const userId = user.id

  const [{ data: roles }, { data: settings }, { data: subscription }, { data: usage }] = await Promise.all([
    supabase.from('roles').select('*').eq('user_id', userId),
    supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('subscriptions').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('workspace_usage').select('*').eq('user_id', userId).maybeSingle(),
  ])

  const roleIds = roles.map((r) => r.id)
  const { data: stages } = await supabase.from('stages').select('*').in('role_id', roleIds)
  const stageIds = stages.map((s) => s.id)
  const { data: interviews } = await supabase.from('interviews').select('*').in('stage_id', stageIds)
  const { data: scores } = await supabase.from('scores').select('*').in('stage_id', stageIds)
  const { data: notes } = await supabase.from('recruiter_notes').select('*').in('stage_id', stageIds)
  const { data: notifications } = await supabase.from('notifications').select('*').eq('user_id', userId)

  const stageRole = {}
  stages.forEach((s) => { stageRole[s.id] = s.role_id })
  const roleById = {}
  roles.forEach((r) => { roleById[r.id] = r })

  /* ══════════════════════ 1. Dashboard metrics ══════════════════════ */
  // Mirrors app/dashboard/page.js loadData() exactly.
  const invites = interviews.filter((r) => r.speaker === 'invite')
  const transcripts = interviews.filter((r) => r.speaker !== 'invite' && r.candidate_name)

  const inviteMap = {}
  invites.forEach((r) => {
    if (!r.candidate_email) return
    const key = r.candidate_email.toLowerCase()
    if (!inviteMap[key] || new Date(r.invited_at || 0) > new Date(inviteMap[key].invited_at || 0)) {
      inviteMap[key] = { email: r.candidate_email, invited_at: r.invited_at }
    }
  })
  const invitedArr = Object.values(inviteMap)

  // NOTE: scores.stage_id is a TEXT column while interviews/stages.id are
  // integers (the app itself works around this with explicit String()
  // casts in a few places — see transcript/page.js). Normalize to string
  // on both sides so this audit compares like with like.
  const compMap = {}
  transcripts.forEach((r) => {
    const key = `${r.stage_id}|${r.candidate_name}`
    if (!compMap[key]) {
      const scoreRow = scores.find((s) => s.candidate_name === r.candidate_name && String(s.stage_id) === String(r.stage_id))
      compMap[key] = { name: r.candidate_name, score: scoreRow?.score ?? null, status: scoreRow?.status ?? null }
    }
  })
  const completedArr = Object.values(compMap)
  const waitingArr = completedArr.filter((c) => !c.status || c.status === 'null' || c.status === '')

  // The app's own "ongoing" calc (dashboard/page.js) compares invited
  // candidate_email against a set of completed candidate_name — those are
  // different fields for the same candidate, so that comparison never
  // matches in production either way. That's a pre-existing app-level
  // quirk, not a seed-data problem — see the report below. For a
  // meaningful ongoing/mid-funnel check here, use ground truth from the
  // fixtures instead (which candidates were designed with no transcript).
  const expectedOngoingNames = new Set(CANDIDATES.filter((c) => c.archetype === 'ongoing').map((c) => c.name))
  const completedCandidateNames = new Set(transcripts.map((r) => r.candidate_name).filter(Boolean))
  for (const name of expectedOngoingNames) {
    if (completedCandidateNames.has(name)) fail(`${name} was designed as "ongoing" (invite-only) but has transcript rows.`)
  }
  for (const c of CANDIDATES) {
    if (c.archetype !== 'ongoing' && !completedCandidateNames.has(c.name)) {
      fail(`${c.name} was designed with a transcript but has no transcript rows in the DB.`)
    }
  }
  note(`Ground truth: ${expectedOngoingNames.size} candidates correctly invite-only (no transcript), ${completedCandidateNames.size} correctly have a completed transcript.`)
  note(`app/dashboard/page.js's own "ongoing" metric compares invited candidate_email against completed candidate_name — those never match the same person, so in production that specific widget always reads ≈ full invited count regardless of real completion. Pre-existing app behavior, unrelated to this seed — flagged for awareness, not fixed here (out of scope).`)

  note(`Dashboard would show: ${invitedArr.length} invited, ${completedArr.length} completed, ${waitingArr.length} waiting on you (Priority Queue).`)
  if (completedArr.length !== 24) fail(`Expected 24 completed candidates, dashboard logic finds ${completedArr.length}.`)
  if (invitedArr.length !== 30) fail(`Expected 30 unique invited candidates, dashboard logic finds ${invitedArr.length}.`)
  if (waitingArr.length < 1) fail('Expected at least one candidate pending recruiter review (Priority Queue would be empty).')
  if (waitingArr.length !== 3) fail(`Expected exactly 3 candidates pending review (score set, status null) per design, found ${waitingArr.length}.`)
  const avgScore = completedArr.reduce((s, c) => s + (c.score || 0), 0) / (completedArr.filter(c=>c.score!=null).length || 1)
  note(`Average score across completed candidates: ${avgScore.toFixed(2)}/10.`)

  /* ══════════════════════ 2. Per-role pipeline ══════════════════════ */
  for (const role of roles) {
    const roleStageIds = stages.filter((s) => s.role_id === role.id).map((s) => s.id)
    const roleInvites = invites.filter((r) => roleStageIds.includes(r.stage_id))
    const roleCompleted = transcripts.filter((r) => roleStageIds.includes(r.stage_id))
    const uniqueCompleted = new Set(roleCompleted.map((r) => r.candidate_name))
    const uniqueInvited = new Set(roleInvites.map((r) => r.candidate_email?.toLowerCase()))
    if (uniqueInvited.size === 0) fail(`Role "${role.title}" has zero invited candidates.`)
    note(`${role.title} [${role.status}]: ${uniqueInvited.size} invited, ${uniqueCompleted.size} completed.`)
    if (role.status === 'archived' && uniqueInvited.size !== uniqueCompleted.size) {
      fail(`Role "${role.title}" is archived (filled) but has ${uniqueInvited.size - uniqueCompleted.size} candidate(s) still mid-funnel — inconsistent with a closed role.`)
    }
  }
  const statusesPresent = new Set(roles.map((r) => r.status))
  for (const s of ['active', 'paused', 'archived']) {
    if (!statusesPresent.has(s)) fail(`No role with status "${s}" — Roles page won't show lifecycle variety.`)
  }

  /* ══════════════════ 3. Evaluations match transcripts ══════════════ */
  for (const score of scores) {
    const myTranscript = interviews
      .filter((r) => String(r.stage_id) === String(score.stage_id) && r.candidate_name === score.candidate_name && r.speaker === 'candidate')
      .map((r) => r.content).join(' \n ')
    if (!myTranscript) {
      fail(`Score exists for ${score.candidate_name} (stage ${score.stage_id}) but no candidate transcript rows found.`)
      continue
    }
    const quotes = [
      ...(score.strengths || []).map((s) => s.evidence),
      ...(score.concerns || []).map((s) => s.evidence),
      ...(score.question_reviews || []).map((q) => q.evidence_quote).filter(Boolean),
    ]
    for (const q of quotes) {
      if (!myTranscript.includes(q)) {
        fail(`${score.candidate_name}: evidence quote not found in stored transcript: "${q.slice(0, 60)}..."`)
      }
    }
  }
  note(`Checked evidence quotes for ${scores.length} scores against stored transcripts.`)

  /* ══════════════════ 4. Score/recommendation/status bands ══════════ */
  for (const score of scores) {
    const expectedRec = expectedRecommendation(score.score)
    if (score.recommendation !== expectedRec) {
      fail(`${score.candidate_name}: score ${score.score} implies recommendation "${expectedRec}" but stored recommendation is "${score.recommendation}".`)
    }
    const ok = plausibleStatuses(score.recommendation).includes(score.status)
    if (!ok) {
      fail(`${score.candidate_name}: status "${score.status}" is not a plausible outcome for recommendation "${score.recommendation}".`)
    }
    if (score.confidence < 0 || score.confidence > 100) fail(`${score.candidate_name}: confidence ${score.confidence} out of range.`)
    if (!score.summary || score.summary.length < 10) fail(`${score.candidate_name}: missing/too-short summary.`)
    if (!Array.isArray(score.question_reviews) || score.question_reviews.length !== 4) {
      fail(`${score.candidate_name}: expected 4 question_reviews, found ${score.question_reviews?.length}.`)
    }
  }
  note(`Checked score→recommendation→status banding for ${scores.length} scores.`)

  /* ══════════════════════ 5. Billing / usage ═════════════════════════ */
  if (!subscription) fail('No subscription row for demo user.')
  else {
    if (subscription.status !== 'active') fail(`Subscription status is "${subscription.status}", expected "active".`)
    if (!subscription.complimentary) fail('Subscription is not marked complimentary — could show paywalls/expiry mid-demo.')
    if (new Date(subscription.current_period_end) < new Date()) fail('Subscription current_period_end is in the past.')
  }
  if (!usage) fail('No workspace_usage row for demo user.')
  else {
    const { data: plans } = await supabase.from('plans').select('*').eq('key', subscription?.plan_key).maybeSingle()
    if (plans && typeof plans.candidate_limit === 'number' && usage.candidates_used > plans.candidate_limit) {
      fail(`workspace_usage.candidates_used (${usage.candidates_used}) exceeds plan candidate_limit (${plans.candidate_limit}) — would show over-limit even though complimentary.`)
    }
    note(`Usage: ${usage.candidates_used} candidates used this cycle on plan "${subscription?.plan_key}".`)
  }
  if (!settings) fail('No settings row for demo user.')
  else if (!settings.onboarding_completed) fail('settings.onboarding_completed is false — app would redirect to /onboarding instead of showing the dashboard.')

  note(`Recruiter notes: ${notes.length}. Notifications: ${notifications.length} (${notifications.filter(n=>!n.read_at).length} unread).`)
  if (notifications.length !== 48) fail(`Expected exactly 48 notifications (24 completed candidates × 2 events), found ${notifications.length} — check for trigger-generated duplicates.`)

  /* ══════════════════════════ Report ═══════════════════════════════ */
  console.log('\n─── Demo workspace consistency audit ───\n')
  info.forEach((i) => console.log('  •', i))
  console.log('')
  if (problems.length === 0) {
    console.log(`✅ No mismatches found across ${scores.length} scores, ${roles.length} roles, ${interviews.length} interview rows.`)
  } else {
    console.log(`❌ ${problems.length} mismatch(es) found:\n`)
    problems.forEach((p, i) => console.log(`  ${i + 1}. ${p}`))
    process.exitCode = 1
  }
}

main().catch((err) => { console.error('Audit failed to run:', err); process.exit(1) })
