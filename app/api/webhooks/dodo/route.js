import { NextResponse } from 'next/server'
import { Webhook } from 'standardwebhooks'
import { createServiceClient } from '@/lib/supabase/service'
import {
  applyPlanChange,
  getSubscriptionByProviderId,
  setSubscriptionStatusByProviderId,
  getPlanByDodoProductId,
  PAYMENT_PROVIDERS,
  SUBSCRIPTION_STATES,
} from '@/lib/subscription'

/**
 * Dodo Payments webhook endpoint.
 *
 * This is the only place that finds out a real payment happened —
 * everything else in the app (the /subscription page, entitlement
 * checks) reads the `subscriptions` table that this route writes to.
 * Registered in the Dodo dashboard under Developer > Webhooks, pointed
 * at https://recrewtai.com/api/webhooks/dodo, subscribed to the full
 * `subscription.*` group plus payment.succeeded/payment.failed.
 *
 * Runs with the service-role Supabase client because it has no user
 * session to authenticate as — its authority comes entirely from the
 * verified webhook signature below.
 */

export async function POST(request) {
  const rawBody = await request.text()
  const webhookHeaders = {
    'webhook-id': request.headers.get('webhook-id') || '',
    'webhook-signature': request.headers.get('webhook-signature') || '',
    'webhook-timestamp': request.headers.get('webhook-timestamp') || '',
  }

  // Constructed per-request rather than at module scope: the Webhook
  // constructor throws immediately on an empty secret, and module-scope
  // code runs at import time (build/bundling), not request time — this
  // way a misconfigured DODO_WEBHOOK_KEY only fails the request that
  // needs it, not the whole route module.
  try {
    const webhook = new Webhook(process.env.DODO_WEBHOOK_KEY)
    await webhook.verify(rawBody, webhookHeaders)
  } catch (err) {
    console.error('Dodo webhook: signature verification failed', err)
    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  let event
  try {
    event = JSON.parse(rawBody)
  } catch (err) {
    console.error('Dodo webhook: invalid JSON body', err)
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const webhookId = webhookHeaders['webhook-id']
  const supabase = createServiceClient()

  // Idempotency — Standard Webhooks retries on any non-2xx response, so
  // a redelivered event must be a no-op rather than double-applying a
  // plan change or double-extending a billing period. webhook_id is
  // the primary key; a conflict means we've already handled this exact
  // event and can short-circuit before touching subscriptions at all.
  const { error: dupeError } = await supabase
    .from('dodo_webhook_events')
    .insert({ webhook_id: webhookId, event_type: event.type, payload: event })
  if (dupeError) {
    if (dupeError.code === '23505') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    console.error('Dodo webhook: failed to log event (continuing anyway)', dupeError)
  }

  try {
    await handleEvent(supabase, event)
  } catch (err) {
    console.error(`Dodo webhook: failed to handle ${event.type}`, err)
    // Non-2xx makes Dodo retry — appropriate for a transient DB error,
    // but note the idempotency insert above means a *processing* error
    // here (as opposed to a duplicate) will retry the full handler,
    // which is safe since every handler below is itself idempotent
    // (state-machine self-transitions, upserts).
    return NextResponse.json({ error: 'processing failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleEvent(supabase, event) {
  const { type, data } = event
  switch (type) {
    case 'subscription.active':
      return handleSubscriptionActive(supabase, data)
    case 'subscription.renewed':
      return handleSubscriptionRenewed(supabase, data)
    case 'subscription.plan_changed':
      return handleSubscriptionPlanChanged(supabase, data)
    case 'subscription.on_hold':
      return setSubscriptionStatusByProviderId(supabase, data.subscription_id, SUBSCRIPTION_STATES.PAST_DUE)
    case 'subscription.cancelled':
      return setSubscriptionStatusByProviderId(supabase, data.subscription_id, SUBSCRIPTION_STATES.CANCELLED)
    case 'subscription.expired':
      return setSubscriptionStatusByProviderId(supabase, data.subscription_id, SUBSCRIPTION_STATES.EXPIRED)
    case 'subscription.failed':
      // Terminal at creation time — the mandate never succeeded, so no
      // subscriptions row was ever linked. Nothing to reconcile; the
      // event is already recorded in dodo_webhook_events for support.
      return
    default:
      // payment.succeeded, payment.failed, subscription.updated,
      // subscription.update_payment_method, etc. — informational only.
      // The subscription.* events above are what actually drive plan
      // state, per Dodo's own recommendation to track those primarily.
      return
  }
}

/** Case-insensitive match against the settings.email column populated at signup. */
async function resolveUserIdByEmail(supabase, email) {
  if (!email) return null
  const { data, error } = await supabase
    .from('settings')
    .select('user_id')
    .ilike('email', email)
    .maybeSingle()
  if (error) {
    console.error('Dodo webhook: email lookup failed', error)
    return null
  }
  return data?.user_id || null
}

async function handleSubscriptionActive(supabase, data) {
  const plan = await getPlanByDodoProductId(supabase, data.product_id)
  if (!plan) {
    console.error(`Dodo webhook: subscription.active for unmapped product_id ${data.product_id}`)
    return
  }

  const email = data.customer?.email
  const userId = await resolveUserIdByEmail(supabase, email)
  const periodStart = data.previous_billing_date || data.created_at
  const periodEnd = data.next_billing_date

  if (!userId) {
    // Paid via the public pricing page with no matching Recrewt account
    // yet (or a different email than the one they'll sign up with).
    // Park it — claimed automatically the moment an account with a
    // matching email exists (see claimPendingDodoLink in
    // subscription-service.js, called from ensureSubscription).
    await supabase.from('pending_dodo_links').upsert({
      email: (email || '').toLowerCase(),
      dodo_customer_id: data.customer?.customer_id ?? null,
      dodo_subscription_id: data.subscription_id,
      plan_key: plan.key,
      period_start: periodStart,
      period_end: periodEnd,
      raw_payload: data,
    }, { onConflict: 'email' })
    return
  }

  await applyPlanChange(supabase, userId, plan.key, {
    paymentProvider: PAYMENT_PROVIDERS.DODO,
    providerCustomerId: data.customer?.customer_id ?? null,
    providerSubscriptionId: data.subscription_id,
    periodStart,
    periodEnd,
    status: SUBSCRIPTION_STATES.ACTIVE,
  })
}

async function handleSubscriptionRenewed(supabase, data) {
  const existing = await getSubscriptionByProviderId(supabase, data.subscription_id)
  if (!existing) {
    console.error(`Dodo webhook: subscription.renewed for unlinked subscription_id ${data.subscription_id}`)
    return
  }
  await applyPlanChange(supabase, existing.user_id, existing.plan_key, {
    paymentProvider: PAYMENT_PROVIDERS.DODO,
    providerCustomerId: existing.provider_customer_id,
    providerSubscriptionId: data.subscription_id,
    periodStart: data.previous_billing_date,
    periodEnd: data.next_billing_date,
    status: SUBSCRIPTION_STATES.ACTIVE,
    fromPlan: existing.plan_key,
  })
}

async function handleSubscriptionPlanChanged(supabase, data) {
  const existing = await getSubscriptionByProviderId(supabase, data.subscription_id)
  if (!existing) {
    console.error(`Dodo webhook: subscription.plan_changed for unlinked subscription_id ${data.subscription_id}`)
    return
  }
  const plan = await getPlanByDodoProductId(supabase, data.product_id)
  if (!plan) {
    console.error(`Dodo webhook: subscription.plan_changed to unmapped product_id ${data.product_id}`)
    return
  }
  await applyPlanChange(supabase, existing.user_id, plan.key, {
    paymentProvider: PAYMENT_PROVIDERS.DODO,
    providerCustomerId: existing.provider_customer_id,
    providerSubscriptionId: data.subscription_id,
    periodStart: data.previous_billing_date,
    periodEnd: data.next_billing_date,
    status: SUBSCRIPTION_STATES.ACTIVE,
    fromPlan: existing.plan_key,
  })
}
