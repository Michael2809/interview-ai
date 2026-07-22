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
    <div className="mx-4 mb-4 p-3 bg-lavender rounded-xl border border-violet/20">
      <div className="text-xs font-semibold text-violet mb-1">Free Trial</div>
      <div className="text-xs text-ink">
        {trial.expired ? 'Trial expired' : `${left} interview${left === 1 ? '' : 's'} left`}
      </div>
      <div className="mt-2 h-1.5 w-full bg-white/60 rounded-full overflow-hidden">
        <div
          className="h-full bg-violet rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <Link
        href="/subscription"
        onClick={onNavigate}
        className="mt-2 block text-xs font-semibold text-violet hover:underline"
      >
        Upgrade →
      </Link>
    </div>
  );
}
