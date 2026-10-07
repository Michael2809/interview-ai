import { LayoutDashboard, Building2, Users, Settings, CreditCard } from 'lucide-react';

/**
 * Single source of truth for the authed sidebar navigation.
 * Edit here and every page's nav updates automatically.
 *
 * `matchPrefix` — the pathname prefix that counts as "active".
 *   `alsoMatch` — extra prefixes that also count (Clients owns /roles).
 */
export const NAV_LINKS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    matchPrefix: '/dashboard',
  },
  {
    // Roles live inside a client now (client -> roles -> candidates),
    // so /roles and /roles/[id] keep this link highlighted.
    href: '/clients',
    label: 'Clients',
    icon: Building2,
    matchPrefix: '/clients',
    alsoMatch: ['/roles'],
  },
  {
    href: '/candidates',
    label: 'Candidates',
    icon: Users,
    matchPrefix: '/candidates',
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: Settings,
    matchPrefix: '/settings',
  },
  {
    href: '/subscription',
    label: 'Subscription',
    icon: CreditCard,
    matchPrefix: '/subscription',
  },
];

/** Returns true if `pathname` should highlight the given nav link. */
export function isActive(pathname, link) {
  if (!pathname) return false;
  const prefixes = [link.matchPrefix, ...(link.alsoMatch || [])];
  return pathname === link.href || prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
