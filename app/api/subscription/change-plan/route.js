import { NextResponse } from 'next/server'
import DodoPayments from 'dodopayments'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  getSubscription,
  getPlan,
  applyPlanChange,
  PAYMENT_PROVIDERS,
  SUBSCRIPTION_STATES,
  PAID_PLAN_KEYS,
  PLAN_KEYS,
} from '@/lib/subscription'

const dodo = new DodoPayments({ bearerToken: process.env.DODO_PAYMENTS_API_KEY })

/**
 * Recruiter-initiated plan change from the /subscription page.
 *
 * Two cases:
 *  - The workspace already has an active Dodo subscription (they're on
 *    Growth or Scale already): call Dodo's Change Plan API on that
 *    existing subscription, then optimistically mirror the change
 *    locally. The subscription.plan_changed webhook redelivers the
 *    same state shortly after, which is a safe no-op.
 *  - The workspace has no Dodo subscription yet (still on trial, or a
 *    cancelled one with nothing to "change"): there's nothing for
 *    Dodo's change-plan endpoint to act on, so instead we hand back a
 *    checkout URL for a brand-new subscription, pre-filled with the
 *    user's own email so the webhook can match it straight back to
 *    this account via settings.email.
 */
export async function POST(request) {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }
  const toPlanKey = body?.toPlanKey

  if (!toPlanKey || toPlanKey === PLAN_KEYS.ENTERPRISE) {
    return NextResponse.json(
      { error: 'Enterprise changes go through sales — email hello@recrewtai.com.' },
      { status: 400 },
    )
  }
  if (!PAID_PLAN_KEYS.includes(toPlanKey)) {
    return NextResponse.json({ error: `Unknown plan: ${toPlanKey}` }, { status: 400 })
  }

  const [current, targetPlan] = await Promise.all([
    getSubscription(supabase, user.id),
    getPlan(supabase, toPlanKey),
  ])

  if (!targetPlan?.dodo_product_id) {
    return NextResponse.json({ error: 'That plan is not connected to billing yet.' }, { status: 500 })
  }
  if (current?.plan_key === toPlanKey && current?.status === SUBSCRIPTION_STATES.ACTIVE) {
    return NextResponse.json({ error: 'Already on this plan.' }, { status: 400 })
  }

  const hasActiveDodoSubscription =
    current && current.payment_provider === PAYMENT_PROVIDERS.DODO && current.provider_subscription_id

  if (!hasActiveDodoSubscription) {
    const checkoutUrl =
      `https://checkout.dodopayments.com/buy/${targetPlan.dodo_product_id}` +
      `?redirect_url=${encodeURIComponent('https://recrewtai.com/subscription')}` +
      `&email=${encodeURIComponent(user.email)}&disableEmail=true`
    return NextResponse.json({ requiresCheckout: true, checkoutUrl })
  }

  const rank = { [PLAN_KEYS.GROWTH]: 0, [PLAN_KEYS.SCALE]: 1 }
  const isUpgrade = (rank[toPlanKey] ?? 0) > (rank[current.plan_key] ?? -1)
  const prorationMode = isUpgrade ? 'difference_immediately' : 'prorated_immediately'

  try {
    await dodo.subscriptions.changePlan(current.provider_subscription_id, {
      product_id: targetPlan.dodo_product_id,
      proration_billing_mode: prorationMode,
      quantity: 1,
    })
  } catch (err) {
    console.error('Dodo change-plan call failed', err)
    return NextResponse.json({ error: 'Dodo could not process the plan change. Try again shortly.' }, { status: 502 })
  }

  // Optimistic mirror — Dodo's changePlan call returns void and confirms
  // asynchronously via subscription.plan_changed. Applying the same
  // change locally now means the UI updates instantly instead of the
  // user staring at their old plan until the webhook arrives.
  const serviceClient = createServiceClient()
  const updated = await applyPlanChange(serviceClient, user.id, toPlanKey, {
    paymentProvider: PAYMENT_PROVIDERS.DODO,
    providerCustomerId: current.provider_customer_id,
    providerSubscriptionId: current.provider_subscription_id,
    periodStart: current.current_period_start,
    periodEnd: current.current_period_end,
    status: SUBSCRIPTION_STATES.ACTIVE,
    fromPlan: current.plan_key,
  })

  return NextResponse.json({ ok: true, subscription: updated })
}
