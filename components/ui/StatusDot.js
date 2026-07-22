/**
 * StatusDot — the single primitive for pipeline status indicators.
 *
 * One consistent color system used everywhere a candidate, role,
 * interview, or activity item has a state to communicate:
 *
 *   scheduled / active   → green
 *   awaiting-review      → yellow
 *   in-progress          → blue
 *   shortlisted          → purple
 *   action-required      → red
 *
 * Every status is normalised so callers can pass "In Progress",
 * "in_progress", or "in-progress" and get the same result. Unknown
 * statuses render as a quiet muted dot with the raw status as its
 * accessible label — never colourful, never wrong.
 *
 * The dot is aria-hidden and pairs with a visible label sibling or
 * an `aria-label` on the parent. When you want the label baked in,
 * pass `showLabel` and the component renders "<dot> Label" inline.
 */

const STATUS_MAP = {
  // Green — offer sent, active workspace.
  'offer-sent': { color: 'var(--color-rc-green)',  label: 'Offer sent' },
  active:       { color: 'var(--color-rc-green)',  label: 'Active' },

  // Yellow — needs the recruiter's attention.
  'awaiting-review': { color: 'var(--color-rc-yellow)', label: 'Awaiting review' },
  awaiting:          { color: 'var(--color-rc-yellow)', label: 'Awaiting review' },
  'needs-review':    { color: 'var(--color-rc-yellow)', label: 'Awaiting review' },

  // Blue — interview scheduled / in flight.
  'interview-scheduled': { color: 'var(--color-rc-blue)', label: 'Interview scheduled' },
  scheduled:             { color: 'var(--color-rc-blue)', label: 'Scheduled' },
  confirmed:             { color: 'var(--color-rc-blue)', label: 'Confirmed' },
  'in-progress':         { color: 'var(--color-rc-blue)', label: 'In progress' },
  ongoing:               { color: 'var(--color-rc-blue)', label: 'In progress' },
  invited:               { color: 'var(--color-rc-blue)', label: 'Invited' },

  // Indigo — interview completed, decision pending.
  'interview-completed': { color: 'var(--color-rc-indigo)', label: 'Interview completed' },
  complete:              { color: 'var(--color-rc-indigo)', label: 'Interview completed' },
  completed:             { color: 'var(--color-rc-indigo)', label: 'Interview completed' },

  // Purple — moved forward on the pipeline.
  shortlisted: { color: 'var(--color-rc-purple)', label: 'Shortlisted' },

  // Red — decision-blocking action required.
  'action-required':  { color: 'var(--color-rc-red)', label: 'Action required' },
  'needs-reschedule': { color: 'var(--color-rc-red)', label: 'Needs reschedule' },
  overdue:            { color: 'var(--color-rc-red)', label: 'Overdue' },
  'past-due':         { color: 'var(--color-rc-red)', label: 'Past due' },

  // Grey (muted) — closed states that don't need attention.
  rejected:  { color: 'var(--color-rc-muted)', label: 'Rejected' },
  cancelled: { color: 'var(--color-rc-muted)', label: 'Cancelled' },
  'on-hold': { color: 'var(--color-rc-muted)', label: 'On hold' },
  inactive:  { color: 'var(--color-rc-muted)', label: 'Inactive' },
  draft:     { color: 'var(--color-rc-muted)', label: 'Draft' },
  archived:  { color: 'var(--color-rc-muted)', label: 'Archived' },
};

function normalise(s) {
  if (!s) return '';
  return String(s).trim().toLowerCase().replace(/[\s_]+/g, '-');
}

/** Return the resolved spec (color + label) for a status. */
export function resolveStatus(status) {
  const key = normalise(status);
  return STATUS_MAP[key] || { color: 'var(--color-rc-muted)', label: status || '—' };
}

/**
 * Props:
 *   status     required — any of the keys in STATUS_MAP; unknown → muted
 *   showLabel  render the label inline next to the dot
 *   size       'sm' (default, 6px) | 'md' (7px) | 'lg' (8px)
 *   className  extra classes on the wrapper
 */
export default function StatusDot({
  status,
  showLabel = false,
  size = 'sm',
  className = '',
}) {
  const spec = resolveStatus(status);
  const dim = size === 'lg' ? 8 : size === 'md' ? 7 : 6;

  if (!showLabel) {
    return (
      <span
        role="img"
        aria-label={spec.label}
        className={'inline-block rounded-full shrink-0 ' + className}
        style={{ height: dim, width: dim, backgroundColor: spec.color }}
      />
    );
  }

  return (
    <span
      className={
        'inline-flex items-center gap-1.5 text-[11.5px] uppercase tracking-[0.14em] ' +
        'font-semibold text-[color:var(--color-rc-muted)] ' + className
      }
    >
      <span
        aria-hidden="true"
        className="inline-block rounded-full shrink-0"
        style={{ height: dim, width: dim, backgroundColor: spec.color }}
      />
      {spec.label}
    </span>
  );
}

export { STATUS_MAP };
