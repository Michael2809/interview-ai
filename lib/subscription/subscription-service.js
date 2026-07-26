/**
 * Subscription Service
 *
 * The only surface the app uses to read or change subscription state.
 * Never depends on a specific payment provider. Dodo Payments (or any
 * other provider) plugs into `applyPlanChange()` and `renewSubscription()`
 * later; every other caller in the app talks to this file.
 *
 * State transitions are validated by the state machine in ./state-machine.
 * The database enforces the same rules via CHECK constraints on
 * subscriptions.status and subscriptions.payment_provider.
 */

import { getPlan, PLAN_KEYS } from './plans'
import {
  SUBSCRIPTION_STATES,
  PAYMENT_PROVIDERS,
  assertTransition,
  assertPaymentProvider,
} from './state-machine'
import { SubscriptionError, SUBSCRIPTION_ERROR_CODES, mapDbError } from './errors'

const TRIAL_LENGTH_DAYS = 14
const CYCLE_LENGTH_DAYS = 30

function addDays(date, n) {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

/** Fetch the subscription row for a user. Returns null if none exists yet. */
export async function getSubscription(supabase, userId) {
  if (!userId) throw new SubscriptionError(SUBSCRIPTION_ERROR_CODES.UNAUTHORIZED, 'userId required')
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw mapDbError(error, 'Failed to load subscription')
  return data || null
}

/**
 * Fetch a subscription by its Dodo (or any provider's) subscription id.
 * This is how webhook events after the *first* one find their way back
 * to a workspace: applyPlanChange() stores providerSubscriptionId on
 * activation, so every later event (renewed, on_hold, failed,
 * cancelled) can look the row up directly without needing to re-resolve
 * a customer email. Returns null if no subscription is linked yet.
 */
export async function getSubscriptionByProviderId(supabase, providerSubscriptionId) {
  if (!providerSubscriptionId) return null
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle()
  if (error) throw mapDbError(error, 'Failed to load subscription by provider id')
  return data || null
}

/**
 * Status-only transition for a subscription already linked to a
 * provider (on_hold after a failed renewal, cancelled, reactivated,
 * etc). Deliberately narrower than applyPlanChange: it never touches
 * plan_key or the billing period, so a webhook can flip status without
 * accidentally granting/revoking plan entitlements it wasn't meant to.
 * Looks the row up by provider_subscription_id rather than user_id,
 * since that's all the webhook payload reliably gives us after the
 * first activation.
 */
export async function setSubscriptionStatusByProviderId(supabase, providerSubscriptionId, nextStatus) {
  const current = await getSubscriptionByProviderId(supabase, providerSubscriptionId)
  if (!current) {
    throw new SubscriptionError(
      SUBSCRIPTION_ERROR_CODES.NO_SUBSCRIPTION,
      `No subscription linked to provider_subscription_id ${providerSubscriptionId}`,
    )
  }
  assertTransition(current.status, nextStatus)

  const { data, error } = await supabase
    .from('subscriptions')
    .update({ status: nextStatus })
    .eq('provider_subscription_id', providerSubscriptionId)
    .select()
    .single()
  if (error) throw mapDbError(error, 'Failed to update subscription status')

  await logEvent(supabase, current.user_id, nextStatus === SUBSCRIPTION_STATES.CANCELLED ? 'cancelled' : 'plan_changed', {
    reason: 'provider_webhook',
    provider_subscription_id: providerSubscriptionId,
  }, current.plan_key, current.plan_key)

  return data
}

/**
 * Ensure a workspace has a subscription + usage row. Idempotent, and
 * race-safe: if two callers try to bootstrap the same workspace at
 * the same time, the loser catches the 23505 unique-violation and
 * re-reads the winner's row instead of crashing.
 */
export async function ensureSubscription(supabase, userId) {
  if (!userId) throw new SubscriptionError(SUBSCRIPTION_ERROR_CODES.UNAUTHORIZED, 'userId required')

  const existing = await getSubscription(supabase, userId)
  if (existing) return existing

  const now = new Date()
  const trialEnd = addDays(now, TRIAL_LENGTH_DAYS)

  const { data: sub, error: subErr } = await supabase
    .from('subscriptions')
    .insert({
      user_id: userId,
      plan_key: PLAN_KEYS.TRIAL,
      status: SUBSCRIPTION_STATES.TRIAL,
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      trial_ends_at: trialEnd.toISOString(),
      payment_provider: PAYMENT_PROVIDERS.NONE,
    })
    .select()
    .single()

  if (subErr) {
    if (subErr.code === '23505') {
      // Concurrent bootstrap won the race — re-read theirs.
      const winner = await getSubscription(supabase, userId)
      if (winner) return winner
    }
    throw mapDbError(subErr, 'Failed to create subscription')
  }

  // Bootstrap the usage row too. `23505` (concurrent insert) is benign.
  const { error: usageErr } = await supabase
    .from('workspace_usage')
    .insert({
      user_id: userId,
      period_start: now.toISOString(),
      period_end: trialEnd.toISOString(),
      candidates_used: 0,
    })
  if (usageErr && usageErr.code !== '23505') {
    throw mapDbError(usageErr, 'Failed to create usage row')
  }

  await logEvent(supabase, userId, 'trial_started', { plan: PLAN_KEYS.TRIAL })
  return sub
}

/**
 * Look up whether a Dodo subscription is waiting to be linked to this
 * user (see handleSubscriptionActive in the webhook route) and, if so,
 * apply it and remove the pending row.
 *
 * IMPORTANT: `pending_dodo_links` has RLS enabled with no policies, so
 * only a service-role client can read/write it — this must only ever
 * be called from a server-side route (see
 * /api/subscription/claim-pending), never from ensureSubscription's
 * normal call path, since that runs from client components using the
 * browser (anon-key) Supabase client. Returns null if nothing pending.
 */
export async function claimPendingDodoLink(supabase, userId) {
  const { data: settingsRow } = await supabase
    .from('settings')
    .select('email')
    .eq('user_id', userId)
    .maybeSingle()
  const email = settingsRow?.email
  if (!email) return null

  const { data: pending } = await supabase
    .from('pending_dodo_links')
    .select('*')
    .ilike('email', email)
    .maybeSingle()
  if (!pending) return null

  const sub = await applyPlanChange(supabase, userId, pending.plan_key, {
    paymentProvider: PAYMENT_PROVIDERS.DODO,
    providerCustomerId: pending.dodo_customer_id,
    providerSubscriptionId: pending.dodo_subscription_id,
    periodStart: pending.period_start,
    periodEnd: pending.period_end,
    status: SUBSCRIPTION_STATES.ACTIVE,
  })

  await supabase.from('pending_dodo_links').delete().eq('email', pending.email)
  await logEvent(supabase, userId, 'plan_changed', {
    reason: 'claimed_pending_dodo_link',
    provider_subscription_id: pending.dodo_subscription_id,
  }, PLAN_KEYS.TRIAL, pending.plan_key)

  return sub
}

/** Return { subscription, plan }. Creates a trial row if the user has none. */
export async function getCurrentPlan(supabase, userId) {
  const subscription = await ensureSubscription(supabase, userId)
  const plan = await getPlan(supabase, subscription.plan_key)
  return { subscription, plan }
}

/**
 * The effective status, which respects wall-clock time:
 *   trial + period_end < now → 'expired'
 *   active + period_end < now → 'past_due'
 */
export async function getSubscriptionStatus(supabase, userId) {
  const sub = await ensureSubscription(supabase, userId)
  return effectiveStatus(sub)
}

/** Pure helper — compute the effective status from a subscription row. */
export function effectiveStatus(sub) {
  if (!sub) return SUBSCRIPTION_STATES.TRIAL
  // Complimentary accounts (the owner's own account, internal test
  // accounts) never lapse regardless of current_period_end — that
  // field still gets a real (far-future) date for display purposes,
  // but wall-clock expiry checks are skipped entirely for these rows.
  if (sub.complimentary) return SUBSCRIPTION_STATES.ACTIVE
  const now = Date.now()
  const end = new Date(sub.current_period_end).getTime()
  if (sub.status === SUBSCRIPTION_STATES.TRIAL && end <= now) return SUBSCRIPTION_STATES.EXPIRED
  if (sub.status === SUBSCRIPTION_STATES.ACTIVE && end <= now) return SUBSCRIPTION_STATES.PAST_DUE
  return sub.status
}

export async function getRenewalDate(supabase, userId) {
  const sub = await ensureSubscription(supabase, userId)
  return new Date(sub.current_period_end)
}

/** Days until the current cycle ends. Negative means past due. */
export async function getDaysUntilRenewal(supabase, userId) {
  const end = await getRenewalDate(supabase, userId)
  return Math.round((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}

/**
 * Record an intent to upgrade. Provider-agnostic:
 *   - No payment provider connected → logs a request event only.
 *   - Provider connected (future)   → callers pass { direct: true }
 *     and we apply the plan change immediately.
 */
export async function requestUpgrade(supabase, userId, toPlanKey, opts = {}) {
  const current = await getCurrentPlan(supabase, userId)
  await logEvent(supabase, userId, 'upgrade_requested', {
    from_plan: current.subscription.plan_key,
    to_plan: toPlanKey,
    ...opts.metadata,
  }, current.subscription.plan_key, toPlanKey)

  if (opts.direct) return applyPlanChange(supabase, userId, toPlanKey, opts)
  return { requested: true, from: current.subscription.plan_key, to: toPlanKey }
}

export async function requestDowngrade(supabase, userId, toPlanKey, opts = {}) {
  const current = await getCurrentPlan(supabase, userId)
  await logEvent(supabase, userId, 'downgrade_requested', {
    from_plan: current.subscription.plan_key,
    to_plan: toPlanKey,
    ...opts.metadata,
  }, current.subscription.plan_key, toPlanKey)

  if (opts.direct) return applyPlanChange(supabase, userId, toPlanKey, opts)
  return { requested: true, from: current.subscription.plan_key, to: toPlanKey }
}

/**
 * Apply a plan change. This is the seam that a payment provider
 * (Dodo, Stripe, or a manual admin override) will call once payment
 * is confirmed.
 */
export async function applyPlanChange(supabase, userId, toPlanKey, opts = {}) {
  const now = new Date()
  const cycleStart = opts.periodStart ? new Date(opts.periodStart) : now
  const cycleEnd = opts.periodEnd ? new Date(opts.periodEnd) : addDays(cycleStart, CYCLE_LENGTH_DAYS)
  const nextStatus = opts.status || SUBSCRIPTION_STATES.ACTIVE
  const provider = opts.paymentProvider ?? PAYMENT_PROVIDERS.NONE
  assertPaymentProvider(provider)

  const current = await ensureSubscription(supabase, userId)
  assertTransition(current.status, nextStatus)

  const patch = {
    plan_key: toPlanKey,
    status: nextStatus,
    current_period_start: cycleStart.toISOString(),
    current_period_end: cycleEnd.toISOString(),
    cancel_at_period_end: false,
    payment_provider: provider,
    provider_customer_id: opts.providerCustomerId ?? null,
    provider_subscription_id: opts.providerSubscriptionId ?? null,
  }

  const { data, error } = await supabase
    .from('subscriptions')
    .update(patch)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error

  await supabase
    .from('workspace_usage')
    .upsert({
      user_id: userId,
      period_start: cycleStart.toISOString(),
      period_end: cycleEnd.toISOString(),
      candidates_used: 0,
    }, { onConflict: 'user_id' })

  await logEvent(supabase, userId, 'plan_changed', {
    to_plan: toPlanKey,
    payment_provider: provider,
  }, opts.fromPlan ?? current.plan_key, toPlanKey)

  return data
}

/**
 * Renew the current subscription — advance the period window and
 * reset cycle-scoped counters. Expires any active candidate packs.
 * Provider-agnostic; called by a payment webhook in future.
 */
export async function renewSubscription(supabase, userId, opts = {}) {
  const sub = await ensureSubscription(supabase, userId)
  const provider = opts.paymentProvider ?? sub.payment_provider ?? PAYMENT_PROVIDERS.NONE
  assertPaymentProvider(provider)
  assertTransition(sub.status, SUBSCRIPTION_STATES.ACTIVE)

  const start = new Date(sub.current_period_end)
  const end = addDays(start, CYCLE_LENGTH_DAYS)

  await supabase.from('subscriptions').update({
    current_period_start: start.toISOString(),
    current_period_end: end.toISOString(),
    status: SUBSCRIPTION_STATES.ACTIVE,
    payment_provider: provider,
  }).eq('user_id', userId)

  await supabase.from('workspace_usage').upsert({
    user_id: userId,
    period_start: start.toISOString(),
    period_end: end.toISOString(),
    candidates_used: 0,
  }, { onConflict: 'user_id' })

  await supabase.from('candidate_packs').update({ status: 'expired' })
    .eq('user_id', userId).eq('status', 'active').lte('expires_at', end.toISOString())

  await logEvent(supabase, userId, 'renewed', { payment_provider: provider })
  await logEvent(supabase, userId, 'period_reset', {})

  return { periodStart: start, periodEnd: end }
}

/** Cancel at period end — user keeps access until current cycle finishes. */
export async function cancelSubscription(supabase, userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: true })
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  await logEvent(supabase, userId, 'cancelled', {})
  return data
}

/** Write an entry into the subscription_events audit log. */
export async function logEvent(supabase, userId, kind, metadata = {}, fromPlan = null, toPlan = null) {
  const payload = {
    user_id: userId,
    kind,
    metadata,
    from_plan: fromPlan,
    to_plan: toPlan,
  }
  await supabase.from('subscription_events').insert(payload)
}

/** Read the recent lifecycle events for a workspace. */
export async function getRecentEvents(supabase, userId, limit = 20) {
  const { data, error } = await supabase
    .from('subscription_events')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
