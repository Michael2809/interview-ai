'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Shared client-side auth guard.  Every authed page previously
 * duplicated this in its own useEffect — now it's one call.
 *
 * Usage:
 *   const { user, loading } = useAuthGuard();
 *   if (loading) return <Spinner />;
 *   // …use `user` safely from here
 *
 * If no user is signed in, the caller is redirected to
 *   /login?next=<currentPath>
 * so post-login they land back on the same page.  Matches the
 * exact behaviour of the old inline guards.
 */
export default function useAuthGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        const next = encodeURIComponent(pathname || '/dashboard');
        router.push(`/login?next=${next}`);
        return;
      }
      setUser(user);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  return { user, loading };
}
