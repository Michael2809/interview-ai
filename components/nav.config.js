import { LayoutDashboard, Briefcase, Users, Settings, CreditCard } from 'lucide-react';

/**
 * Single source of truth for the authed sidebar navigation.
 * Edit here and every page's nav updates automatically.
 *
 * `matchPrefix` — the pathname prefix that counts as "active".
 *   /roles/[id] and /roles both highlight the Roles link.
 */
export const NAV_LINKS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    matchPrefix: '/dashboard',
  },
  {
    href: '/roles',
    label: 'Roles',
    icon: Briefcase,
    matchPrefix: '/roles',
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
  return pathname === link.href || pathname.startsWith(link.matchPrefix + '/');
}
