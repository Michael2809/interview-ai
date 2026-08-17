#!/usr/bin/env node
/**
 * Seed (or reset) the permanent Recrewt AI demo workspace.
 *
 * What this does, in order:
 *   1. Creates (or finds) one dedicated Supabase auth user — the demo
 *      account — using the service-role key. Never touches any other
 *      account.
 *   2. Wipes any previously-seeded data belonging to *that specific
 *      user_id* (and only that user_id — every delete is scoped by an
 *      id set fetched from that user's own rows first) so the script is
 *      safely re-runnable.
 *   3. Re-inserts settings, a complimentary paid subscription, usage,
 *      billing event history, roles/stages/questions, invites,
 *      transcripts, AI scores, recruiter notes, and inbox notifications
 *      from scripts/demo/fixtures.mjs.
 *
 * Every timestamp in the fixtures is expressed as "N days ago", so
 * re-running this script always makes the workspace look freshly
 * active — run it before recording a video or taking screenshots.
 *
 * Usage:
 *   node --env-file=.env.local scripts/demo/seed-demo.mjs
 *   (or: npm run demo:seed)
 *
 * Requires (in .env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY, DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD.
 * Never run this against anything but the intended Supabase project —
 * it uses the service-role key, which bypasses RLS.
 */

import { createClient } from '@supabase/supabase-js'
import {
  COMPANY, RECRUITER, ROLES, CANDIDATES, NOTES, SUBSCRIPTION_STORY,
  CONFIDENCE_COPY, bandForConfidence,
} from './fixtures.mjs'

// ── Env / client ──────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const DEMO_EMAIL = process.env.DEMO_ACCOUNT_EMAIL
const DEMO_PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD

for (const [name, val] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
  DEMO_ACCOUNT_EMAIL: DEMO_EMAIL,
  DEMO_ACCOUNT_PASSWORD: DEMO_PASSWORD,
})) {
  if (!val) {
    console.error(`Missing required env var: ${name}. Run with --env-file=.env.local`)
    process.exit(1)
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── Time helpers ──────────────────────────────────────────────
const DAY_MS = 86_400_000
function daysAgo(n) { return new Date(Date.now() - n * DAY_MS) }
function iso(n) { return daysAgo(n).toISOString() }

// ── Recommendation → status mapping (mirrors app/api/score-interview) ──
function statusFromArchetype(archetype) {
  if (archetype === 'strong-hire' || archetype === 'hire') return 'shortlisted'
  if (archetype === 'hold') return 'on-hold'
  return 'rejected'
}

const QUESTION_TIER_REASONING = {
  strong: ['Clear, specific answer with a concrete outcome.', 'Directly answered with real detail.', 'Confident, well-structured response.'],
  good: ['Solid answer, reasonably specific.', 'Answered directly with some supporting detail.'],
  weak: ['Answer was vague or lacked a concrete example.', 'Thin on specifics for this question.'],
  poor: ['Did not substantively answer the question.', 'Very little concrete content in the response.'],
}
function pick(arr, seed) { return arr[seed % arr.length] }

function tierFor(score) {
  if (score >= 8) return { label: 'Strong', key: 'strong' }
  if (score >= 6.5) return { label: 'Good', key: 'good' }
  if (score >= 4.5) return { label: 'Weak', key: 'weak' }
  return { label: 'Poor', key: 'poor' }
}

/** First ~90 chars of `text`, trimmed to a full word — always a true substring. */
function excerpt(text, maxLen = 95) {
  if (text.length <= maxLen) return text
  const slice = text.slice(0, maxLen)
  const lastSpace = slice.lastIndexOf(' ')
  return slice.slice(0, lastSpace > 40 ? lastSpace : maxLen)
}

function buildQuestionReviews(candidate, questions) {
  const baseScore = candidate.score.score
  const jitter = [-0.4, 0.3, -0.2, 0.5]
  return questions.map((question, i) => {
    const qScore = Math.max(0, Math.min(10, Number((baseScore + jitter[i % jitter.length]).toFixed(1))))
    const tier = tierFor(qScore)
    const answer = candidate.answers[i] || ''
    return {
      question,
      score: qScore,
      recommendation: tier.label,
      reasoning: pick(QUESTION_TIER_REASONING[tier.key], i + candidate.name.length),
      evidence_quote: excerpt(answer) || null,
    }
  })
}

// ── Sanity check: every hand-written evidence line must be a literal
// substring of the answer it's quoting. Catches typos before they hit
// the database and look wrong in a screenshot.
function verifyEvidenceQuotes() {
  let problems = []
  for (const c of CANDIDATES) {
    if (c.archetype === 'ongoing') continue
    const allText = (c.answers || []).join(' \n ')
    const checks = [
      ...(c.score.strengths || []).map((s) => s.evidence),
      ...(c.score.concerns || []).map((s) => s.evidence),
    ]
    for (const quote of checks) {
      if (!allText.includes(quote)) {
        problems.push(`${c.name}: evidence quote not found verbatim in answers: "${quote}"`)
      }
    }
  }
  if (problems.length) {
    console.error('Evidence-quote consistency check failed:\n' + problems.join('\n'))
    process.exit(1)
  }
}

// ── 1. Demo auth user ────────────────────────────────────────
async function ensureDemoUser() {
  const metadata = { first_name: RECRUITER.firstName, full_name: RECRUITER.fullName }

  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  })
  if (!createErr && created?.user) {
    console.log(`Created demo auth user ${DEMO_EMAIL}`)
    return created.user.id
  }

  // Already exists — find it and keep it in sync.
  let found = null
  let page = 1
  while (!found) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    found = (data?.users || []).find((u) => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase())
    if (found || !data?.users?.length || data.users.length < 1000) break
    page += 1
  }
  if (!found) {
    console.error('Could not create or find the demo user:', createErr?.message)
    process.exit(1)
  }
  await supabase.auth.admin.updateUserById(found.id, {
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  })
  console.log(`Found existing demo auth user ${DEMO_EMAIL}`)
  return found.id
}

