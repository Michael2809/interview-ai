'use client';

import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * Modal — centered dialog with backdrop.
 *
 * Behaviour:
 *   • Escape key closes when `open` is true (unless `dismissible`
 *     is false).
 *   • Body scroll is locked while open.
 *   • Backdrop click closes.
 *   • Focus jumps to the dialog root on open; returns to the
 *     previously-focused element on close.
 *   • aria-modal + role="dialog" for AT support.
 *
 * Sizes (max-width):
 *   sm — 400 px   sm dialogs, confirmations
 *   md — 520 px   default, most forms
 *   lg — 720 px   larger forms, long content
 *
 * Props:
 *   open         boolean       required
 *   onClose      () => void    required
 *   title        string        rendered at the top
 *   description  string        muted line under title
 *   size         'sm'|'md'|'lg' default 'md'
 *   dismissible  boolean       default true — allow Esc / backdrop close
 *   footer       ReactNode     usually a pair of Buttons
 *   children     ReactNode     dialog body
 */

const SIZES = {
  sm: 'max-w-[400px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[720px]',
};

export default function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  dismissible = true,
  footer,
  children,
}) {
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);

  // Latest onClose / dismissible held in refs so the open-transition effect
  // below only depends on `open`.  Without this, every parent re-render
  // (e.g. typing in a textarea inside the dialog) would pass a fresh
  // onClose arrow, tearing down the effect and re-focusing the dialog root
  // on every keystroke.
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => { dismissibleRef.current = dismissible; }, [dismissible]);

  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the dialog on next paint so the reveal completes first
    const id = requestAnimationFrame(() => dialogRef.current?.focus());

    function onKey(e) {
      if (e.key === 'Escape' && dismissibleRef.current) onCloseRef.current?.();
    }
    window.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      if (returnFocusRef.current instanceof HTMLElement) {
        returnFocusRef.current.focus?.();
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      aria-hidden={!open}
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-[color:rgba(17,17,17,0.42)]"
        onClick={() => dismissible && onClose?.()}
      />

      {/* dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
        tabIndex={-1}
        className={
          'relative w-full ' + (SIZES[size] || SIZES.md) + ' ' +
          'bg-white text-[color:var(--color-rc-ink)] ' +
          'rounded-[18px] border border-[color:var(--color-rc-line)] ' +
          '[box-shadow:0_40px_80px_-24px_rgba(17,17,17,0.28),0_4px_12px_rgba(17,17,17,0.06)] ' +
          'p-6 md:p-7 outline-none'
        }
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              {title && (
                <h2
                  id="modal-title"
                  className="text-[20px] font-semibold tracking-[-0.02em] leading-tight text-[color:var(--color-rc-ink)]"
                  style={{ fontFamily: 'var(--font-editorial), inherit' }}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="modal-description"
                  className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--color-rc-muted)]"
                >
                  {description}
                </p>
              )}
            </div>
            {dismissible && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="shrink-0 h-8 w-8 grid place-items-center rounded text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        <div className="text-[14.5px] leading-relaxed">
          {children}
        </div>

        {footer && (
          <div className="mt-6 flex items-center gap-3 justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
