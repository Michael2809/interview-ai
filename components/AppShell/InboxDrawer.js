'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Sparkles, Mail, XCircle, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { Drawer } from '@/components/ui'
import { useInbox } from './InboxContext'

/**
 * InboxDrawer — the right-side activity timeline.
 *
 * Today the only thing that writes a notification is the scorer
 * ("Rachel finished Junior Backend Developer · Hire · 7.4/10"). The
 * recruiter's own actions never land here: they did them.
 *
 * Built for volume. A busy role can produce hundreds of these, so the
 * inbox needs a way to see only what's new (Unread), to mark the lot as
 * seen, and to empty it. Both bulk actions confirm visibly, because a
 * button that changes nothing on screen reads as a button that's broken.
 */

const KIND_META = {
  interview_completed: { label: 'Interview',   Icon: CheckCircle2, color: 'text-[color:var(--color-rc-green)]' },
  scoring_completed:   { label: 'AI Scoring',  Icon: Sparkles,     color: 'text-[color:var(--color-rc-ink)]' },
  invite_accepted:     { label: 'Invite',      Icon: Mail,         color: 'text-[color:var(--color-rc-warm)]' },
  invite_withdrawn:    { label: 'Withdrew',    Icon: XCircle,      color: 'text-[color:var(--color-rc-red)]' },
  system:              { label: 'System',      Icon: AlertTriangle, color: 'text-[color:var(--color-rc-warm)]' },
}

/* "All" and "Reviews" used to be the tabs here. Every notification is a
 * review, so they always showed the same list. Unread is the split that
 * actually helps once there are hundreds. */
const FILTERS = [
  { key: 'all',    label: 'All',    match: () => true },
  { key: 'unread', label: 'Unread', match: (n) => !n.read_at },
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

/** The tick that pops in when a bulk action lands. */
function DoneTick() {
  return (
    <span
      aria-hidden="true"
      className="rc-inbox-tick inline-grid place-items-center h-[18px] w-[18px] rounded-full bg-[color:var(--color-rc-green)] text-white"
    >
      <Check size={12} strokeWidth={3} />
    </span>
  )
}

function FooterButton({ children, onClick, disabled, tone = 'muted' }) {
  const color = tone === 'danger'
    ? 'text-[color:var(--color-rc-red)] hover:text-[color:var(--color-rc-red)]'
    : tone === 'ink'
      ? 'text-[color:var(--color-rc-ink)] font-medium'
      : 'text-[color:var(--color-rc-muted)] hover:text-[color:var(--color-rc-ink)]'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        'inline-flex items-center gap-1.5 h-8 px-2 rounded-[8px] text-[12.5px] transition-colors ' +
        'hover:bg-[color:var(--color-rc-soft)] disabled:opacity-50 disabled:hover:bg-transparent ' +
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-rc-yellow)] ' + color
      }
    >
      {children}
    </button>
  )
}

// Mounted only while open, so every visit starts with fresh button
// states (no "All marked as read" left over from last time).
export default function InboxDrawer() {
  const { drawerOpen } = useInbox()
  return drawerOpen ? <InboxPanel /> : null
}

