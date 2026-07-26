'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Command } from 'lucide-react';
import { usePrimary } from './ContextualPrimaryContext';
import Breadcrumb from './Breadcrumb';
import CommandPalette from './CommandPalette';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import NotificationButton from './NotificationButton';
import UserMenu from './UserMenu';

/**
 * UniversalHeader — the 64px sticky top strip present on every
 * authenticated page.
 *
 * Layout (left → right):
 *   [ workspace switcher ] [ breadcrumb ]  <search>  [ primary ] [ bell ] [ avatar ]
 *
 * Height is fixed at 64px on desktop and 56px on mobile so the
 * content area can offset the sticky positioning without measuring.
 */
export default function UniversalHeader({ mobileMenuButton }) {
  const router = useRouter();
  const primary = usePrimary();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global keyboard: ⌘K / Ctrl+K + "/" when not in an editable field.
  useEffect(() => {
    function onKey(e) {
      const meta = e.metaKey || e.ctrlKey;
      const inEditable = document.activeElement && (
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      );
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === '/' && !inEditable && !paletteOpen) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [paletteOpen]);

  const handlePrimaryClick = useCallback(() => {
    if (!primary) return;
    if (primary.onClick) primary.onClick();
    else if (primary.href) router.push(primary.href);
  }, [primary, router]);

  return (
    <>
      <header
        role="banner"
        className="sticky top-0 z-40 h-14 md:h-16 bg-white border-b border-[color:var(--color-rc-line)]"
      >
        <div className="h-full max-w-[1440px] mx-auto px-4 md:px-10 flex items-center gap-3 md:gap-4">
          {mobileMenuButton && (
            <div className="md:hidden">{mobileMenuButton}</div>
          )}

          {/* Left cluster — workspace + breadcrumbs (desktop only) */}
          <div className="hidden md:flex min-w-0 items-center gap-3">
            <WorkspaceSwitcher />
            <span
              aria-hidden="true"
              className="h-4 w-px bg-[color:var(--color-rc-line)]"
            />
            <Breadcrumb />
          </div>

          <div className="flex-1" />

          {/* Compact command chip — desktop.
              Search never dominates the header; it stays a small
              ⌘K affordance that opens the command palette. */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            className={
              'hidden md:inline-flex items-center gap-2 h-8 pl-2 pr-2.5 rounded-[8px] ' +
              'text-[12.5px] text-[color:var(--color-rc-muted)] ' +
              'hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] ' +
              'transition-[color,background-color] duration-150 ' +
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
            }
          >
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <Command size={11} aria-hidden="true" />K
            </span>
            <span>Search</span>
          </button>

          {/* Mobile: search icon */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search"
            className="md:hidden h-9 w-9 grid place-items-center rounded-[10px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
          >
            <Search size={16} aria-hidden="true" />
          </button>

          {/* Right cluster hierarchy: notifications · profile · primary CTA.
              Primary CTA anchors the far right so it's the only visually
              dominant action; everything else supports it. */}
          <NotificationButton />
          <UserMenu />

          {primary && !primary.hidden && (
            <button
              type="button"
              onClick={handlePrimaryClick}
              disabled={primary.disabled}
              aria-label={primary.label}
              className={
                'hidden md:inline-flex items-center gap-2 h-9 px-4 rounded-[10px] ml-1 ' +
                'font-medium text-[13.5px] leading-none ' +
                'bg-[color:var(--color-rc-ink)] text-white hover:bg-black transition-colors duration-150 ' +
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
                'focus-visible:ring-offset-2 disabled:opacity-60'
              }
            >
              {primary.label}
            </button>
          )}
        </div>
      </header>

      {/* Mobile fixed primary — sits above safe area */}
      {primary && !primary.hidden && (
        <div className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[color:var(--color-rc-line)] bg-white p-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handlePrimaryClick}
            disabled={primary.disabled}
            className={
              'w-full inline-flex items-center justify-center gap-2 h-11 rounded-[10px] ' +
              'font-medium text-[15px] leading-none bg-[color:var(--color-rc-ink)] text-white ' +
              'hover:bg-black transition-colors disabled:opacity-60 ' +
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
            }
          >
            {primary.label}
          </button>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
