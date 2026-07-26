import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { claimPendingDodoLink } from '@/lib/subscription'

/**
 * Claims a parked Dodo payment for the currently logged-in user, if
 * one exists — i.e. they paid via the public pricing-page checkout
 * link before (or while) creating their Recrewt account, so the
 * webhook couldn't resolve a user_id yet and parked it in
 * pending_dodo_links keyed by email.
 *
 * Deliberately a separate server route rather than something baked
 * into ensureSubscription(): pending_dodo_links has no RLS policies,
 * so only the service-role client (server-only) can touch it, and
 * ensureSubscription is called from client components using the
 * browser client. The /subscription page calls this once on load,
 * before reading entitlements, so a newly-claimed plan shows up
 * immediately instead of waiting for the user to refresh.
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const serviceClient = createServiceClient()
  try {
    const claimed = await claimPendingDodoLink(serviceClient, user.id)
    return NextResponse.json({ claimed: Boolean(claimed) })
  } catch (err) {
    console.error('claim-pending: failed', err)
    return NextResponse.json({ error: 'Could not check for a pending payment.' }, { status: 500 })
  }
}
