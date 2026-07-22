'use client';

/**
 * AppShell skeleton loading primitives.
 *
 * These match the editorial vocabulary — hairline borders, white
 * cards, no gradients. The subtle shimmer animation respects
 * `prefers-reduced-motion` via the CSS class below.
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const BASE = 'bg-[color:var(--color-rc-soft)] rc-skeleton';

/** Single line of text — pass width via className, e.g. "w-40". */
export function SkeletonLine({ className = '', height = 'h-3' }) {
  return <div aria-hidden="true" className={cx(BASE, 'rounded-[4px]', height, className || 'w-full')} />;
}

/** Rectangular block — good for image thumbnails and cards. */
export function SkeletonBlock({ className = '' }) {
  return <div aria-hidden="true" className={cx(BASE, 'rounded-[10px]', className || 'h-24 w-full')} />;
}

/** Circular block — good for avatars. */
export function SkeletonCircle({ size = 32 }) {
  return (
    <div
      aria-hidden="true"
      className={cx(BASE, 'rounded-full')}
      style={{ height: size, width: size }}
    />
  );
}

/**
 * A whole row skeleton for editorial tables — three columns, matches
 * the row height used in /roles and /candidates.
 */
export function SkeletonRow() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_140px_140px] items-center gap-4 py-4 border-b border-[color:var(--color-rc-line)]">
      <div className="min-w-0">
        <SkeletonLine className="w-2/3" height="h-3.5" />
        <div className="mt-2">
          <SkeletonLine className="w-1/3" height="h-2.5" />
        </div>
      </div>
      <SkeletonLine className="w-24" height="h-3" />
      <SkeletonLine className="w-16" height="h-3" />
    </div>
  );
}

/** Header-and-summary block used at the top of most pages. */
export function SkeletonHeader() {
  return (
    <div className="mb-10">
      <SkeletonLine className="w-24" height="h-2.5" />
      <div className="mt-4">
        <SkeletonLine className="w-1/2" height="h-8" />
      </div>
      <div className="mt-3">
        <SkeletonLine className="w-2/3" height="h-3.5" />
      </div>
    </div>
  );
}

/**
 * Full-page skeleton used by pages during their initial data load.
 * Kept intentionally generic — mimics the "label + heading +
 * description + table" shape shared by every v2 page.
 */
export function SkeletonPage() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="animate-pulse">
      <SkeletonHeader />
      <div className="pt-8 border-t border-[color:var(--color-rc-line)]">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    </div>
  );
}