// ── 2. Wipe previously-seeded data (scoped strictly to this user_id) ──
async function wipeDemoData(userId) {
  const { data: roles } = await supabase.from('roles').select('id').eq('user_id', userId)
  const roleIds = (roles || []).map((r) => r.id)

  let stageIds = []
  if (roleIds.length) {
    const { data: stages } = await supabase.from('stages').select('id').in('role_id', roleIds)
    stageIds = (stages || []).map((s) => s.id)
  }

  if (stageIds.length) {
    await supabase.from('recruiter_notes').delete().in('stage_id', stageIds)
    await supabase.from('scores').delete().in('stage_id', stageIds)
    await supabase.from('interviews').delete().in('stage_id', stageIds)
    await supabase.from('questions').delete().in('stage_id', stageIds)
    await supabase.from('stages').delete().in('id', stageIds)
  }
  if (roleIds.length) {
    await supabase.from('roles').delete().in('id', roleIds)
  }
  await supabase.from('notifications').delete().eq('user_id', userId)
  await supabase.from('subscription_events').delete().eq('user_id', userId)
  await supabase.from('candidate_packs').delete().eq('user_id', userId)
  // Deleted (not upserted) — a DB trigger on subscriptions restricts which
  // columns a service-role UPDATE may touch, but a fresh INSERT is clean.
  await supabase.from('subscriptions').delete().eq('user_id', userId)
  await supabase.from('workspace_usage').delete().eq('user_id', userId)
  console.log(`Wiped prior demo data (${roleIds.length} roles, ${stageIds.length} stages).`)
}

// ── 3. Settings ───────────────────────────────────────────────
async function seedSettings(userId) {
  const { error } = await supabase.from('settings').upsert({
    user_id: userId,
    email: DEMO_EMAIL,
    full_name: RECRUITER.fullName,
    company_name: COMPANY.name,
    company_website: COMPANY.website,
    notify_on_completion: true,
    onboarding_completed: true,
  }, { onConflict: 'user_id' })
  if (error) throw error
}

