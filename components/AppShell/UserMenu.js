'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { clearNavState } from './NavStateContext';

/**
 * UserMenu — round avatar that opens a small menu with Settings,
 * Subscription, and Sign out. Extracted from UniversalHeader so
 * every page can access the same behaviour.
 *
 * The avatar shows the workspace owner's initial; on load we read
 * settings.full_name and auth.user.email to derive it.
 */
export default function UserMenu() {
  const supabase = createClient();
  const router = useRouter();
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState('M');
  const [email, setEmail] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user || cancelled) return;
      const em = data.user.email || '';
      if (!cancelled) setEmail(em);
      const { data: settings } = await supabase
        .from('settings')
        .select('full_name')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (cancelled) return;
      const src = settings?.full_name || em || 'M';
      const ch = src.trim().charAt(0);
      setInitial((ch || 'M').toUpperCase());
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
    router.push('/login');
  }, [supabase, router]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className={
          'h-9 w-9 grid place-items-center rounded-full ' +
          'bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)] ' +
          'text-[13px] font-semibold text-[color:var(--color-rc-ink)] ' +
          'hover:border-[color:var(--color-rc-line-hover)] transition-colors ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
        style={{ fontFamily: 'var(--font-editorial), inherit' }}
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+6px)] w-[240px] z-40 rounded-[12px] bg-white border border-[color:var(--color-rc-line)] [box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)] py-1.5"
        >
          {email && (
            <div className="px-3.5 pt-2 pb-2">
              <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
                Signed in as
              </div>
              <div className="mt-1 text-[13px] text-[color:var(--color-rc-ink)] truncate">
                {email}
              </div>
            </div>
          )}
          <div className="h-px bg-[color:var(--color-rc-line)]" />
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2 text-[13.5px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:bg-[color:var(--color-rc-soft)]"
          >
            <SettingsIcon size={13} aria-hidden="true" /> Settings
          </Link>
          <Link
            href="/subscription"
            role="menuitem"
            onClick={() => setOpen(false)}
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
