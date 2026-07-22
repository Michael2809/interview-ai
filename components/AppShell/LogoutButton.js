'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Sign the user out and route back to /login. Behaviour is identical
 * whether the sidebar is expanded or collapsed — the collapsed variant
 * just drops the label and centres the icon in an 80px column.
 */
export default function LogoutButton({ onNavigate, collapsed = false }) {
  const supabase = createClient();
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    if (onNavigate) onNavigate();
    router.push('/login');
  }

  const base =
    'w-full flex items-center rounded-[10px] text-[13.5px] text-[color:var(--color-rc-muted)] ' +
    'hover:bg-[color:var(--color-rc-soft)] hover:text-[color:var(--color-rc-ink)] ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] transition-colors ';

  return (
    <button
      type="button"
      onClick={handleLogout}
      title={collapsed ? 'Sign out' : undefined}
      aria-label="Sign out"
      className={base + (collapsed ? 'justify-center h-10' : 'gap-3 px-3 py-2')}
    >
      <LogOut size={16} aria-hidden="true" />
      {!collapsed && <span>Sign out</span>}
    </button>
  );
}