// ── 4. Billing — complimentary paid plan, usage, event history ──
async function seedBilling(userId) {
  const { data: plans, error: plansErr } = await supabase
    .from('plans').select('*').eq('is_active', true)
  if (plansErr) throw plansErr

  let plan = null
  for (const key of SUBSCRIPTION_STORY.preferredPlanKeys) {
    plan = (plans || []).find((p) => p.key === key)
    if (plan) break
  }
  if (!plan) plan = (plans || [])[0]
  if (!plan) {
    console.warn('No rows in `plans` — skipping billing seed. Premium features may not unlock.')
    return
  }

  const periodStart = iso(SUBSCRIPTION_STORY.renewalCycleDays)
  const periodEnd = iso(-1 * (SUBSCRIPTION_STORY.renewalCycleDays - 1)) // ~29 days in the future

  const { error: subErr } = await supabase.from('subscriptions').insert({
    user_id: userId,
    plan_key: plan.key,
    status: 'active',
    complimentary: true, // never expires, never gates a demo mid-recording
    current_period_start: periodStart,
    current_period_end: periodEnd,
    trial_ends_at: null,
    payment_provider: 'manual',
    cancel_at_period_end: false,
    provider_customer_id: null,
    provider_subscription_id: null,
  })
  if (subErr) throw subErr

  const recentInvites = CANDIDATES.filter((c) => c.invitedDaysAgo <= SUBSCRIPTION_STORY.renewalCycleDays).length
  const { error: usageErr } = await supabase.from('workspace_usage').insert({
    user_id: userId,
    period_start: periodStart,
    period_end: periodEnd,
    candidates_used: recentInvites,
  })
  if (usageErr) throw usageErr

  const events = [
    { kind: 'trial_started', metadata: { plan: 'trial' }, from_plan: null, to_plan: 'trial', created_at: iso(SUBSCRIPTION_STORY.trialStartedDaysAgo) },
    { kind: 'plan_changed', metadata: { to_plan: plan.key, payment_provider: 'manual' }, from_plan: 'trial', to_plan: plan.key, created_at: iso(SUBSCRIPTION_STORY.upgradedDaysAgo) },
  ]
  let cursor = SUBSCRIPTION_STORY.upgradedDaysAgo - SUBSCRIPTION_STORY.renewalCycleDays
  while (cursor > 0) {
    events.push({ kind: 'renewed', metadata: { payment_provider: 'manual' }, from_plan: plan.key, to_plan: plan.key, created_at: iso(cursor) })
    cursor -= SUBSCRIPTION_STORY.renewalCycleDays
  }
  for (const e of events) {
    await supabase.from('subscription_events').insert({ user_id: userId, ...e })
  }
  console.log(`Billing: plan "${plan.key}", complimentary, ${events.length} lifecycle events.`)
}

// ── 5. Roles → stages → questions ────────────────────────────
async function seedRolesTree(userId) {
  const roleIds = {}       // slug -> role id
  const stageIds = {}      // slug -> stage id
  const questionRows = {}  // slug -> [{id, text}] in fixture order

  for (const role of ROLES) {
    const { data: roleRow, error: roleErr } = await supabase.from('roles').insert({
      title: role.title,
      department: role.department,
      status: role.status,
      user_id: userId,
      created_at: iso(role.createdDaysAgo),
    }).select().single()
    if (roleErr) throw roleErr
    roleIds[role.slug] = roleRow.id

    const { data: stageRow, error: stageErr } = await supabase.from('stages').insert({
      role_id: roleRow.id,
      name: 'Screening',
      level: role.level,
      position: 1,
    }).select().single()
    if (stageErr) throw stageErr
    stageIds[role.slug] = stageRow.id

    const inserted = []
    for (const text of role.questions) {
      const { data: qRow, error: qErr } = await supabase.from('questions').insert({
        stage_id: stageRow.id,
        text,
        approved: true,
      }).select().single()
      if (qErr) throw qErr
      inserted.push(qRow)
    }
    questionRows[role.slug] = inserted
  }

  console.log(`Seeded ${ROLES.length} roles with stages + questions.`)
  return { roleIds, stageIds, questionRows }
}

