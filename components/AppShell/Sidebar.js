'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { NAV_LINKS, isActive } from '../nav.config';
import Brand from './Brand';
import TrialWidget from './TrialWidget';
import SidebarUserMenu from './SidebarUserMenu';
import { useInbox } from './InboxContext';
import { useSidebarCollapsed } from './NavStateContext';

/**
 * Universal AppShell sidebar.
 *
 *   Expanded: 280px  ·  Collapsed: 72px
 *
 * When collapsed the parent `<aside>` in AppShell shrinks to 72px
 * with a 250ms width transition; labels here disappear, icons
 * centre, and every row grows a hover tooltip. Collapse state
 * is persisted per user under `recrewt:v2:nav`. Toggle via the
 * chevron button in the brand row or the `⌘/Ctrl + \` shortcut.
 */
export default function Sidebar({ onNavigate, collapsedOverride }) {
  const pathname = usePathname();
  const { items } = useInbox();
  const [persistedCollapsed, setPersistedCollapsed] = useSidebarCollapsed();
  const collapsed = typeof collapsedOverride === 'boolean' ? collapsedOverride : !!persistedCollapsed;
  const toggle = () => setPersistedCollapsed(!collapsed);

  const badges = {};
  items.forEach((n) => {
    if (n.read_at) return;
    if (n.kind === 'interview_completed') badges['/dashboard'] = true;
    if (n.kind === 'scoring_completed')   badges['/candidates'] = true;
    if (n.kind === 'invite_accepted' || n.kind === 'invite_withdrawn') badges['/roles'] = true;
  });

  return (
    <>
      {/* Brand + collapse toggle */}
      <div
        className={
          'flex items-center border-b border-[color:var(--color-rc-line)] ' +
          (collapsed ? 'justify-center px-2 pt-6 pb-5' : 'justify-between px-6 pt-8 pb-6')
        }
      >
        {!collapsed && <Brand onClick={onNavigate} />}
        {typeof collapsedOverride !== 'boolean' && (
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={
              'h-8 w-8 grid place-items-center rounded-[8px] text-[color:var(--color-rc-muted)] ' +
              'hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] ' +
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
              'transition-colors'
            }
          >
            {collapsed
              ? <ChevronsRight size={15} aria-hidden="true" />
              : <ChevronsLeft size={15} aria-hidden="true" />}
          </button>
        )}
      </div>

      <nav
        aria-label="Primary"
        className={'flex-1 py-4 ' + (collapsed ? 'px-2.5 space-y-1' : 'px-4 space-y-1')}
      >
        {NAV_LINKS.map((link) => {
          const active = isActive(pathname, link);
          const showDot = !!badges[link.href];
          const Icon = link.icon;
          const base =
            'group flex items-center rounded-[10px] text-[13.5px] focus:outline-none ' +
            'focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] transition-colors ';
          const activeCls = active
            ? 'bg-[color:var(--color-rc-ink)] text-white font-medium'
            : 'text-[color:var(--color-rc-muted)] hover:bg-[color:var(--color-rc-soft)] hover:text-[color:var(--color-rc-ink)]';
          const spacing = collapsed
            ? 'justify-center h-11 w-full'
            : 'gap-3 px-3 py-2.5';

          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              aria-label={showDot ? `${link.label} (activity)` : link.label}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? link.label : undefined}
              className={base + activeCls + ' ' + spacing}
            >
              <span className="relative shrink-0">
                <Icon size={20} strokeWidth={active ? 2 : 1.9} aria-hidden="true" />
                {collapsed && showDot && (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]"
                  />
                )}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1 whitespace-nowrap overflow-hidden">{link.label}</span>
                  {showDot && (
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)] shrink-0"
                    />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* TrialWidget hides itself when workspace is not on trial;
          we also hide it entirely when the rail is collapsed since
          the pill wouldn't fit at 80px. */}
      {!collapsed && <TrialWidget onNavigate={onNavigate} />}

      <div className={'border-t border-[color:var(--color-rc-line)] ' + (collapsed ? 'p-2.5' : 'p-3')}>
        <SidebarUserMenu onNavigate={onNavigate} collapsed={collapsed} />
      </div>
    </>
  );
}
