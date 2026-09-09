import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { canCreateRole } from '@/lib/subscription'

/**
 * Create a role, and actually check the plan allows it.
 *
 * Roles used to be inserted straight from the browser. The only thing
 * standing between a trial account and a thousand roles was a disabled
 * button, which is no obstacle at all to anyone who opens devtools — and
 * the onboarding flow created one with no check whatsoever.
 *
 * `canCreateRole` already existed and was already correct. It had simply
 * never been called anywhere a role was actually created.
 *
 * The limit is also allowed to FAIL CLOSED here. On the client it failed
 * open: an entitlements error left the limit undefined, undefined was
 * treated as unlimited, and the cap disappeared from the UI along with
 * it. A server that cannot determine the plan refuses rather than
 * guesses in the customer's favour forever.
 */

/** Only these are accepted from the client; anything else is ignored. */
const ALLOWED = new Set([
  'title', 'description', 'department', 'employment_type', 'experience_level',
  'jd_text', 'must_haves', 'nice_to_haves', 'salary_range', 'salary_visibility',
  'intake_confirmed_at', 'flexible_criteria', 'great_vs_okay', 'calibrated_at',
])

export async function POST(request) {
  const authed = await createClient()
  const { data: { user }, error: authErr } = await authed.auth.getUser()
  if (authErr || !user) {
    return Response.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let body
  try { body = await request.json() } catch { body = {} }

  const title = String(body?.title || '').trim()
  if (!title) {
    return Response.json({ error: 'A role needs a title.' }, { status: 400 })
  }

  const svc = createServiceClient()

  // ── Does the plan allow another role ─────────────────────────────
  let gate
  try {
    gate = await canCreateRole(svc, user.id)
  } catch (err) {
    console.error('create-role: entitlement check failed:', err)
    return Response.json({
      error: 'We could not check your plan just now. Please try again in a moment.',
    }, { status: 503 })
  }

  if (!gate.allowed) {
    const msg = gate.reason === 'plan_limit'
      ? `You have ${gate.current} of ${gate.limit} active roles on your plan. Archive one, or upgrade to add more.`
      : gate.reason === 'trial_expired'
        ? 'Your subscription is no longer active. Please review your plan to continue.'
        : 'Creating roles is not available on your current plan.'
    return Response.json({ error: msg, reason: gate.reason }, { status: 403 })
  }

  // ── Create it ────────────────────────────────────────────────────
  const row = { user_id: user.id, title }
  for (const key of Object.keys(body || {})) {
    if (ALLOWED.has(key) && key !== 'title') row[key] = body[key]
  }

  const { data: created, error: insertErr } = await svc
    .from('roles').insert(row).select('id').single()

  if (insertErr || !created) {
    console.error('create-role: insert failed:', insertErr)
    return Response.json({ error: 'Could not create the role.' }, { status: 500 })
  }

  return Response.json({ id: created.id })
}
