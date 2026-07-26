/**
 * Plan catalog — reads from the `plans` table.
 *
 * The plans table is the single source of truth for pricing and limits.
 * The keys here are stable identifiers used across the app; the actual
 * numbers (price, role_limit, candidate_limit, seat_limit, features)
 * live in the row and can be edited without a code deploy.
 *
 * All limit columns are nullable — `null` means unlimited.
 */

export const PLAN_KEYS = Object.freeze({
  TRIAL: 'trial',
  GROWTH: 'growth',
  SCALE: 'scale',
  ENTERPRISE: 'enterprise',
})

export const PAID_PLAN_KEYS = Object.freeze([PLAN_KEYS.GROWTH, PLAN_KEYS.SCALE, PLAN_KEYS.ENTERPRISE])

/** True if the given limit value represents "unlimited". */
export function isUnlimited(v) {
  return v === null || v === undefined
}

/** Human display for a plan limit — "Unlimited" or the number. */
export function displayLimit(v) {
  return isUnlimited(v) ? 'Unlimited' : String(v)
}

/**
 * Format a price in cents to a human string.
 * Returns 'Custom' for null cents, e.g. Enterprise.
 */
export function formatPrice(cents, currency = 'USD') {
  if (cents === null || cents === undefined) return 'Custom'
  if (currency === 'USD') return '$' + Math.round(cents / 100).toLocaleString('en-US')
  if (currency === 'INR') return '₹' + Math.round(cents / 100).toLocaleString('en-IN')
  return `${(cents / 100).toFixed(0)} ${currency}`
}

let _plansCache = null
let _plansCacheAt = 0
const PLANS_TTL_MS = 60_000

/** Fetch every active plan, sorted. Cached for 60s to avoid hammering. */
export async function getPlans(supabase, { force = false } = {}) {
  const now = Date.now()
  if (!force && _plansCache && now - _plansCacheAt < PLANS_TTL_MS) return _plansCache
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) throw error
  _plansCache = data || []
  _plansCacheAt = now
  return _plansCache
}

/** Look up a single plan by key. Returns null if missing. */
export async function getPlan(supabase, key) {
  const plans = await getPlans(supabase)
  return plans.find((p) => p.key === key) || null
}

/** Clear the in-memory cache — call after admin edits the catalog. */
export function invalidatePlansCache() {
  _plansCache = null
  _plansCacheAt = 0
}
