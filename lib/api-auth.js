import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getSubscriptionStatus, SUBSCRIPTION_STATES } from '@/lib/subscription'

/**
 * One gate for every route that spends money on the recruiter's behalf.
 *
 * Two separate holes closed here:
 *
 *   1. Several of these routes had no authentication at all. Anyone who
 *      knew the path could POST to /api/parse-jd or
 *      /api/generate-questions in a loop and run up an Anthropic bill on
 *      an account that is not theirs.
 *   2. Only /api/send-invite ever consulted the subscription. On an
 *      expired trial a recruiter still got question generation, JD
 *      parsing, CV parsing and calibration — every expensive call in the
 *      product — because the plan was checked in exactly one place.
 *
 * Candidate-facing routes deliberately do NOT use this. A candidate has
 * no login, and an interview already paid for must finish even if the
 * recruiter's plan lapses halfway through it. Chasing the recruiter's
 * billing problem by breaking a stranger's interview would be punishing
 * the wrong person.
 *
 * Usage:
 *   const gate = await requireActiveRecruiter()
 *   if (gate.response) return gate.response
 *   // gate.user is a real, paid-up recruiter from here on
 */
export async function requireActiveRecruiter() {
  const authed = await createClient()
  const { data: { user }, error } = await authed.auth.getUser()

  if (error || !user) {
    return {
      response: Response.json({ error: 'Not signed in.' }, { status: 401 }),
    }
  }

  let status
  try {
    status = await getSubscriptionStatus(createServiceClient(), user.id)
  } catch (err) {
    /* Fails OPEN, unlike role creation.
     *
     * A billing lookup that errors should not stop a paying customer
     * mid-task. The worst case here is one extra model call for someone
     * who may have lapsed; the worst case the other way is a working
     * customer locked out of their own product by an unrelated outage. */
    console.error('requireActiveRecruiter: status lookup failed:', err)
    return { user }
  }

  if (status === SUBSCRIPTION_STATES.EXPIRED || status === SUBSCRIPTION_STATES.PAST_DUE) {
    return {
      user,
      response: Response.json({
        error: 'Your subscription is no longer active. Please review your plan to continue.',
        reason: 'subscription_inactive',
      }, { status: 403 }),
    }
  }

  return { user }
}
