/**
 * Badge — small pill for tags and labels.
 *
 * Two tones, both restrained:
 *   • soft — filled with the token role's soft tint, matching text
 *   • outline — hairline border, neutral fill
 *
 * Variants (semantic colors from the design tokens):
 *   • neutral (default) — the workhorse: soft grey, ink text
 *   • warning — muted amber (matches the landing's small-caps labels)
 *   • success | danger — green / red role tokens
 *   • ink — solid ink, white text (for "MOST POPULAR" style)
 *
 * Props:
 *   variant  'neutral' | 'warning' | 'success' | 'danger' | 'ink'
 *   tone     'soft' | 'outline'                     default 'soft'
 *   size     'sm' | 'md'                            default 'md'
 *   iconLeft node                                   optional
 *   uppercase boolean                               small-caps treatment
 *   ...rest passed to underlying span
 */

const BASE =
  'inline-flex items-center gap-1.5 leading-none rounded-full ' +
  'font-medium tracking-[-0.005em] whitespace-nowrap select-none';

const SIZES = {
  sm: 'text-[10.5px] px-2   py-[3px]',
  md: 'text-[11.5px] px-2.5 py-1',
};

const SOFT = {
  neutral: 'bg-[color:var(--color-rc-soft)] text-[color:var(--color-rc-ink)]',
  warning: 'bg-[rgb(255_216_77_/_0.20)] text-[color:var(--color-rc-warm)]',
  success: 'bg-[rgb(42_157_87_/_0.10)] text-[color:var(--color-rc-green)]',
  danger:  'bg-[rgb(199_75_58_/_0.10)] text-[color:var(--color-rc-red)]',
  ink:     'bg-[color:var(--color-rc-ink)] text-white',
};

const OUTLINE = {
  neutral: 'bg-white text-[color:var(--color-rc-ink)] border border-[color:var(--color-rc-line)]',
  warning: 'bg-white text-[color:var(--color-rc-warm)] border border-[color:var(--color-rc-yellow)]',
  success: 'bg-white text-[color:var(--color-rc-green)] border border-[color:var(--color-rc-green)]',
  danger:  'bg-white text-[color:var(--color-rc-red)]   border border-[color:var(--color-rc-red)]',
  ink:     'bg-white text-[color:var(--color-rc-ink)]   border border-[color:var(--color-rc-ink)]',
};

export default function Badge({
  variant = 'neutral',
  tone = 'soft',
  size = 'md',
  iconLeft,
  uppercase = false,
  className = '',
  children,
  ...rest
}) {
  const tones = tone === 'outline' ? OUTLINE : SOFT;
  const cls = [
    BASE,
    SIZES[size] || SIZES.md,
    tones[variant] || tones.neutral,
    uppercase ? 'uppercase tracking-[0.12em] font-semibold' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span className={cls} {...rest}>
      {iconLeft}
      {children}
    </span>
  );
}
