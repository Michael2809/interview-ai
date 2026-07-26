/**
 * Subscription state machine.
 *
 * The set of allowed statuses is fixed and enforced both here (in
 * application code) and in the database (CHECK constraint). Any
 * transition that isn't in ALLOWED_TRANSITIONS throws — this is the
 * only place in the app that decides what state changes are legal.
 */

export const SUBSCRIPTION_STATES = Object.freeze({
  TRIAL: 'trial',
  ACTIVE: 'active',
  PAST_DUE: 'past_due',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
})

export const ALL_STATES = Object.freeze(Object.values(SUBSCRIPTION_STATES))

export const PAYMENT_PROVIDERS = Object.freeze({
  NONE: 'none',
  DODO: 'dodo',
  STRIPE: 'stripe',
  MANUAL: 'manual',
})

export const ALL_PROVIDERS = Object.freeze(Object.values(PAYMENT_PROVIDERS))

/**
 * Legal state transitions. If a target isn't listed for a given
 * source, the transition is rejected. Self-transitions (a→a) are
 * always allowed so idempotent writes don't blow up.
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  trial:     ['active', 'expired', 'cancelled'],
  active:    ['past_due', 'cancelled', 'expired'],
  past_due:  ['active', 'cancelled', 'expired'],
  cancelled: ['active'],          // reactivation after cancel
  expired:   ['active'],          // reactivation after expiry (via new payment)
})

/** True if `to` is a legal target from `from`. */
export function isTransitionAllowed(from, to) {
  if (!ALL_STATES.includes(to)) return false
  if (from === to) return true
  const allowed = ALLOWED_TRANSITIONS[from] || []
  return allowed.includes(to)
}

import { SubscriptionError, SUBSCRIPTION_ERROR_CODES } from './errors'

/** Throw if the transition isn't allowed. */
export function assertTransition(from, to) {
  if (!isTransitionAllowed(from, to)) {
    throw new SubscriptionError(
      SUBSCRIPTION_ERROR_CODES.ILLEGAL_STATE_TRANSITION,
      `Illegal subscription transition: ${from} → ${to}. Allowed from '${from}': ${(ALLOWED_TRANSITIONS[from] || []).join(', ') || 'none'}.`,
    )
  }
}

/** Throw if the provider string isn't in the allowlist. */
export function assertPaymentProvider(provider) {
  if (provider === null || provider === undefined) return
  if (!ALL_PROVIDERS.includes(provider)) {
    throw new SubscriptionError(
      SUBSCRIPTION_ERROR_CODES.INVALID_PAYMENT_PROVIDER,
      `Invalid payment_provider: ${provider}. Expected one of ${ALL_PROVIDERS.join(', ')}.`,
    )
  }
}
