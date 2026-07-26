/**
 * Toast — subtle inline confirmation / error banner.
 *
 * This is the single toast primitive used everywhere across the
 * recruiter surfaces. It replaces the six near-identical inline
 * `<div role="status">…</div>` blocks that had accumulated across
 * roles, dashboard, transcript, role-detail, and interview-side
 * pages — same look, same aria wiring, in one place.
 *
 * Anchor pattern: rendered inline at the top of a page section
 * (not a fixed corner overlay) because the recruiter surfaces are
 * scroll-heavy and a corner overlay would fight the sticky header.
 * Callers own the show/hide timing.
 *
 * Props:
 *   kind     'success' | 'error'   — controls the leading icon color
 *   message  string                — required visible text
 *   className string               — optional extra wrapper classes
 *
 * Accessibility:
 *   • success → role="status" + aria-live="polite"
 *   • error   → role="alert"  + aria-live="assertive"
 *
 * Motion: uses .rc-toast-in defined in app/globals.css — a 220ms
 * opacity + 4px settle. Respects prefers-reduced-motion.
 */

import { CheckCircle2, AlertTriangle } from 'lucide-react';

export default function Toast({ kind = 'success', message, className = '' }) {
  if (!message) return null;
  const isError = kind === 'error';
  const Icon = isError ? AlertTriangle : CheckCircle2;
  const iconColor = isError
    ? 'text-[color:var(--color-rc-red)]'
    : 'text-[color:var(--color-rc-green)]';
  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={
        'mb-6 rounded-[14px] bg-white border border-[color:var(--color-rc-line)] ' +
        'px-5 py-3 flex items-center gap-3 ' +
        '[box-shadow:0_1px_2px_rgba(17,17,17,0.02)] rc-toast-in ' +
        className
      }
    >
      <Icon size={16} className={iconColor + ' shrink-0'} aria-hidden="true" />
      <span className="text-[13.5px] leading-snug text-[color:var(--color-rc-ink)]">
        {message}
      </span>
    </div>
  );
}
