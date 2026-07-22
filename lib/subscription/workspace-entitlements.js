/**
 * Workspace Entitlements Aggregator
 *
 * A single, cache-friendly service that returns everything the
 * Subscription page (and any other feature that needs to render
 * plan + usage + permissions) requires in one round-trip.
 *
 * By running each dependency once and re-using the result across
 * derivations, we avoid the fan-out that happens when the page
 * calls getUsageSummary(), getAllEntitlements(), getPlans(), etc.
 * in parallel — each of which would otherwise re-fetch the plan
 * and the subscription independently.
 */

import { ensureSubscription, effectiveStatus } from './subscription-service'
import { getPlan, getPlans, isUnlimited, PAID_PLAN_KEYS } from './plans'
import { getWorkspaceUsage, getActiveRolesCount, getSeatsCount, getActivePacks, isWithinRenewalWindow } from './usage-engine'
import { SUBSCRIPTION_STATES } from './state-machine'

function ok(extra = {}) { return { allowed: true, ...extra } }
function deny(reason, extra = {}) { return { allowed: false, reason, ...extra } }

/**
 * The one call the Subscription page (and every gate check) uses.
 *
 * @param {*}      supabase   Authenticated Supabase client
 * @param {string} workspaceId  Currently the auth user id (workspace == user)
 * @returns {Promise<{
 *   plan, subscription, effectiveStatus,
 *   period: { start: Date, end: Date, daysUntilRenewal: number, withinRenewalWindow: boolean },
 *   candidates: { used, planLimit, packCredits, totalIncluded, remaining },
 *   roles: { used, limit, remaining },
 *   seats: { used, limit, remaining },
 *   packs: any[],
 *   permissions: {
 *     canCreateRole, canInviteCandidate, canCreateInterview,
 *     canAddTeamMember, canPurchaseCandidatePack, canUseAPI, canUseATS,
 *   },
 *   plans: any[],
 * }>}
 */
export async function getWorkspaceEntitlements(supabase, workspaceId) {
  // Step 1 — anchor the subscription. Everything else depends on it.
  const subscription = await ensureSubscription(supabase, workspaceId)

  // Step 2 — fetch the anchor's plan + full catalog + live counters in
  // parallel. Each of these is a single query.
  const [plan, plans, usageRow, packs, activeRoles, seats] = await Promise.all([
    getPlan(supabase, subscription.plan_key),
    getPlans(supabase),
    getWorkspaceUsage(supabase, workspaceId, subscription),
    getActivePacks(supabase, workspaceId),
    getActiveRolesCount(supabase, workspaceId),
    getSeatsCount(supabase, workspaceId),
  ])

  // ─── Derivations ─────────────────────────────────────────────
  const effStatus = effectiveStatus(subscription)

  const packCredits = packs.reduce((sum, p) => sum + (p.quantity - p.credits_used), 0)
  const planCandidates = plan?.candidate_limit ?? null
  const totalIncluded = isUnlimited(planCandidates) ? null : planCandidates + packCredits
  const candidatesUsed = usageRow.candidates_used
  const candidatesRemaining = totalIncluded === null
    ? null
    : Math.max(0, totalIncluded - candidatesUsed)

  const rolesLimit = plan?.role_limit ?? null
  const rolesRemaining = isUnlimited(rolesLimit) ? null : Math.max(0, rolesLimit - activeRoles)

  const seatsLimit = plan?.seat_limit ?? null
  const seatsRemaining = isUnlimited(seatsLimit) ? null : Math.max(0, seatsLimit - seats)

  const periodEnd = new Date(subscription.current_period_end)
  const periodStart = new Date(subscription.current_period_start)
  const daysUntilRenewal = Math.round((periodEnd.getTime() - Date.now()) / 86_400_000)
  const withinRenewalWindow = isWithinRenewalWindow(subscription, 7)

  // ─── Permissions (derived from the same snapshot) ────────────
  const disabledForPastDue = effStatus === SUBSCRIPTION_STATES.PAST_DUE || effStatus === SUBSCRIPTION_STATES.EXPIRED

  const permissions = {
    canCreateRole: disabledForPastDue
      ? deny(effStatus === SUBSCRIPTION_STATES.EXPIRED ? 'trial_expired' : 'trial_expired')
      : isUnlimited(rolesLimit)
        ? ok({ limit: null, current: activeRoles, remaining: null })
        : rolesRemaining <= 0
          ? deny('plan_limit', { limit: rolesLimit, current: activeRoles, remaining: 0 })
          : ok({ limit: rolesLimit, current: activeRoles, remaining: rolesRemaining }),

    canInviteCandidate: disabledForPastDue
      ? deny('trial_expired')
      : totalIncluded === null
        ? ok({ limit: null, current: candidatesUsed, remaining: null })
        : candidatesRemaining < 1
          ? deny('plan_limit', { limit: totalIncluded, current: candidatesUsed, remaining: 0 })
          : ok({ limit: totalIncluded, current: candidatesUsed, remaining: candidatesRemaining }),

    canAddTeamMember: disabledForPastDue
      ? deny('trial_expired')
      : isUnlimited(seatsLimit)
        ? ok({ limit: null, current: seats, remaining: null })
        : seatsRemaining <= 0
          ? deny('plan_limit', { limit: seatsLimit, current: seats, remaining: 0 })
          : ok({ limit: seatsLimit, current: seats, remaining: seatsRemaining }),

    canPurchaseCandidatePack: !PAID_PLAN_KEYS.includes(subscription.plan_key)
      ? deny('requires_paid_plan')
      : effStatus !== SUBSCRIPTION_STATES.ACTIVE
        ? deny('requires_paid_plan')
        : withinRenewalWindow
          ? deny('renewal_window')
          : ok(),

    canUseAPI: plan?.allows_api ? ok() : deny('feature_unavailable'),
    canUseATS: plan?.allows_ats ? ok() : deny('feature_unavailable'),
  }
  // canCreateInterview is a synonym for canInviteCandidate(1).
  permissions.canCreateInterview = permissions.canInviteCandidate

  return {
    plan,
    subscription,
    effectiveStatus: effStatus,
    period: {
      start: periodStart,
      end: periodEnd,
      daysUntilRenewal,
      withinRenewalWindow,
    },
    candidates: {
      used: candidatesUsed,
      planLimit: planCandidates,
      packCredits,
      totalIncluded,
      remaining: candidatesRemaining,
    },
    roles: {
      used: activeRoles,
      limit: rolesLimit,
      remaining: rolesRemaining,
    },
    seats: {
      used: seats,
      limit: seatsLimit,
      remaining: seatsRemaining,
    },
    packs,
    permissions,
    plans,
  }
}
