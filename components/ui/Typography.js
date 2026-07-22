/**
 * Typography primitives — the canonical type system.
 *
 * Every page should reach for these before typing a raw
 * `text-[...]` class. The point isn't to prevent one-off tweaks
 * (they're still fine when local) — it's to make the system
 * legible: if a page uses <H2>, you know it renders at the same
 * 18px semibold everywhere in the app.
 *
 *   Display   32px semibold   dashboard greeting
 *   H1        24px semibold   page title
 *   H2        18px semibold   section title
 *   H3        15px semibold   card title / row heading
 *   Body      14px normal     body copy
 *   Caption   12px normal     muted meta
 *   Eyebrow   11px 600 caps   small-caps label (warm-yellow tint)
 *
 * Every primitive accepts `as` to change the tag (default `h1/h2/…`
 * or `p`) and forwards `className` for local composition.
 */

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const INK = 'text-[color:var(--color-rc-ink)]';
const MUTED = 'text-[color:var(--color-rc-muted)]';
const WARM = 'text-[color:var(--color-rc-warm)]';

const EDITORIAL = { fontFamily: 'var(--font-editorial), inherit' };

function make(displayName, tag, baseClass, defaultStyle) {
  function Component({ as, className = '', style, children, ...rest }) {
    const Tag = as || tag;
    return (
      <Tag
        className={cx(baseClass, className)}
        style={defaultStyle ? { ...defaultStyle, ...(style || {}) } : style}
        {...rest}
      >
        {children}
      </Tag>
    );
  }
  Component.displayName = displayName;
  return Component;
}

/** 32px semibold ink — the dashboard greeting anchor. */
export const Display = make(
  'Display',
  'h1',
  'text-[length:var(--type-display)] leading-[1.15] font-semibold tracking-[-0.02em] ' + INK,
  EDITORIAL,
);

/** 24px semibold ink — page title. */
export const H1 = make(
  'H1',
  'h1',
  'text-[length:var(--type-h1)] leading-[1.2] font-semibold tracking-[-0.018em] ' + INK,
  EDITORIAL,
);

/** 18px semibold ink — section title. */
export const H2 = make(
  'H2',
  'h2',
  'text-[length:var(--type-h2)] leading-[1.25] font-semibold tracking-[-0.014em] ' + INK,
);

/** 15px semibold ink — card title, row heading. */
export const H3 = make(
  'H3',
  'h3',
  'text-[length:var(--type-h3)] leading-[1.3] font-semibold tracking-[-0.01em] ' + INK,
);

/** 14px body. Pass `muted` to swap to secondary text. */
export function Body({ as: Tag = 'p', muted = false, className = '', children, ...rest }) {
  return (
    <Tag
      className={cx(
        'text-[length:var(--type-body)] leading-[1.55]',
        muted ? MUTED : INK,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** 12px muted caption — meta rows, timestamps. */
export function Caption({ as: Tag = 'p', className = '', children, ...rest }) {
  return (
    <Tag
      className={cx(
        'text-[length:var(--type-caption)] leading-[1.45] ' + MUTED,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** 11px small-caps warm-yellow eyebrow — section anchors. */
export function Eyebrow({ as: Tag = 'div', tone = 'warm', className = '', children, ...rest }) {
  const color = tone === 'warm' ? WARM : MUTED;
  return (
    <Tag
      className={cx(
        'text-[length:var(--type-eyebrow)] uppercase tracking-[0.16em] font-semibold ' + color,
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
