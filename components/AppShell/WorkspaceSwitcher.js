'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Building2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

/**
 * WorkspaceSwitcher — sits at the far left of the sticky header.
 *
 * Recrewt is single-workspace-per-user today, so the popover lists
 * only the current workspace. The component is written as if the
 * feature already supported multiple workspaces — future work only
 * needs to feed it a list.
 *
 * Displays the workspace initial in a soft square + workspace name.
 * Clicking opens a small menu with the workspace list and a
 * "Workspace settings" link.
 */
export default function WorkspaceSwitcher() {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const rootRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user || cancelled) return;
      const { data: settings } = await supabase
        .from('settings')
        .select('company_name, full_name')
        .eq('user_id', data.user.id)
        .maybeSingle();
      if (cancelled) return;
      setWorkspace({
        id: data.user.id,
        name: settings?.company_name || settings?.full_name || data.user.email || 'Workspace',
        subtitle: data.user.email,
      });
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const initial = (workspace?.name || 'W').trim().charAt(0).toUpperCase();
  const label = workspace?.name || 'Workspace';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Workspace menu"
        onClick={() => setOpen((v) => !v)}
        className={
          'group flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-[10px] ' +
          'text-[13.5px] text-[color:var(--color-rc-ink)] ' +
          'hover:bg-[color:var(--color-rc-soft)] transition-colors ' +
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
        }
      >
        <span
          aria-hidden="true"
          className="h-6 w-6 grid place-items-center rounded-[6px] bg-[color:var(--color-rc-ink)] text-white text-[11px] font-semibold tabular-nums"
        >
          {initial}
        </span>
        <span className="max-w-[140px] truncate font-medium">{label}</span>
        <ChevronDown size={13} aria-hidden="true" className="text-[color:var(--color-rc-muted)] group-hover:text-[color:var(--color-rc-ink)]" />
      </button>

      {open && workspace && (
        <div
          role="menu"
          aria-label="Workspaces"
          className="absolute left-0 top-[calc(100%+6px)] z-40 w-[280px] rounded-[12px] bg-white border border-[color:var(--color-rc-line)] py-1.5 [box-shadow:0_20px_40px_-16px_rgba(17,17,17,0.18)]"
        >
          {/* This menu was labelled "Switch workspace" and held exactly one
              always-checked item whose only action was to close itself.
              There is no second workspace to switch to — the data layer
              has no such concept. The workspace name already sits on the
              trigger, so the fake radio is gone and what remains is the
              one thing here that actually goes somewhere. */}
          <div className="px-3 pt-2 pb-1.5">
            <div className="text-[10.5px] uppercase tracking-[0.16em] font-semibold text-[color:var(--color-rc-warm)]">
              Workspace
            </div>
            <div className="mt-1 text-[13.5px] font-medium text-[color:var(--color-rc-ink)] truncate">
              {workspace.name}
            </div>
            {workspace.subtitle && (
              <div className="text-[11.5px] text-[color:var(--color-rc-muted)] truncate">
                {workspace.subtitle}
              </div>
            )}
          </div>

          <div className="my-1 h-px bg-[color:var(--color-rc-line)]" />

          <a
            role="menuitem"
            href="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3.5 py-2 text-[13px] text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:bg-[color:var(--color-rc-soft)]"
          >
            <Building2 size={13} aria-hidden="true" className="text-[color:var(--color-rc-muted)]" />
            Workspace settings
          </a>
        </div>
      )}
    </div>
  );
}
