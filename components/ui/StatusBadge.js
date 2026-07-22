import Badge from './Badge';

/**
 * StatusBadge — semantic label for pipeline states.
 *
 * Wraps Badge with a map from status enum → variant so callers
 * never need to remember which colour goes with which state.  Add
 * new statuses to STATUS_MAP; the component picks up the change
 * everywhere.
 *
 * Default statuses (align with the interview + candidate workflow):
 *   invited        — neutral
 *   in-progress    — warning  ("ongoing" is an alias)
 *   complete       — success  ("completed" is an alias)
 *   shortlisted    — success
 *   on-hold        — warning
 *   rejected       — danger
 *   active         — success
 *   inactive       — neutral
 *
 * Casing is normalised (lower-case, spaces or underscores → hyphen).
 *
 * Props:
 *   status  string      required
 *   label   string      override the visible text (falls back to status)
 *   size    'sm'|'md'
 *   ...rest passed to Badge
 */

const STATUS_MAP = {
  invited: { variant: 'neutral', label: 'Invited' },

  'in-progress': { variant: 'warning', label: 'In progress' },
  ongoing:       { variant: 'warning', label: 'In progress' },

  complete:  { variant: 'success', label: 'Complete' },
  completed: { variant: 'success', label: 'Complete' },

  shortlisted: { variant: 'success', label: 'Shortlisted' },
  'on-hold':   { variant: 'warning', label: 'On hold' },
  rejected:    { variant: 'danger',  label: 'Rejected' },

  active:   { variant: 'success', label: 'Active' },
  inactive: { variant: 'neutral', label: 'Inactive' },

  draft: { variant: 'neutral', label: 'Draft' },
};

function normalize(s) {
  if (!s) return '';
  return String(s).trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export default function StatusBadge({
  status,
  label,
  size = 'md',
  ...rest
}) {
  const key = normalize(status);
  const spec = STATUS_MAP[key] || { variant: 'neutral', label: status || '—' };
  return (
    <Badge variant={spec.variant} tone="soft" size={size} {...rest}>
      {label || spec.label}
    </Badge>
  );
}

export { STATUS_MAP };
