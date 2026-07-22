'use client';

import { Bell } from 'lucide-react';
import { useInbox } from './InboxContext';

/**
 * NotificationButton — the sticky-header bell.
 *
 * Extracted from UniversalHeader so it can be reused (mobile bar,
 * dashboard empty state, wherever). Renders an accessible unread
 * counter overlay in warm-yellow when there are unread items.
 */
export default function NotificationButton() {
  const { openDrawer, unreadCount } = useInbox();
  const hasUnread = unreadCount > 0;
  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications'}
      className={
        'relative h-9 w-9 grid place-items-center rounded-[10px] ' +
        'text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] ' +
        'hover:bg-[color:var(--color-rc-soft)] transition-colors ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)]'
      }
    >
      <Bell size={15} aria-hidden="true" />
      {hasUnread && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-[color:var(--color-rc-yellow)] text-[10px] font-semibold text-[color:var(--color-rc-ink)] grid place-items-center leading-none tabular-nums"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
