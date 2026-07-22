'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Sparkles, Mail, XCircle, AlertTriangle, ExternalLink } from 'lucide-react'
import { Drawer } from '@/components/ui'
import { useInbox } from './InboxContext'

/**
 * InboxDrawer — the right-side activity timeline.  Scales to future kinds:
 * automation events, recruiter activity, AI summaries.
 */

const KIND_META = {
  interview_completed: { label: 'Interview',   Icon: CheckCircle2, color: 'text-[color:var(--color-rc-green)]' },
  scoring_completed:   { label: 'AI Scoring',  Icon: Sparkles,     color: 'text-[color:var(--color-rc-ink)]' },
  invite_accepted:     { label: 'Invite',      Icon: Mail,         color: 'text-[color:var(--color-rc-warm)]' },
  invite_withdrawn:    { label: 'Withdrew',    Icon: XCircle,      color: 'text-[color:var(--color-rc-red)]' },
  system:              { label: 'System',      Icon: AlertTriangle, color: 'text-[color:var(--color-rc-warm)]' },
}

const FILTERS = [
  { key: 'all',     label: 'All',        match: () => true },
  { key: 'reviews', label: 'Reviews',    match: (n) => n.kind === 'scoring_completed' || n.kind === 'interview_completed' },
  { key: 'invites', label: 'Invites',    match: (n) => n.kind === 'invite_accepted' || n.kind === 'invite_withdrawn' },
  { key: 'system',  label: 'System',     match: (n) => n.kind === 'system' },
]

function groupByDay(items) {
  const now = new Date()
  const groups = { Today: [], Yesterday: [], 'Earlier this week': [], 'Earlier': [] }
  const nowT = now.getTime()
  items.forEach((n) => {
    const t = new Date(n.created_at).getTime()
    const dayDiff = Math.floor((nowT - t) / (24 * 60 * 60 * 1000))
    if (dayDiff <= 0) groups.Today.push(n)
    else if (dayDiff === 1) groups.Yesterday.push(n)
    else if (dayDiff <= 7) groups['Earlier this week'].push(n)
    else groups['Earlier'].push(n)
  })
  return groups
}

function relTime(iso) {
  const d = new Date(iso)
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  const days = Math.floor(s / 86400)
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export default function InboxDrawer() {
  const { drawerOpen, closeDrawer, items, unreadCount, markAllRead, markRead } = useInbox()
  const [filter, setFilter] = useState('all')

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0]
    return items.filter(f.match)
  }, [items, filter])

  const groups = useMemo(() => groupByDay(filtered), [filtered])

  return (
    <Drawer
      open={drawerOpen}
      onClose={closeDrawer}
      side="right"
      size="clamp(340px,42vw,520px)"
      title="Inbox"
      description={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
      footer={
        <button
          type="button"
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="text-[12.5px] text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)] transition-colors disabled:opacity-50 focus:outline-none focus-visible:underline"
        >
          Mark all as read
        </button>
      }
    >
      {/* Filter chips */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={
              'h-8 px-3 rounded-full text-[12.5px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' +
              (filter === f.key
                ? 'bg-[color:var(--color-rc-ink)] text-white'
                : 'bg-white text-[color:var(--color-rc-muted)] border border-[color:var(--color-rc-line)] hover:text-[color:var(--color-rc-ink)]')
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[13.5px] text-[color:var(--color-rc-muted)]">Nothing here yet.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {Object.entries(groups).map(([label, list]) => (
            list.length === 0 ? null : (
              <section key={label}>
                <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)] mb-2">
                  {label}
                </div>
                <ul className="grid gap-1">
                  {list.map((n) => {
                    const meta = KIND_META[n.kind] || KIND_META.system
                    const Icon = meta.Icon
                    const isUnread = !n.read_at
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.href || '#'}
                          onClick={() => markRead(n.id)}
                          className="group block rounded-[12px] px-3 py-2.5 hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:bg-[color:var(--color-rc-soft)]"
                        >
                          <div className="flex items-start gap-3">
                            <span aria-hidden="true" className={'mt-0.5 shrink-0 ' + meta.color}>
                              <Icon size={14} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className={'text-[13.5px] leading-tight truncate ' + (isUnread ? 'font-semibold text-[color:var(--color-rc-ink)]' : 'font-medium text-[color:var(--color-rc-ink)]')}>
                                    {n.title}
                                  </div>
                                  {n.body && (
                                    <div className="mt-0.5 text-[12.5px] text-[color:var(--color-rc-muted)] truncate">
                                      {n.body}
                                    </div>
                                  )}
                                </div>
                                <span className="shrink-0 text-[11.5px] text-[color:var(--color-rc-muted)] tabular-nums">
                                  {relTime(n.created_at)}
                                </span>
                              </div>
                            </div>
                            {isUnread && (
                              <span aria-hidden="true" className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]" />
                            )}
                          </div>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          ))}
        </div>
      )}
    </Drawer>
  )
}