// ── 6. Candidates: invite + transcript + score ───────────────
async function seedCandidate(candidate, stageId, roleTitle, questions) {
  const events = [] // notification events to emit: {kind, title, body, href, createdAt}

  // Invite row — every candidate has one.
  await supabase.from('interviews').insert({
    stage_id: stageId,
    speaker: 'invite',
    content: 'Candidate invited',
    candidate_email: candidate.email,
    token: crypto.randomUUID(),
    status: 'invited',
    invited_at: iso(candidate.invitedDaysAgo),
    created_at: iso(candidate.invitedDaysAgo),
  })

  if (candidate.archetype === 'ongoing') {
    return events // no transcript, no score — still mid-funnel
  }

  // Session timing — work backward from completion to a plausible
  // interview start ~7-9 minutes earlier, spacing question/answer pairs.
  const completedAt = daysAgo(candidate.completedDaysAgo)
  const sessionLenMs = 8 * 60_000
  const start = new Date(completedAt.getTime() - sessionLenMs)

  const { data: sessionRow } = await supabase.from('interviews').insert({
    stage_id: stageId, speaker: 'session_start', content: 'in_progress',
    candidate_name: candidate.name, status: 'in_progress',
    created_at: new Date(start.getTime() - 5_000).toISOString(),
  }).select().single()

  let t = start.getTime()
  const perTurnMs = Math.floor(sessionLenMs / (questions.length * 2))
  for (let i = 0; i < questions.length; i++) {
    await supabase.from('interviews').insert({
      stage_id: stageId, speaker: 'interviewer', content: questions[i],
      candidate_name: candidate.name, created_at: new Date(t).toISOString(),
    })
    t += perTurnMs
    await supabase.from('interviews').insert({
      stage_id: stageId, speaker: 'candidate', content: candidate.answers[i],
      candidate_name: candidate.name, created_at: new Date(t).toISOString(),
    })
    t += perTurnMs
  }

  if (sessionRow) {
    await supabase.from('interviews').update({
      status: 'completed', completed_at: completedAt.toISOString(),
    }).eq('id', sessionRow.id)
  }

  // Score
  const recommendation = candidate.archetype
  const status = candidate.pending ? null : (candidate.statusOverride || statusFromArchetype(candidate.archetype))
  const confidence = candidate.score.confidence
  const band = bandForConfidence(confidence)
  const questionReviews = buildQuestionReviews(candidate, questions)

  const scoreCreatedAt = new Date(completedAt.getTime() + 90_000).toISOString() // auto-scored ~90s after finishing

  const { error: scoreErr } = await supabase.from('scores').upsert({
    stage_id: stageId,
    candidate_name: candidate.name,
    score: candidate.score.score,
    summary: candidate.score.summary,
    status,
    recommendation,
    confidence,
    confidence_copy: CONFIDENCE_COPY[band],
    confidence_reasons: candidate.score.confidence_reasons,
    strengths: candidate.score.strengths,
    concerns: candidate.score.concerns,
    question_reviews: questionReviews,
    created_at: scoreCreatedAt,
  }, { onConflict: 'stage_id,candidate_name' })
  if (scoreErr) throw scoreErr

  events.push({
    kind: 'interview_completed',
    title: `${candidate.name} completed their interview`,
    body: `${roleTitle} — Screening`,
    href: `/interview/${stageId}/transcript`,
    createdAt: completedAt,
  })
  events.push({
    kind: 'scoring_completed',
    title: `AI scoring ready for ${candidate.name}`,
    body: `Scored ${candidate.score.score.toFixed(1)}/10 — ${recommendation.replace('-', ' ')}`,
    href: `/interview/${stageId}/transcript`,
    createdAt: new Date(scoreCreatedAt),
  })
  return events
}

