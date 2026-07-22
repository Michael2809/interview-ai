/**
 * EmptyState — the "nothing to show yet" panel.
 *
 * Standard anatomy (matches the Fit section pillar rhythm):
 *   [ optional icon inside a soft circle ]
 *   [ Title      — editorial heading                  ]
 *   [ Description — muted supporting copy, 46ch max   ]
 *   [ Action     — usually a primary Button           ]
 *
 * Renders inside a Card by default so it doesn't float bare on
 * the page.  Pass `bare` to strip the surface if you're already
 * inside one.
 *
 * Props:
 *   icon         React node        an icon element (lucide etc.)
 *   title        string            required-ish
 *   description  string
 *   action       React node        e.g. <Button variant="primary">
 *   bare         boolean           default false — omit the card wrapper
 *   className    string
 */

export default function EmptyState({
  icon,
  title,
  description,
  action,
  bare = false,
  className = '',
}) {
  const inner = (
    <div className="flex flex-col items-center text-center py-10 px-6 max-w-[440px] mx-auto">
      {icon && (
        <span
          aria-hidden="true"
          className="mb-5 h-12 w-12 rounded-full grid place-items-center bg-[rgb(255_216_77_/_0.16)] text-[color:var(--color-rc-warm)]"
        >
          {icon}
        </span>
      )}
      {title && (
        <h3
          className="text-[18px] font-semibold tracking-[-0.015em] leading-snug text-[color:var(--color-rc-ink)]"
          style={{ fontFamily: 'var(--font-editorial), inherit' }}
        >
          {title}
        </h3>
      )}
      {description && (
        <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--color-rc-muted)] max-w-[46ch]">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );

  if (bare) return <div className={className}>{inner}</div>;

  return (
    <div
      className={
        'bg-white border border-[color:var(--color-rc-line)] rounded-[18px] ' +
        '[box-shadow:0_30px_60px_-42px_rgba(17,17,17,0.10)] ' +
        className
      }
    >
      {inner}
    </div>
  );
}
