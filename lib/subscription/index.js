/**
 * Public surface of the Subscription System.
 *
 * Consumers should import from '@/lib/subscription' rather than the
 * individual files, so future refactors keep call sites clean.
 */

export {
  PLAN_KEYS,
  PAID_PLAN_KEYS,
  isUnlimited,
  displayLimit,
  formatPrice,
  getPlans,
  getPlan,
  invalidatePlansCache,
} from './plans'

export {
  SUBSCRIPTION_STATES,
  PAYMENT_PROVIDERS,
  ALL_STATES,
  ALL_PROVIDERS,
  ALLOWED_TRANSITIONS,
  isTransitionAllowed,
  assertTransition,
  assertPaymentProvider,
} from './state-machine'

export {
  getSubscription,
  ensureSubscription,
  getCurrentPlan,
  getSubscriptionStatus,
  effectiveStatus,
  getRenewalDate,
  getDaysUntilRenewal,
  requestUpgrade,
  requestDowngrade,
  applyPlanChange,
  renewSubscription,
  cancelSubscription,
  logEvent,
  getRecentEvents,
} from './subscription-service'

export {
  getUsageSummary,
  getWorkspaceUsage,
  getActiveRolesCount,
  getSeatsCount,
  getActivePacks,
  recordCandidateInvite,
  resetPeriodUsage,
  isWithinRenewalWindow,
} from './usage-engine'

export {
  canCreateRole,
  canInviteCandidate,
  canCreateInterview,
  canAddTeamMember,
  canPurchaseCandidatePack,
  canUseAPI,
  canUseATS,
  getAllEntitlements,
} from './entitlements'

// The aggregated single-call surface — preferred for pages that
// need the full picture in one shot.
export { getWorkspaceEntitlements } from './workspace-entitlements'

// Typed errors — pattern-match on `.code` rather than message text.
export {
  SubscriptionError,
  SUBSCRIPTION_ERROR_CODES,
  mapDbError,
} from './errors'
