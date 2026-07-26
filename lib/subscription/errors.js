/**
 * Typed errors for the subscription system.
 *
 * Every public function throws SubscriptionError (or a subclass) with
 * a stable `.code` so callers can pattern-match without inspecting
 * error messages. Raw Postgres errors are wrapped so their internal
 * codes (23505, 42501, P0001, etc.) don't leak into UI text.
 */

export class SubscriptionError extends Error {
  constructor(code, message, cause) {
    super(message)
    this.name = 'SubscriptionError'
    this.code = code
    if (cause) this.cause = cause
  }
}

export const SUBSCRIPTION_ERROR_CODES = Object.freeze({
  CANDIDATE_LIMIT_REACHED:   'CANDIDATE_LIMIT_REACHED',
  ROLE_LIMIT_REACHED:        'ROLE_LIMIT_REACHED',
  SEAT_LIMIT_REACHED:        'SEAT_LIMIT_REACHED',
  ILLEGAL_STATE_TRANSITION:  'ILLEGAL_STATE_TRANSITION',
  INVALID_PAYMENT_PROVIDER:  'INVALID_PAYMENT_PROVIDER',
  NO_SUBSCRIPTION:           'NO_SUBSCRIPTION',
  PLAN_NOT_FOUND:            'PLAN_NOT_FOUND',
  REQUIRES_PAID_PLAN:        'REQUIRES_PAID_PLAN',
  RENEWAL_WINDOW:            'RENEWAL_WINDOW',
  UNAUTHORIZED:              'UNAUTHORIZED',
  DB_CONFLICT:               'DB_CONFLICT',
  DB_ERROR:                  'DB_ERROR',
  NETWORK_ERROR:             'NETWORK_ERROR',
})

/** True when the error is a browser fetch failure (offline, blocked, DNS…). */
function isNetworkFailure(err) {
  if (!err) return false
  const msg = String(err.message || err.name || '')
  return (
    err instanceof TypeError &&
    (/failed to fetch/i.test(msg) || /networkerror/i.test(msg))
  )
}

/**
 * Wrap a Supabase / Postgres error into a SubscriptionError with a
 * stable code. Preserves the original error as `.cause`.
 */
export function mapDbError(err, fallbackMessage = 'Database error') {
  if (!err) return null
  // Browser fetch failure — offline, DNS, ad-blocker, Supabase paused, etc.
  // Surfaced as its own code so callers can render a "temporarily
  // unavailable" state instead of a scary stack trace.
  if (isNetworkFailure(err)) {
    return new SubscriptionError(SUBSCRIPTION_ERROR_CODES.NETWORK_ERROR, 'Network unavailable', err)
  }
  // Postgres uniqueness violation
  if (err.code === '23505') return new SubscriptionError(SUBSCRIPTION_ERROR_CODES.DB_CONFLICT, err.message || 'Unique constraint violated', err)
  // insufficient privilege (RLS or tamper guard)
  if (err.code === '42501') return new SubscriptionError(SUBSCRIPTION_ERROR_CODES.UNAUTHORIZED, err.message || 'Not permitted', err)
  // Our own P0001 raise from record_candidate_invite RPC
  if (err.code === 'P0001' && /candidate limit reached/i.test(err.message || '')) {
    return new SubscriptionError(SUBSCRIPTION_ERROR_CODES.CANDIDATE_LIMIT_REACHED, 'Candidate limit reached for this cycle.', err)
  }
  return new SubscriptionError(SUBSCRIPTION_ERROR_CODES.DB_ERROR, fallbackMessage + (err.message ? `: ${err.message}` : ''), err)
}