function InboxPanel() {
  const { drawerOpen, closeDrawer, items, unreadCount, markAllRead, markRead, clearAll } = useInbox()
  const [filter, setFilter] = useState('all')

  // 'idle' | 'working' | 'done' | 'error' for each bulk action
  const [readState, setReadState] = useState('idle')
  const [clearState, setClearState] = useState('idle')
  const [confirmClear, setConfirmClear] = useState(false)
  const timers = useRef([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  function later(fn, ms) { timers.current.push(setTimeout(fn, ms)) }

  async function handleMarkAll() {
    if (readState === 'working') return
    setReadState('working')
    const ok = await markAllRead()
    setReadState(ok === false ? 'error' : 'done')
    later(() => setReadState('idle'), 2200)
  }

  async function handleClear() {
    if (!confirmClear) { setConfirmClear(true); return }
    setConfirmClear(false)
    setClearState('working')
    const ok = await clearAll()
    setClearState(ok === false ? 'error' : 'done')
    later(() => setClearState('idle'), 2200)
  }

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) || FILTERS[0]
    return items.filter(f.match)
  }, [items, filter])

  const groups = useMemo(() => groupByDay(filtered), [filtered])

  const description =
    clearState === 'done' ? 'Inbox cleared'
      : unreadCount > 0 ? `${unreadCount} unread · ${items.length} total`
        : items.length > 0 ? `All caught up · ${items.length} total` : 'All caught up'

  const footer = (
    <div className="w-full flex items-center justify-between gap-3">
      {/* Clear all — two clicks, because it can't be undone */}
      <div className="flex items-center gap-1">
        {confirmClear ? (
          <>
            <span className="text-[12.5px] text-[color:var(--color-rc-ink)] mr-1">
              Clear all {items.length}?
            </span>
            <FooterButton tone="danger" onClick={handleClear}>Yes, clear</FooterButton>
            <FooterButton onClick={() => setConfirmClear(false)}>Cancel</FooterButton>
          </>
        ) : clearState === 'working' ? (
          <FooterButton disabled><Loader2 size={13} className="animate-spin" /> Clearing…</FooterButton>
        ) : clearState === 'done' ? (
          <span className="inline-flex items-center gap-1.5 h-8 px-2 text-[12.5px] font-medium text-[color:var(--color-rc-ink)]">
            <DoneTick /> Cleared
          </span>
        ) : clearState === 'error' ? (
          <span className="h-8 px-2 inline-flex items-center text-[12.5px] text-[color:var(--color-rc-red)]">Couldn’t clear. Try again.</span>
        ) : (
          <FooterButton onClick={handleClear} disabled={items.length === 0}>Clear all</FooterButton>
        )}
      </div>

      {/* Mark all as read */}
      <div>
        {readState === 'working' ? (
          <FooterButton disabled><Loader2 size={13} className="animate-spin" /> Marking…</FooterButton>
        ) : readState === 'done' ? (
          <span className="inline-flex items-center gap-1.5 h-8 px-2 text-[12.5px] font-medium text-[color:var(--color-rc-ink)]">
            <DoneTick /> All marked as read
          </span>
        ) : readState === 'error' ? (
          <span className="h-8 px-2 inline-flex items-center text-[12.5px] text-[color:var(--color-rc-red)]">Didn’t save. Try again.</span>
        ) : (
          <FooterButton tone={unreadCount > 0 ? 'ink' : 'muted'} onClick={handleMarkAll} disabled={unreadCount === 0}>
            <Check size={13} /> Mark all as read
          </FooterButton>
        )}
      </div>
    </div>
  )

  return (
    <Drawer
      open={drawerOpen}
      onClose={closeDrawer}
      side="right"
      size="clamp(340px,42vw,520px)"
      title="Inbox"
      description={description}
      footer={footer}
    >
      <style>{`
        @keyframes rc-inbox-pop {
          0%   { transform: scale(0.3); opacity: 0; }
          60%  { transform: scale(1.18); opacity: 1; }
          100% { transform: scale(1); }
        }
        .rc-inbox-tick { animation: rc-inbox-pop 0.42s cubic-bezier(.22,.61,.36,1) both; }
        @keyframes rc-inbox-fade { to { opacity: 0; transform: scale(0.4); } }
        .rc-inbox-dot-out { animation: rc-inbox-fade 0.35s ease-out forwards; }
        @media (prefers-reduced-motion: reduce) {
          .rc-inbox-tick, .rc-inbox-dot-out { animation: none; }
        }
      `}</style>

      {/* Filter chips */}
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {FILTERS.map((f) => {
          const count = f.key === 'unread' ? unreadCount : null
          return (
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
              {f.label}{count ? ` · ${count}` : ''}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[14px] font-medium text-[color:var(--color-rc-ink)]">
            {filter === 'unread' && items.length > 0 ? 'Nothing new' : 'You’re all caught up'}
          </p>
          <p className="mt-1 text-[13px] text-[color:var(--color-rc-muted)]">
            You’ll hear here when a candidate finishes an interview.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {Object.entries(groups).map(([label, list]) => (
            list.length === 0 ? null : (
              <section key={label}>
                <div className="text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)] mb-2">
                  {label}
                </div>
                <ul className="grid grid-cols-1 gap-1">
                  {list.map((n) => {
                    const meta = KIND_META[n.kind] || KIND_META.system
                    const Icon = meta.Icon
                    const isUnread = !n.read_at
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.href || '#'}
                          onClick={() => { markRead(n.id); closeDrawer() }}
                          className="group block rounded-[12px] px-3 py-2.5 hover:bg-[color:var(--color-rc-soft)] focus:outline-none focus-visible:bg-[color:var(--color-rc-soft)]"
                        >
                          <div className="flex items-start gap-3">
                            <span aria-hidden="true" className={'mt-0.5 shrink-0 ' + meta.color}>
                              <Icon size={14} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className={'text-[13.5px] leading-tight truncate ' + (isUnread ? 'font-semibold text-[color:var(--color-rc-ink)]' : 'font-medium text-[color:var(--color-rc-muted)]')}>
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
                            {isUnread ? (
                              <span aria-hidden="true" className="mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]" />
                            ) : readState === 'done' ? (
                              <span aria-hidden="true" className="rc-inbox-dot-out mt-1.5 shrink-0 h-1.5 w-1.5 rounded-full bg-[color:var(--color-rc-yellow)]" />
                            ) : null}
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
