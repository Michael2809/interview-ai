/**
 * Barrel export for the Recrewt UI component library.
 *
 *   import { Button, TextField, ScoreBadge } from '@/components/ui';
 *
 * Adding a new component: create <Name>.js in this folder, then
 * add one line below.  See README.md for the full API.
 */

export { default as Button }        from './Button';
export { default as TextField }     from './TextField';
export { default as PasswordField } from './PasswordField';
export { default as Select }        from './Select';

export { default as Badge }         from './Badge';
export { default as ScoreBadge }    from './ScoreBadge';
export { default as StatusBadge, STATUS_MAP } from './StatusBadge';
export { default as StatusDot, resolveStatus } from './StatusDot';

// Typography — every page should reach for these before typing
// raw `text-[...]` classes. See Typography.js header for the scale.
export { Display, H1, H2, H3, Body, Caption, Eyebrow } from './Typography';

export { default as Card }          from './Card';
export { default as Modal }         from './Modal';
export { default as Drawer }        from './Drawer';
export { default as EmptyState }    from './EmptyState';
export { default as Spinner }       from './Spinner';
