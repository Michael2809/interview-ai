'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import Sidebar from './Sidebar';

/**
 * Mobile-only slide-in drawer (<md). Same body as the desktop
 * sidebar, always in expanded 280px mode inside the drawer, plus an
 * overlay + close button. Body scroll is locked while open, and Esc
 * closes.
 */
export default function MobileDrawer({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="absolute left-0 top-0 bottom-0 w-[256px] bg-white border-r border-[color:var(--color-rc-line)] flex flex-col animate-app-slide-in">
        <div className="px-6 pt-6 pb-4 border-b border-[color:var(--color-rc-line)] flex items-center justify-between">
          <span
            className="text-[15px] font-semibold tracking-[-0.01em] text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            Menu
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="h-8 w-8 grid place-items-center rounded-[8px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <Sidebar onNavigate={onClose} collapsedOverride={false} />
      </aside>
    </div>
  );
}
