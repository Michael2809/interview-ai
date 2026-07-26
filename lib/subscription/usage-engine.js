/**
 * Usage Engine
 *
 * Computes current-cycle usage and remaining allowances.
 * Only candidate usage resets each cycle; role/seat counts are
 * derived live from base tables so downgrades take effect immediately.
 */

import { getCurrentPlan } from './subscription-service'
import { isUnlimited } from './plans'
import { SubscriptionError, SUBSCRIPTION_ERROR_CODES, mapDbError } from './errors'

/** Clamp non-negative counter — defensive against corrupt rows. */
function clampNonNegative(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v < 0) return 0
  return Math.trunc(v)
}

/** Convenience: single object that describes everything a UI needs. */
export async function getUsageSummary(supabase, userId) {
  const { subscription, plan } = await getCurrentPlan(supabase, userId)
  const [usage, packs, roles, seats] = await Promise.all([
    getWorkspaceUsage(supabase, userId, subscription),
    getActivePacks(supabase, userId),
    getActiveRolesCount(supabase, userId),
    getSeatsCount(supabase, userId),
  ])

  const packCandidates = clampNonNegative(
    packs.reduce((sum, p) => sum + clampNonNegative(p.quantity) - clampNonNegative(p.credits_used), 0)
  )
  const planCandidates = plan?.candidate_limit ?? null
  const candidatesUsed = clampNonNegative(usage.candidates_used)
  const included = isUnlimited(planCandidates) ? Infinity : planCandidates + packCandidates
  const remaining = included === Infinity ? Infinity : Math.max(0, included - candidatesUsed)

  return {
    plan,
    subscription,
    period: { start: new Date(usage.period_start), end: new Date(usage.period_end) },
    candidates: {
      used: candidatesUsed,
      planLimit: planCandidates,
      packCredits: packCandidates,
      totalIncluded: included === Infinity ? null : included,
      remaining: remaining === Infinity ? null : remaining,
    },
    roles: {
      used: clampNonNegative(roles),
      limit: plan?.role_limit ?? null,
      remaining: isUnlimited(plan?.role_limit) ? null : Math.max(0, plan.role_limit - clampNonNegative(roles)),
    },
    seats: {
      used: clampNonNegative(seats),
      limit: plan?.seat_limit ?? null,
      remaining: isUnlimited(plan?.seat_limit) ? null : Math.max(0, plan.seat_limit - clampNonNegative(seats)),
    },
    packs,
  }
}

/**
 * Fetch the current-cycle usage row. Auto-creates if missing, and
 * race-safe: on a 23505 conflict from a concurrent bootstrap, we
 * re-read the winning row instead of throwing.
 */
export async function getWorkspaceUsage(supabase, userId, subscription) {
  const { data, error } = await supabase
    .from('workspace_usage')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw mapDbError(error, 'Failed to load usage')
  if (data) return data

  const start = subscription?.current_period_start || new Date().toISOString()
  const end = subscription?.current_period_end || new Date(Date.now() + 30 * 86_400_000).toISOString()
  const { data: inserted, error: insertErr } = await supabase
    .from('workspace_usage')
    .insert({ user_id: userId, period_start: start, period_end: end, candidates_used: 0 })
    .select()
    .single()

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Concurrent bootstrap won the race.
      const { data: winner } = await supabase
        .from('workspace_usage')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()
      if (winner) return winner
    }
    throw mapDbError(insertErr, 'Failed to create usage row')
  }
  return inserted
}

/**
 * Live count of open roles for a workspace. Uses the `roles` table.
 * "Active" excludes archived + paused (matches roles.status semantics
 * introduced in the v2 Roles page).
 */
export async function getActiveRolesCount(supabase, userId) {
  const { count, error } = await supabase
    .from('roles')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .in('status', ['active'])
  if (error) {
    // Fallback for pre-migration workspaces without the status column
    const { count: fallback } = await supabase
      .from('roles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
    return fallback || 0
  }
  return count || 0
}

/**
 * Team seats. There is no seats table yet — a workspace always has
 * exactly one seat (the owner). This function is the single seam the
 * team-members feature will plug into later.
 */
export async function getSeatsCount(_supabase, _userId) {
  return 1
}

/**
 * Fetch active candidate packs for a workspace. Packs are lazily
 * expired here — any pack whose `expires_at` has passed is marked
 * as expired so it stops contributing to allowances.
 */
export async function getActivePacks(supabase, userId) {
  const nowIso = new Date().toISOString()
  await supabase
    .from('candidate_packs')
    .update({ status: 'expired' })
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('expires_at', nowIso)

  const { data, error } = await supabase
    .from('candidate_packs')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .gt('expires_at', nowIso)
    .order('purchased_at', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * Record a candidate invite.
 *
 * Delegates to the `record_candidate_invite` Postgres RPC which
 * performs the whole check + increment + pack drawdown transactionally
 * with row-level locking on workspace_usage and every consumed pack.
 * This closes the read-modify-write race that existed when this logic
 * was implemented client-side.
 *
 * Returns the same shape the previous JS implementation did — a fresh
 * usage summary — so callers don't need to change.
 *
 * @throws SubscriptionError CANDIDATE_LIMIT_REACHED if the invite
 *         would exceed the cycle allowance.
 */
export async function recordCandidateInvite(supabase, userId, quantity = 1) {
  if (quantity <= 0) return getUsageSummary(supabase, userId)

  // Pass p_user_id for service-role callers (server-side APIs); the RPC
  // ignores it for authenticated users and uses auth.uid() instead.
  const { error } = await supabase.rpc('record_candidate_invite', {
    p_quantity: quantity,
    p_user_id:  userId,
  })
  if (error) {
    // The RPC raises P0001 with the exact text 'candidate limit reached'.
    if (error.code === 'P0001' && /candidate limit reached/i.test(error.message || '')) {
      throw new SubscriptionError(
        SUBSCRIPTION_ERROR_CODES.CANDIDATE_LIMIT_REACHED,
        'Candidate limit reached for this cycle.',
        error,
      )
    }
    throw mapDbError(error, 'Failed to record invite')
  }
  // Return a fresh summary so callers see canonical usage.
  return getUsageSummary(supabase, userId)
}

/** Force a period reset — normally invoked from a scheduled job. */
export async function resetPeriodUsage(supabase, userId, opts = {}) {
  const now = new Date()
  const start = opts.periodStart ? new Date(opts.periodStart) : now
  const end = opts.periodEnd ? new Date(opts.periodEnd) : new Date(start.getTime() + 30 * 86_400_000)

  await supabase.from('workspace_usage').upsert({
    user_id: userId,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    candidates_used: 0,
  }, { onConflict: 'user_id' })
}

/** True if the workspace is inside the "no packs" window (spec: 7 days). */
export function isWithinRenewalWindow(subscription, days = 7) {
  if (!subscription?.current_period_end) return false
  const end = new Date(subscription.current_period_end).getTime()
  return end - Date.now() <= days * 86_400_000
}
