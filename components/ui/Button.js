/**
 * Button — the single button primitive used across the app.
 *
 * Four variants match the landing-page design language:
 *   • primary   — ink fill, white text.  The strongest CTA.
 *   • secondary — white fill, 1px ink border, ink text.
 *                  Flips to ink fill + white text on hover.
 *                  Same style as the landing page's "Book a
 *                  15-minute walkthrough" and every Pricing CTA.
 *   • ghost     — no border, no fill.  Text-only affordance.
 *                  Used for tertiary actions ("Cancel", "See all").
 *   • danger    — same shape as secondary but with the red
 *                  role token.  For destructive actions.
 *
 * Sizes:
 *   • sm — 32 px tall, 12 px horizontal padding, 13.5 px text
 *   • md — 40 px tall (default), 20 px padding, 14.5 px text
 *   • lg — 48 px tall, 24 px padding, 16 px text
 *
 * Props:
 *   variant     'primary' | 'secondary' | 'ghost' | 'danger'
 *   size        'sm' | 'md' | 'lg'         default 'md'
 *   iconLeft    React node                  optional
 *   iconRight   React node                  optional
 *   loading     boolean                     shows Spinner + disables
 *   fullWidth   boolean                     stretch to container
 *   as          'button' | 'a'              default 'button'
 *   ...rest passed to the underlying element
 *
 * Focus ring: 2 px yellow, 3 px offset (matches every focus ring
 * in the app).  Preserves accessibility across all variants.
 */

import Spinner from './Spinner';

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium leading-none ' +
  'rounded transition-colors transition-transform duration-150 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] focus-visible:ring-offset-2 ' +
  'active:translate-y-px disabled:opacity-50 disabled:pointer-events-none ' +
  'select-none';

const SIZES = {
  sm: 'h-8  px-3   text-[13.5px] rounded',
  md: 'h-10 px-5   text-[14.5px] rounded',
  lg: 'h-12 px-6   text-[16px]   rounded-md',
};

const VARIANTS = {
  primary:
    'bg-[color:var(--color-rc-ink)] text-white ' +
    'hover:bg-[color:#000]',
  secondary:
    'bg-white text-[color:var(--color-rc-ink)] border border-[color:var(--color-rc-ink)] ' +
    'hover:bg-[color:var(--color-rc-ink)] hover:text-white',
  ghost:
    'bg-transparent text-[color:var(--color-rc-ink)] ' +
    'hover:bg-[color:var(--color-rc-soft)]',
  danger:
    'bg-white text-[color:var(--color-rc-red)] border border-[color:var(--color-rc-red)] ' +
    'hover:bg-[color:var(--color-rc-red)] hover:text-white',
};

export default function Button({
  variant = 'secondary',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  fullWidth = false,
  as = 'button',
  className = '',
  disabled,
  children,
  ...rest
}) {
  const Component = as;
  const cls = [
    BASE,
    SIZES[size] || SIZES.md,
    VARIANTS[variant] || VARIANTS.secondary,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const isDisabled = disabled || loading;

  return (
    <Component
      className={cls}
      disabled={as === 'button' ? isDisabled : undefined}
      aria-disabled={isDisabled || undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 18 : size === 'sm' ? 13 : 15} />
      ) : (
        iconLeft
      )}
      {children}
      {!loading && iconRight}
    </Component>
  );
}
