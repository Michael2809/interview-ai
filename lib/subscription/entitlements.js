/**
 * Entitlements Engine — individual gate checks.
 *
 * The single place where features ask "am I allowed?". Any feature
 * that checks plan gating must call these functions — never inline
 * `plan === 'growth'` logic elsewhere in the app.
 *
 * When a caller needs ALL entitlements at once (like the Subscription
 * page), use `getWorkspaceEntitlements` instead — it computes the
 * whole snapshot once and derives every gate off it, avoiding the
 * fan-out that happens when six individual gates each re-fetch the
 * plan and usage row.
 *
 * Each check returns:
 *   {
 *     allowed:   boolean,
 *     reason?:   'trial_expired' | 'plan_limit' | 'renewal_window' | 'requires_paid_plan' | 'feature_unavailable',
 *     limit?:    number | null,   // null → unlimited
 *     current?:  number,
 *     remaining?: number | null,
 *   }
 */

import { ensureSubscription, effectiveStatus } from './subscription-service'
import { getPlan, isUnlimited, PAID_PLAN_KEYS } from './plans'
import { getUsageSummary, isWithinRenewalWindow } from './usage-engine'
import { SUBSCRIPTION_STATES } from './state-machine'

function ok(extra = {}) { return { allowed: true, ...extra } }
function deny(reason, extra = {}) { return { allowed: false, reason, ...extra } }

/** True when the subscription is not currently usable for gated features. */
function isBlockedForUsage(subscription) {
  const eff = effectiveStatus(subscription)
  return eff === SUBSCRIPTION_STATES.PAST_DUE || eff === SUBSCRIPTION_STATES.EXPIRED
}

/** Can the workspace open another role? */
export async function canCreateRole(supabase, userId) {
  const summary = await getUsageSummary(supabase, userId)
  if (isBlockedForUsage(summary.subscription)) return deny('trial_expired')
  const limit = summary.roles.limit
  const current = summary.roles.used
  if (isUnlimited(limit)) return ok({ limit: null, current, remaining: null })
  const remaining = Math.max(0, limit - current)
  if (remaining <= 0) return deny('plan_limit', { limit, current, remaining: 0 })
  return ok({ limit, current, remaining })
}

/** Can the workspace invite N more candidates this cycle? */
export async function canInviteCandidate(supabase, userId, quantity = 1) {
  const summary = await getUsageSummary(supabase, userId)
  if (isBlockedForUsage(summary.subscription)) return deny('trial_expired')
  const total = summary.candidates.totalIncluded
  const used = summary.candidates.used
  if (total === null) return ok({ limit: null, current: used, remaining: null })
  const remaining = Math.max(0, total - used)
  if (remaining < quantity) return deny('plan_limit', { limit: total, current: used, remaining })
  return ok({ limit: total, current: used, remaining })
}

/**
 * Currently identical to canInviteCandidate — an interview costs one
 * candidate. Kept as a separate export so future rules (e.g. bulk
 * interviews that consume more than 1 credit) can diverge cleanly.
 */
export async function canCreateInterview(supabase, userId) {
  return canInviteCandidate(supabase, userId, 1)
}

/** Can the workspace add another team member seat? */
export async function canAddTeamMember(supabase, userId) {
  const summary = await getUsageSummary(supabase, userId)
  if (isBlockedForUsage(summary.subscription)) return deny('trial_expired')
  const limit = summary.seats.limit
  const current = summary.seats.used
  if (isUnlimited(limit)) return ok({ limit: null, current, remaining: null })
  const remaining = Math.max(0, limit - current)
  if (remaining <= 0) return deny('plan_limit', { limit, current, remaining: 0 })
  return ok({ limit, current, remaining })
}

/**
 * Candidate packs are only purchasable on a paid plan and only when
 * more than 7 days remain in the current cycle. Trial + past-due
 * workspaces cannot buy packs.
 */
export async function canPurchaseCandidatePack(supabase, userId) {
  const subscription = await ensureSubscription(supabase, userId)
  if (!PAID_PLAN_KEYS.includes(subscription.plan_key)) return deny('requires_paid_plan')
  if (effectiveStatus(subscription) !== SUBSCRIPTION_STATES.ACTIVE) return deny('requires_paid_plan')
  if (isWithinRenewalWindow(subscription, 7)) return deny('renewal_window')
  return ok()
}

/** API access — requires a plan with `allows_api`. Missing plan → deny. */
export async function canUseAPI(supabase, userId) {
  const sub = await ensureSubscription(supabase, userId)
  const plan = await getPlan(supabase, sub.plan_key)
  return plan?.allows_api ? ok() : deny('feature_unavailable')
}

/** ATS integrations — requires a plan with `allows_ats`. Missing plan → deny. */
export async function canUseATS(supabase, userId) {
  const sub = await ensureSubscription(supabase, userId)
  const plan = await getPlan(supabase, sub.plan_key)
  return plan?.allows_ats ? ok() : deny('feature_unavailable')
}

/** Bundle every gate — used by the Subscription page to render badges. */
export async function getAllEntitlements(supabase, userId) {
  const [roles, candidates, seats, packs, api, ats] = await Promise.all([
    canCreateRole(supabase, userId),
    canInviteCandidate(supabase, userId, 1),
    canAddTeamMember(supabase, userId),
    canPurchaseCandidatePack(supabase, userId),
    canUseAPI(supabase, userId),
    canUseATS(supabase, userId),
  ])
  return { roles, candidates, seats, packs, api, ats }
}
