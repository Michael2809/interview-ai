'use client';

import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import MobileDrawer from './MobileDrawer';
import UniversalHeader from './UniversalHeader';
import InboxDrawer from './InboxDrawer';
import { NavStateProvider, useSidebarCollapsed } from './NavStateContext';
import { SearchIndexProvider } from './SearchIndexContext';
import { InboxProvider } from './InboxContext';
import { NavHistoryProvider } from './NavHistoryContext';
import { ContextualPrimaryProvider } from './ContextualPrimaryContext';

/**
 * The Universal AppShell.
 *
 *   ┌──────────────────────────────────────────────────────────┐
 *   │  SIDEBAR         │  STICKY HEADER 64px                    │
 *   │  280 / 80        ├────────────────────────────────────────┤
 *   │                  │  <main> max-w 1440, px-40, pt-32       │
 *   │                  │                                        │
 *   └──────────────────┴────────────────────────────────────────┘
 *
 *   ▸ Sidebar toggles between 280px (expanded) and 80px (collapsed).
 *     The state is persisted per-user under `recrewt:v2:nav`.
 *   ▸ Header stays sticky at the top with a hairline bottom border.
 *   ▸ Content area is a max-1440 column with 40px horizontal padding
 *     and 32px top spacing. Background is #FAFAFA (rc-bg).
 *
 * Providers wrapping the shell (in order):
 *   • NavStateProvider           — filter / tab / scroll persistence
 *   • NavHistoryProvider         — breadcrumb history
 *   • SearchIndexProvider        — command palette
 *   • InboxProvider              — inbox timeline + realtime
 *   • ContextualPrimaryProvider  — per-page primary action
 */
export default function AppShell({ children }) {
  return (
    <NavStateProvider>
      <NavHistoryProvider>
        <SearchIndexProvider>
          <InboxProvider>
            <ContextualPrimaryProvider>
              <AppShellLayout>{children}</AppShellLayout>
            </ContextualPrimaryProvider>
          </InboxProvider>
        </SearchIndexProvider>
      </NavHistoryProvider>
    </NavStateProvider>
  );
}

/**
 * Split out so we can consume useSidebarCollapsed inside a component
 * that lives under NavStateProvider.
 */
function AppShellLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useSidebarCollapsed();

  // Global shortcut: ⌘\ / Ctrl+\ toggles the sidebar. Ignored when
  // typing in a text field so it never fights with user input.
  useEffect(() => {
    function onKey(e) {
      const inEditable = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      );
      if (!inEditable && (e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setCollapsed(!collapsed);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [collapsed, setCollapsed]);

  const sidebarWidth = collapsed ? 72 : 256;

  return (
    <div className="min-h-screen bg-[color:var(--color-rc-bg)] flex text-[color:var(--color-rc-ink)]">
      {/* Skip link for keyboard users */}
      <a
        href="#app-shell-main"
        className={
          'sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] ' +
          'focus:px-3 focus:py-2 focus:rounded-[8px] focus:bg-[color:var(--color-rc-ink)] focus:text-white ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
      >
        Skip to main content
      </a>

      {/* Desktop sidebar — width is driven by collapse state */}
      <aside
        aria-label="Sidebar"
        style={{ width: sidebarWidth }}
        className="hidden md:flex bg-white border-r border-[color:var(--color-rc-line)] flex-col shrink-0 sticky top-0 h-screen transition-[width] duration-[250ms] ease-[cubic-bezier(.22,.61,.36,1)] overflow-hidden"
      >
        <Sidebar />
      </aside>

      {/* Mobile sidebar */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <UniversalHeader
          mobileMenuButton={
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className={
                'h-9 w-9 grid place-items-center rounded-[10px] ' +
                'text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] ' +
                'hover:bg-[color:var(--color-rc-soft)] transition-colors ' +
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
              }
            >
              <Menu size={18} aria-hidden="true" />
            </button>
          }
        />

        <main
          id="app-shell-main"
          role="main"
          tabIndex={-1}
          className="flex-1 pb-24 md:pb-8 focus:outline-none rc-page-fade"
        >
          <div className="max-w-[1440px] mx-auto px-4 md:px-10 pt-6 md:pt-8">
            {children}
          </div>
        </main>
      </div>

      <InboxDrawer />
    </div>
  );
}
