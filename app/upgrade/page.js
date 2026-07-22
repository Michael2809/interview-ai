import { redirect } from 'next/navigation'

/**
 * Legacy /upgrade route. The Billing surface has been renamed to
 * "Subscription" and lives at /subscription. This file exists so
 * any external bookmark or email link still resolves.
 */
export default function LegacyUpgradeRedirect() {
  redirect('/subscription')
}
