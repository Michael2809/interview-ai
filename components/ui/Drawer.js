'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Drawer — slide-in panel from a screen edge.
 *
 * Same behavioural contract as Modal (Esc, backdrop, focus return,
 * scroll lock, aria-modal) but the panel slides in from a chosen
 * edge instead of centering.  Best for progressive detail — a
 * candidate's full record, an interview transcript preview, a
 * filter surface.
 *
 * The animation uses the same shared keyframe as the AppShell
 * MobileDrawer (`animate-app-slide-in`) when `side==='left'`.  Other
 * sides use `translate3d` transforms with a matching duration.
 *
 * Props:
 *   open         boolean
 *   onClose      () => void
 *   side         'left' | 'right' | 'top' | 'bottom'   default 'right'
 *   size         string   width or height (e.g. '420px', 'clamp(320px,40vw,640px)')
 *   title        string
 *   description  string
 *   dismissible  boolean  default true
 *   footer       ReactNode
 *   children     ReactNode
 */

const SIDES = {
  left:   'left-0   top-0    bottom-0  border-r',
  right:  'right-0  top-0    bottom-0  border-l',
  top:    'left-0   right-0  top-0     border-b',
  bottom: 'left-0   right-0  bottom-0  border-t',
};

const DIM = {
  left:   (s) => ({ width:  s || 'clamp(280px,32vw,400px)' }),
  right:  (s) => ({ width:  s || 'clamp(280px,32vw,400px)' }),
  top:    (s) => ({ height: s || 'clamp(220px,40vh,420px)' }),
  bottom: (s) => ({ height: s || 'clamp(220px,40vh,420px)' }),
};

const ENTER = {
  left:   { transform: 'translateX(-100%)' },
  right:  { transform: 'translateX(100%)'  },
  top:    { transform: 'translateY(-100%)' },
  bottom: { transform: 'translateY(100%)'  },
};

export default function Drawer({
  open,
  onClose,
  side = 'right',
  size,
  title,
  description,
  dismissible = true,
  footer,
  children,
}) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = requestAnimationFrame(() => dialogRef.current?.focus());
    function onKey(e) {
      if (e.key === 'Escape' && dismissible) onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      if (returnFocusRef.current instanceof HTMLElement) {
        returnFocusRef.current.focus?.();
      }
    };
  }, [open, dismissible, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" aria-hidden={!open}>
      <div
        className="absolute inset-0 bg-[color:rgba(17,17,17,0.42)]"
        onClick={() => dismissible && onClose?.()}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
        tabIndex={-1}
        style={{
          ...DIM[side](size),
          animation:
            'rc-drawer-in 0.28s cubic-bezier(.22,.61,.36,1) both',
        }}
        className={
          'absolute bg-white text-[color:var(--color-rc-ink)] ' +
          'border-[color:var(--color-rc-line)] ' + SIDES[side] + ' ' +
          '[box-shadow:0_40px_80px_-24px_rgba(17,17,17,0.28)] ' +
          'flex flex-col outline-none'
        }
      >
        <style>{`
          @keyframes rc-drawer-in {
            from { ${Object.entries(ENTER[side]).map(([k,v])=>`${k.replace(/([A-Z])/g,'-$1').toLowerCase()}: ${v};`).join(' ')} }
            to   { transform: translate(0, 0); }
          }
          @media (prefers-reduced-motion: reduce) {
            [role="dialog"] { animation: none !important; }
          }
        `}</style>

        {(title || dismissible) && (
          <div className="shrink-0 flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-[color:var(--color-rc-line)]">
            <div className="min-w-0">
              {title && (
                <h2
                  id="drawer-title"
                  className="text-[18px] font-semibold tracking-[-0.02em] leading-tight"
                  style={{ fontFamily: 'var(--font-editorial), inherit' }}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-rc-muted)]">
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close panel"
                className="shrink-0 h-8 w-8 grid place-items-center rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5 text-[14.5px] leading-relaxed">
          {children}
        </div>

        {footer && (
          <div className="shrink-0 flex items-center gap-3 justify-end px-6 py-4 border-t border-[color:var(--color-rc-line)]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