// ── 7. Recruiter notes ───────────────────────────────────────
async function seedNotes(userId, stageIdByCandidate, questionRowsBySlug, roleSlugByCandidate) {
  let count = 0
  for (const note of NOTES) {
    const slug = roleSlugByCandidate[note.candidate]
    const stageId = stageIdByCandidate[note.candidate]
    if (!stageId) continue
    let questionId = null
    if (note.questionIndex != null) {
      const qRow = questionRowsBySlug[slug]?.[note.questionIndex]
      questionId = qRow?.id ?? null
    }
    const { error } = await supabase.from('recruiter_notes').insert({
      stage_id: stageId,
      user_id: userId,
      candidate_name: note.candidate,
      question_id: questionId,
      body: note.body,
      updated_at: iso(note.ageDaysAgo),
    })
    if (error) throw error
    count += 1
  }
  console.log(`Seeded ${count} recruiter notes.`)
}

// ── 8. Notifications ──────────────────────────────────────────
//
// A DB trigger auto-inserts its own notification row whenever an
// `interviews` row is marked completed or a `scores` row is upserted
// (confirmed empirically — no INSERT into `notifications` exists
// anywhere in the app codebase, yet rows appear). Those trigger-made
// rows are dated "now" (whenever this script runs) with the trigger's
// own wording, which would bunch 48 notifications on today's date and
// duplicate the realistic, historically-dated ones below. So: wipe
// *all* notifications for this user (trigger-made + leftover) right
// before writing the curated, properly-dated set, rather than trying
// to insert alongside whatever the trigger already produced.
async function seedNotifications(userId, allEvents) {
  const { error: delErr } = await supabase.from('notifications').delete().eq('user_id', userId)
  if (delErr) throw delErr

  // Sort oldest first, mark anything older than 2 days as already read.
  const sorted = [...allEvents].sort((a, b) => a.createdAt - b.createdAt)
  const now = Date.now()
  let count = 0
  for (const e of sorted) {
    const createdAt = e.createdAt.toISOString()
    const isOld = now - e.createdAt.getTime() > 2 * DAY_MS
    const { error } = await supabase.from('notifications').insert({
      user_id: userId,
      kind: e.kind,
      title: e.title,
      body: e.body,
      href: e.href,
      created_at: createdAt,
      read_at: isOld ? new Date(e.createdAt.getTime() + 3 * 60_000).toISOString() : null,
    })
    if (error) throw error
    count += 1
  }
  console.log(`Seeded ${count} notifications.`)
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding demo workspace "${COMPANY.name}" for ${DEMO_EMAIL} ...`)
  verifyEvidenceQuotes()

  const userId = await ensureDemoUser()
  await wipeDemoData(userId)
  await seedSettings(userId)
  await seedBilling(userId)
  const { stageIds, questionRows } = await seedRolesTree(userId)

  const roleBySlug = Object.fromEntries(ROLES.map((r) => [r.slug, r]))
  const stageIdByCandidate = {}
  const roleSlugByCandidate = {}
  const notificationEvents = []

  for (const candidate of CANDIDATES) {
    const role = roleBySlug[candidate.role]
    const stageId = stageIds[candidate.role]
    const questions = role.questions
    stageIdByCandidate[candidate.name] = stageId
    roleSlugByCandidate[candidate.name] = candidate.role
    const events = await seedCandidate(candidate, stageId, role.title, questions)
    notificationEvents.push(...events)
  }
  console.log(`Seeded ${CANDIDATES.length} candidates across ${ROLES.length} roles.`)

  await seedNotes(userId, stageIdByCandidate, questionRows, roleSlugByCandidate)
  await seedNotifications(userId, notificationEvents)

  console.log('\nDone. Log in with:')
  console.log(`  email:    ${DEMO_EMAIL}`)
  console.log(`  password: (see DEMO_ACCOUNT_PASSWORD in .env.local)`)
  console.log('\nRe-run this script any time before a demo to refresh "recent activity" timestamps.')
}

main().catch((err) => {
  console.error('\nSeed failed:', err)
  process.exit(1)
})
