/**
 * Card — the base container for bounded content.
 *
 * Matches the shape used across the landing page and every
 * approved mockup: white surface, hairline border, 18 px radius,
 * subtle two-layer shadow (contact + soft floating).
 *
 * Compound API:
 *   <Card>
 *     <Card.Header title="…" description="…" action={<Button />} />
 *     <Card.Body>…</Card.Body>
 *     <Card.Footer>…</Card.Footer>
 *   </Card>
 *
 * Header, Body, Footer are optional — you can also just drop your
 * own content directly inside <Card>.
 *
 * Props (Card):
 *   as         element tag              default 'div'
 *   padding    'none'|'sm'|'md'|'lg'    default 'md'
 *   interactive boolean                 adds a hover lift
 *   className  string
 *   ...rest passed to root
 *
 * The `interactive` prop lifts the card 2 px on hover with a subtle
 * shadow bump — same feel as the Pricing card hover on the landing.
 */

const PADDING = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
};

const BASE =
  'bg-white text-[color:var(--color-rc-ink)] ' +
  'border border-[color:var(--color-rc-line)] rounded-[18px] ' +
  '[box-shadow:0_30px_60px_-42px_rgba(17,17,17,0.10),0_2px_6px_rgba(17,17,17,0.02)] ' +
  'transition-[transform,box-shadow,border-color] duration-[280ms] ease-[cubic-bezier(.22,.61,.36,1)]';

const INTERACTIVE =
  'hover:-translate-y-0.5 hover:border-[rgba(17,17,17,0.15)] ' +
  'hover:[box-shadow:0_40px_72px_-40px_rgba(17,17,17,0.14),0_3px_8px_rgba(17,17,17,0.03)]';

export default function Card({
  as = 'div',
  padding = 'md',
  interactive = false,
  className = '',
  children,
  ...rest
}) {
  const Component = as;
  const cls = [
    BASE,
    PADDING[padding] ?? PADDING.md,
    interactive ? INTERACTIVE : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Component className={cls} {...rest}>
      {children}
    </Component>
  );
}

/**
 * Card.Header — title / description on the left, optional action
 * (Button, IconButton, Menu) on the right.  Hairline underline
 * matches the Pricing cards' internal rhythm.
 */
function CardHeader({ title, description, action, className = '' }) {
  return (
    <div
      className={
        'flex items-start justify-between gap-4 pb-4 border-b border-[color:var(--color-rc-line)] ' +
        className
      }
    >
      <div className="min-w-0">
        {title && (
          <h3
            className="text-[16px] font-semibold tracking-[-0.01em] leading-tight text-[color:var(--color-rc-ink)]"
            style={{ fontFamily: 'var(--font-editorial), inherit' }}
          >
            {title}
          </h3>
        )}
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--color-rc-muted)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

function CardBody({ className = '', children }) {
  return <div className={'pt-5 ' + className}>{children}</div>;
}

function CardFooter({ className = '', children }) {
  return (
    <div
      className={
        'mt-5 pt-4 border-t border-[color:var(--color-rc-line)] flex items-center gap-3 justify-end ' +
        className
      }
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body   = CardBody;
Card.Footer = CardFooter;
