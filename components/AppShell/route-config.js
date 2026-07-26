'use client'

/**
 * route-config — declares each authenticated route's:
 *   • label (used for breadcrumb + palette pages)
 *   • primary action (used for the contextual primary in the header)
 *
 * The Primary is intentionally minimal — a label + href.  Route-scoped
 * actions (e.g. Invite candidates opening a drawer) register themselves
 * via ContextualPrimaryContext at mount time, overriding the static
 * href-based fallback below.
 */

export const ROUTES = {
  '/dashboard':      { label: 'Dashboard' },
  '/roles':          { label: 'Roles' },
  '/candidates':     { label: 'Candidates' },
  '/settings':       { label: 'Settings' },
  '/subscription':   { label: 'Subscription' },
  '/billing':        { label: 'Subscription' }, // legacy alias
  '/upgrade':        { label: 'Subscription' }, // legacy alias
  '/onboarding':     { label: 'Onboarding' },
}

// Route pattern → default contextual primary { label, href, shortcut }
export const DEFAULT_PRIMARY_BY_PATTERN = [
  { pattern: /^\/dashboard/,                     primary: { label: 'Create role',     href: '/roles' } },
  { pattern: /^\/roles$/,                        primary: { label: 'Create role',     href: '/roles' } },
  { pattern: /^\/roles\/[^/]+$/,                 primary: null /* pages override */ },
  { pattern: /^\/candidates/,                    primary: null /* review lives on the transcript page, not the list */ },
  { pattern: /^\/interview\/[^/]+\/transcript/,  primary: null /* pages override */ },
  { pattern: /^\/settings/,                      primary: null /* page overrides when dirty */ },
  { pattern: /^\/subscription/,                  primary: null /* page overrides */ },
  { pattern: /^\/billing/,                       primary: null /* legacy — redirects */ },
  { pattern: /^\/upgrade/,                       primary: null /* legacy — redirects */ },
]

export function primaryForRoute(pathname) {
  const match = DEFAULT_PRIMARY_BY_PATTERN.find(({ pattern }) => pattern.test(pathname || ''))
  return match?.primary ?? null
}

export function labelForRoute(pathname) {
  const exact = ROUTES[pathname]
  if (exact) return exact.label
  if (pathname?.startsWith('/roles/'))       return 'Role'
  if (pathname?.startsWith('/interview/'))   return 'Review'
  if (pathname?.startsWith('/subscription')) return 'Subscription'
  return 'Home'
}
