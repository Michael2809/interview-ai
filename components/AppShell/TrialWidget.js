'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  getWorkspaceEntitlements,
  PLAN_KEYS,
  SUBSCRIPTION_STATES,
  SUBSCRIPTION_ERROR_CODES,
} from '@/lib/subscription';

/**
 * "Free Trial — N interviews left — Upgrade →" widget that sits at
 * the bottom of the sidebar. Reads its data from the subscription
 * system (the single source of truth) and renders nothing when the
 * workspace isn't on the trial plan.
 */
export default function TrialWidget({ onNavigate }) {
  const supabase = createClient();
  const [trial, setTrial] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const ent = await getWorkspaceEntitlements(supabase, user.id);
        if (cancelled) return;
        if (ent.subscription.plan_key !== PLAN_KEYS.TRIAL) return;
        setTrial({
          used:       ent.candidates.used,
          total:      ent.candidates.totalIncluded ?? 0,
          expired:    ent.effectiveStatus === SUBSCRIPTION_STATES.EXPIRED,
        });
      } catch (err) {
        // Network hiccups are common and non-actionable — log quietly.
        if (err?.code === SUBSCRIPTION_ERROR_CODES.NETWORK_ERROR) {
          console.warn('TrialWidget: network unavailable, skipping trial data');
        } else {
          console.error('TrialWidget entitlements load:', err);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  if (!trial) return null;

  const left = Math.max(0, trial.total - trial.used);
  const pct = trial.total > 0 ? Math.min(100, (trial.used / trial.total) * 100) : 0;

  return (
    <div className="mx-3 mb-4 p-3.5 rounded-[12px] bg-[color:var(--color-rc-soft)] border border-[color:var(--color-rc-line)]">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[color:var(--color-rc-warm)] mb-1.5">
        Free Trial
      </div>
      <div className="text-[13px] leading-snug text-[color:var(--color-rc-ink)]">
        {trial.expired ? 'Trial expired' : `${left} interview${left === 1 ? '' : 's'} left`}
      </div>
      <div className="mt-2.5 h-1 w-full bg-white rounded-full overflow-hidden border border-[color:var(--color-rc-line)]">
        <div
          className="h-full bg-[color:var(--color-rc-ink)] rounded-full transition-[width] duration-[250ms] ease-[cubic-bezier(.22,.61,.36,1)]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Link
        href="/subscription"
        onClick={onNavigate}
        className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[color:var(--color-rc-ink)] hover:text-[color:var(--color-rc-warm)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] rounded transition-colors"
      >
        Upgrade
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
