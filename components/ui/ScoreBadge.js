import Badge from './Badge';

/**
 * ScoreBadge — colored pill for numeric scores.
 *
 * Replaces the 4 inline `scoreColor()` helpers we found scattered
 * across dashboard, roles/[id], candidates, and transcript.  One
 * component, one place to change thresholds.
 *
 * Bands (0–10 scale; auto-normalized from a 0–100 value if
 * `outOf === 100`):
 *   ≥ 7   → success (green)   — "shortlist" band
 *   ≥ 4   → warning (amber)   — "review" band
 *   < 4   → danger  (red)     — "reject" band
 *
 * Renders as the shared Badge with an outline+soft mix that stays
 * quiet against a card. Use the Badge itself for non-score labels.
 *
 * Props:
 *   value   number             the score itself
 *   outOf   10 | 100            default 10
 *   suffix  string              e.g. "/10", "/100" — default "/{outOf}"
 *   show    'value' | 'both'    display just the value, or value+suffix
 *   size    'sm' | 'md'         forwarded to Badge
 *   ...rest passed to Badge
 */
export default function ScoreBadge({
  value,
  outOf = 10,
  suffix,
  show = 'both',
  size = 'md',
  ...rest
}) {
  if (value == null || Number.isNaN(Number(value))) return null;

  // Normalise to a 0–10 scale for band selection so a caller can
  // pass either 8.5 or 85 and get the same colour.
  const n = Number(value);
  const norm = outOf === 100 ? n / 10 : n;

  const variant = norm >= 7 ? 'success' : norm >= 4 ? 'warning' : 'danger';
  const label =
    show === 'value'
      ? String(n)
      : `${n}${suffix ?? '/' + outOf}`;

  return (
    <Badge
      variant={variant}
      tone="soft"
      size={size}
      aria-label={`Score ${n} of ${outOf}`}
      {...rest}
    >
      {label}
    </Badge>
  );
}
