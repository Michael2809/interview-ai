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
 * A whole row skeleton for editorial tables. Parameterisable so both
 * the recruiter's Roles list and the Candidates list can render the
 * same primitive with grid columns that match their actual row.
 *
 * Props:
 *   columns    Tailwind grid-template-columns string
 *              default: 'minmax(0,1fr)_140px_140px'
 *   variant    'basic'   — primary line + tiny meta line
 *              'candidate' — checkbox + status dot + name/meta + chips + chevron
 */
const ROW_COLUMNS = {
  basic:     'minmax(0,1fr)_140px_140px',
  candidate: '28px_10px_minmax(0,1fr)_112px_112px_18px',
};

// Small deterministic width jitter so the skeleton doesn't look like
// a repeating pattern. Uses index (i) modulo the array length.
const ROW_WIDTHS = [
  { name: 'w-2/3', meta: 'w-1/3' },
  { name: 'w-3/4', meta: 'w-2/5' },
  { name: 'w-1/2', meta: 'w-1/4' },
  { name: 'w-4/6', meta: 'w-1/3' },
];

export function SkeletonRow({ variant = 'basic', columns, i = 0 }) {
  const w = ROW_WIDTHS[i % ROW_WIDTHS.length];
  const gridTemplate = columns || ROW_COLUMNS[variant] || ROW_COLUMNS.basic;

  if (variant === 'candidate') {
    return (
      <li
        aria-hidden="true"
        className="grid items-center gap-x-4 md:gap-x-5 py-3 px-3 rc-skeleton"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <span className="h-4 w-4 rounded-[4px] bg-[color:var(--color-rc-soft)] justify-self-center" />
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-soft)]" />
        <div className="min-w-0">
          <div className={`h-3.5 rounded bg-[color:var(--color-rc-soft)] ${w.name}`} />
          <div className={`mt-2 h-2.5 rounded bg-[color:var(--color-rc-soft)] ${w.meta}`} />
        </div>
        <div className="h-6 rounded-full bg-[color:var(--color-rc-soft)] hidden lg:block" />
        <div className="h-6 rounded-full bg-[color:var(--color-rc-soft)] hidden md:block" />
        <div className="h-3 w-3 rounded bg-[color:var(--color-rc-soft)]/70" />
      </li>
    );
  }

  return (
    <div
      className="grid items-center gap-4 py-4 border-b border-[color:var(--color-rc-line)]"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <div className="min-w-0">
        <SkeletonLine className={w.name} height="h-3.5" />
        <div className="mt-2">
          <SkeletonLine className={w.meta} height="h-2.5" />
        </div>
      </div>
      <SkeletonLine className="w-24" height="h-3" />
      <SkeletonLine className="w-16" height="h-3" />
    </div>
  );
}

/**
 * KPI strip skeleton — mirrors the 4-cell metric strip used on the
 * dashboard so the transition from loading to loaded doesn't shift
 * the page layout.
 */
export function SkeletonKPIStrip({ cells = 4 }) {
  return (
    <div
      aria-hidden="true"
      className="grid gap-4 md:gap-6 rounded-[18px] bg-white border border-[color:var(--color-rc-line)] px-5 py-6 md:px-6 md:py-7"
      style={{ gridTemplateColumns: `repeat(${cells}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i} className="min-w-0">
          <SkeletonLine className="w-20" height="h-2.5" />
          <div className="mt-3">
            <SkeletonLine className="w-16" height="h-7" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Card grid skeleton — for the "Continue working" / role card grids
 * that appear on the dashboard and inside Role Details. Renders N
 * card-shaped blocks in the same responsive grid the real content
 * uses so nothing jumps when data lands.
 */
export function SkeletonCardGrid({ count = 3, className = '' }) {
  return (
    <div
      aria-hidden="true"
      className={cx('grid gap-3 md:grid-cols-2 lg:grid-cols-3', className)}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-[14px] bg-white border border-[color:var(--color-rc-line)] px-6 py-5 md:px-7 md:py-6"
        >
          <SkeletonLine className="w-1/2" height="h-4" />
          <div className="mt-4 space-y-2">
            <SkeletonLine className="w-3/5" height="h-2.5" />
            <SkeletonLine className="w-2/5" height="h-2.5" />
            <SkeletonLine className="w-2/3" height="h-2.5" />
            <SkeletonLine className="w-1/3" height="h-2.5" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A single "section" of the recruiter surfaces: eyebrow + title +
 * body area. Body defaults to a stack of skeleton rows.
 */
export function SkeletonSection({ children, rows = 3, showEyebrow = true }) {
  return (
    <section aria-hidden="true" className="mb-10 md:mb-12">
      {showEyebrow && (
        <div className="mb-5">
          <SkeletonLine className="w-24" height="h-2.5" />
          <div className="mt-2">
            <SkeletonLine className="w-56" height="h-4" />
          </div>
        </div>
      )}
      {children != null ? (
        children
      ) : (
        <div className="border-y border-[color:var(--color-rc-line)]">
          {Array.from({ length: rows }).map((_, i) => (
            <SkeletonRow key={i} i={i} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Full-form skeleton — for the Settings and Subscription pages.
 * Renders three stacked field-shaped blocks inside a card so the
 * loading state matches the loaded form's rhythm.
 */
export function SkeletonForm({ fields = 4 }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-[18px] bg-white border border-[color:var(--color-rc-line)] px-5 py-6 md:px-6 md:py-7 space-y-6"
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i}>
          <SkeletonLine className="w-24" height="h-2.5" />
          <div className="mt-2">
            <SkeletonLine className="w-full" height="h-9" />
          </div>
        </div>
      ))}
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
