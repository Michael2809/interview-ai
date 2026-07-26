'use client';

/**
 * PricingCard — single component powering both the marketing
 * pricing section on the landing page AND the plan comparison
 * on the recruiter Billing page.
 *
 * The component owns:
 *   • layout (head → divider → limits → divider → features → CTA)
 *   • typography, spacing, iconography
 *   • hover/focus states
 *   • the yellow ribbon + pill treatment
 *
 * The caller owns:
 *   • plan copy (name, price, blurb)
 *   • limit values + labels
 *   • feature list content
 *   • CTA text, target, disabled state, click handler
 *   • which of the three cards is `featured` (marketing) or
 *     `active` (billing "current plan")
 *
 * Styling lives in `./PricingCard.css` — a single file both pages
 * inherit from. Future pricing tweaks should only need to be made
 * once, in the CSS + this component.
 *
 * Props
 *   name           string
 *   price          string   e.g. "$420" or "Custom"
 *   priceSuffix    string?  e.g. "/ month" or "By quotation"
 *   blurb          string
 *   limits         Array<{ type: 'candidates'|'roles'|'seats', value: string, label: string }>
 *   featuresHeading string?  e.g. "Everything in Growth, plus:"
 *   features       string[]
 *   cta            { label, variant?: 'primary'|'secondary', href?, onClick?, disabled?, ariaLabel? }
 *   state          'default' | 'featured' | 'active'   default 'default'
 *   badgeLabel     string?  overrides the state's default pill copy
 */

/* ── Inline icons — kept in this file so a single import wires
 * both consuming pages. Sized identically across all cards. */
function LimitIcon({ type }) {
  if (type === 'candidates') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17 21v-1a5 5 0 0 0-5-5H6a5 5 0 0 0-5 5v1" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-1a5 5 0 0 0-3.5-4.78" />
        <path d="M15 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (type === 'roles') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </svg>
    );
  }
  // seats
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </svg>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 8 6.5 11.5 13 5" />
    </svg>
  );
}

export default function PricingCard({
  name,
  price,
  priceSuffix,
  blurb,
  limits = [],
  featuresHeading,
  features = [],
  cta,
  state = 'default',
  badgeLabel,
}) {
  const isFeatured = state === 'featured';
  const isActive = state === 'active';
  const cardClass = [
    'pr-card',
    isFeatured && 'pr-card-featured',
    isActive && 'pr-card-active',
  ].filter(Boolean).join(' ');

  const pillText = badgeLabel || (isFeatured ? 'Most popular' : isActive ? 'Active' : null);

  // CTA — renders <a> when href, <button> otherwise. Disabled CTAs
  // always render as a <button> so screen readers announce the
  // aria-disabled state consistently.
  const ctaVariant = cta?.variant === 'primary' ? 'pr-cta-primary' : 'pr-cta-secondary';
  const ctaClass = [
    'pr-cta',
    ctaVariant,
    cta?.disabled && 'pr-cta-disabled',
  ].filter(Boolean).join(' ');

  const ctaContent = (
    <>
      {cta?.label}
      {!cta?.disabled && <span className="arrow" aria-hidden="true">→</span>}
    </>
  );

  let ctaEl = null;
  if (cta) {
    if (cta.disabled) {
      ctaEl = (
        <button
          type="button"
          className={ctaClass}
          disabled
          aria-disabled="true"
          aria-label={cta.ariaLabel}
        >
          {ctaContent}
        </button>
      );
    } else if (cta.href) {
      ctaEl = (
        <a className={ctaClass} href={cta.href} aria-label={cta.ariaLabel}>
          {ctaContent}
        </a>
      );
    } else {
      ctaEl = (
        <button type="button" className={ctaClass} onClick={cta.onClick} aria-label={cta.ariaLabel}>
          {ctaContent}
        </button>
      );
    }
  }

  return (
    <article className={cardClass}>
      {pillText && <span className="pr-badge">{pillText}</span>}

      <header className="pr-card-head">
        <h3 className="pr-name">{name}</h3>
        <div className="pr-price">
          <span className="amt">{price}</span>
          {priceSuffix && <span className="per">{priceSuffix}</span>}
        </div>
        {blurb && <p className="pr-blurb">{blurb}</p>}
      </header>

      <div className="pr-divider" aria-hidden="true" />

      <div className="pr-included">
        <span className="pr-eyebrow">What&rsquo;s included</span>
        <ul className="pr-limits">
          {limits.map((limit, i) => (
            <li key={i}>
              <span className="pr-limit-icon">
                <LimitIcon type={limit.type} />
              </span>
              <span className="pr-limit-copy">
                <b>{limit.value}</b>
                <em>{limit.label}</em>
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="pr-divider" aria-hidden="true" />

      {featuresHeading && <p className="pr-feats-heading">{featuresHeading}</p>}
      <ul className="pr-feats">
        {features.map((f) => (
          <li key={f}>
            <Check />
            {f}
          </li>
        ))}
      </ul>

      {ctaEl}
    </article>
  );
}
