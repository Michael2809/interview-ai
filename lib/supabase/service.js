import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS entirely.
 *
 * Only ever use this on the server, and only for code paths that have
 * independently verified the caller's identity/authority through some
 * other means (a verified Dodo webhook signature, an authenticated
 * session checked before the call, etc). Never expose this client or
 * its key to the browser.
 *
 * Created lazily per-call rather than as a module-level singleton so
 * this file has no import-time side effects if SUPABASE_SERVICE_ROLE_KEY
 * is momentarily unset during build.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
