'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronDown,
  LogOut,
  Settings as SettingsIcon,
  CreditCard,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { clearNavState } from './NavStateContext';

/**
 * SidebarUserMenu — the unified profile block that anchors the
 * bottom of the sidebar.
 *
 *   Expanded 256px:  [avatar] [name / email]         [chevron]
 *   Collapsed 72px:  [avatar]
 *
 * Clicking opens a small popover with Settings, Subscription, and
 * Sign out. Replaces the previously detached logout button so the
 * bottom of the sidebar reads as one component.
 */
export default function SidebarUserMenu({ collapsed = false, onNavigate }) {
  const supabase = createClient();
  const router = useRouter();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState({ initial: 'M', name: '', email: '' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user || cancelled) return;
      const email = data.user.email || '';
      const { data: settings } = await supabase
        .from('settings')
        .select('full_name')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (cancelled) return;
      const name = settings?.full_name || (email ? email.split('@')[0] : 'You');
      const initialSrc = (settings?.full_name || email || 'You').trim().charAt(0);
      setProfile({
        initial: (initialSrc || 'Y').toUpperCase(),
        name,
        email,
      });
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e) { if (!rootRef.current?.contains(e.target)) setOpen(false); }
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleLogout = useCallback(async () => {
    clearNavState();
    await supabase.auth.signOut();
    if (onNavigate) onNavigate();
    router.push('/login');
  }, [supabase, router, onNavigate]);

  const avatar = (
    <span
      aria-hidden="true"
      className="h-8 w-8 grid place-items-center rounded-full bg-[color:var(--color-rc-ink)] text-white text-[12px] font-semibold shrink-0"
      style={{ fontFamily: 'var(--font-editorial), inherit' }}
    >
      {profile.initial}
    </span>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={collapsed ? 'Account menu' : `Account: ${profile.name || 'You'}`}
        title={collapsed ? profile.name || profile.email : undefined}
        className={
          'w-full flex items-center rounded-[10px] ' +
          'hover:bg-[color:var(--color-rc-soft)] transition-colors duration-150 ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
          (collapsed ? 'justify-center h-11' : 'gap-2.5 px-2 py-2')
        }
      >
        {avatar}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-[13px] font-medium text-[color:var(--color-rc-ink)] truncate leading-tight">
                {profile.name || 'You'}
              </span>
              {profile.email && (
                <span className="block text-[11.5px] text-[color:var(--color-rc-muted)] truncate leading-tight mt-0.5">
                  {profile.email}
                </span>
              )}
            </span>
            <ChevronDown
              size={13}
              aria-hidden="true"
              className={
                'text-[color:var(--color-rc-muted)] shrink-0 transition-transform duration-150 ' +
                (open ? 'rotate-180' : '')
              }
            />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className={
            'absolute z-40 w-[240px] rounded-[12px] bg-white border border-[color:var(--color-rc-line)] ' +
            '[box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)] py-1.5 ' +
            (collapsed
              ? 'left-[calc(100%+8px)] bottom-0'
              : 'left-0 bottom-[calc(100%+6px)]')
          }
        >
          {profile.email && (
            <div className="px-3.5 pt-2 pb-2">
              <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
                Signed in as
              </div>
              <div className="mt-1 text-[13px] text-[color:var(--color-rc-ink)] truncate">
                {profile.email}
              </div>
            </div>
          )}
          <div className="h-px bg-[color:var(--color-rc-line)]" />
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center gap-2 px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:bg-[color:var(--color-rc-soft)]"
          >
            <SettingsIcon size={13} aria-hidden="true" /> Settings
          </Link>
          <Link
            href="/subscription"
            role="menuitem"
            onClick={() => { setOpen(false); onNavigate?.(); }}
            className="flex items-center gap-2 px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:bg-[color:var(--color-rc-soft)]"
          >
            <CreditCard size={13} aria-hidden="true" /> Subscription
          </Link>
          <div className="my-1 h-px bg-[color:var(--color-rc-line)]" />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="w-full text-left flex items-center gap-2 px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:bg-[color:var(--color-rc-soft)]"
          >
            <LogOut size={13} aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
