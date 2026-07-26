'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, User as UserIcon, Briefcase, Layers, ArrowRight, Sparkles, Plus, Send, LogOut, Settings as SettingsIcon, CreditCard, Command } from 'lucide-react'
import { useSearchIndex } from './SearchIndexContext'

/**
 * CommandPalette — the ⌘K / "/" overlay.
 * Sections: Recents · Candidates · Roles · Stages · Pages · Actions
 * Keyboard: ↑ ↓ moves selection, Enter opens, Esc closes.
 * On empty query, recents surface on top and actions are always visible.
 */

const PAGES = [
  { key: 'p-dashboard',  label: 'Dashboard',  href: '/dashboard', icon: 'briefcase' },
  { key: 'p-roles',      label: 'Roles',      href: '/roles',     icon: 'briefcase' },
  { key: 'p-candidates', label: 'Candidates', href: '/candidates', icon: 'user' },
  { key: 'p-settings',   label: 'Settings',   href: '/settings',  icon: 'settings' },
  { key: 'p-subscription', label: 'Subscription', href: '/subscription', icon: 'card' },
]

const ACTIONS = [
  { key: 'a-create-role',   label: 'Create role',        href: '/roles' },
  { key: 'a-invite',        label: 'Invite candidates',  hrefHint: 'a role first' },
  { key: 'a-generate-q',    label: 'Generate interview questions', hrefHint: 'inside a stage' },
  { key: 'a-open-settings', label: 'Open Settings',      href: '/settings' },
  { key: 'a-open-subscription', label: 'Open Subscription',  href: '/subscription' },
]

function IconFor({ type, hint }) {
  const cls = 'text-[color:var(--color-rc-muted)]'
  if (type === 'candidate') return <UserIcon size={14} className={cls} aria-hidden="true" />
  if (type === 'role')      return <Briefcase size={14} className={cls} aria-hidden="true" />
  if (type === 'stage')     return <Layers size={14} className={cls} aria-hidden="true" />
  if (hint === 'card')      return <CreditCard size={14} className={cls} aria-hidden="true" />
  if (hint === 'settings')  return <SettingsIcon size={14} className={cls} aria-hidden="true" />
  if (hint === 'briefcase') return <Briefcase size={14} className={cls} aria-hidden="true" />
  if (hint === 'user')      return <UserIcon size={14} className={cls} aria-hidden="true" />
  return <ArrowRight size={14} className={cls} aria-hidden="true" />
}

export default function CommandPalette({ open, onClose }) {
  const router = useRouter()
  const { index, recents, search, pushRecent } = useSearchIndex()
  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  // Compose visible sections into one flat list for arrow-key navigation
  const sections = useMemo(() => {
    const q = query.trim()
    if (!q) {
      return [
        { title: 'Recent', items: (recents.candidates || []).slice(0, 4).map((c) => ({ type: 'candidate', ...c })) },
        { title: 'Pages',  items: PAGES.map((p) => ({ type: 'page', ...p })) },
        { title: 'Actions', items: ACTIONS.map((a) => ({ type: 'action', ...a })) },
      ].filter((s) => s.items.length > 0)
    }
    const r = search(q, { limit: 6 })
    return [
      { title: 'Candidates', items: r.candidates.map((x) => ({ ...x, type: 'candidate' })) },
      { title: 'Roles',      items: r.roles.map((x) => ({ ...x, type: 'role' })) },
      { title: 'Stages',     items: r.stages.map((x) => ({ ...x, type: 'stage' })) },
      { title: 'Pages',      items: PAGES.filter((p) => p.label.toLowerCase().includes(q.toLowerCase())).map((p) => ({ ...p, type: 'page' })) },
      { title: 'Actions',    items: ACTIONS.filter((a) => a.label.toLowerCase().includes(q.toLowerCase())).map((a) => ({ ...a, type: 'action' })) },
    ].filter((s) => s.items.length > 0)
  }, [query, search, recents])

  const flat = useMemo(() => sections.flatMap((s) => s.items.map((it) => ({ section: s.title, item: it }))), [sections])

  useEffect(() => { setSelectedIdx(0) }, [query, open])
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
    else setQuery('')
  }, [open])

  const activate = useCallback((entry) => {
    if (!entry) return
    const { item } = entry
    if (item.type === 'candidate' && item.stageId) {
      pushRecent('candidate', { key: item.key || item.name, name: item.name, roleTitle: item.roleTitle, stageId: item.stageId })
      onClose()
      router.push(`/interview/${item.stageId}/transcript?candidate=${encodeURIComponent(item.name || '')}`)
    } else if (item.type === 'role') {
      pushRecent('role', { key: 'role-' + item.id, id: item.id, title: item.title })
      onClose()
      router.push(`/roles/${item.id}`)
    } else if (item.type === 'stage') {
      onClose()
      router.push(`/roles/${item.roleId}?tab=interviews`)
    } else if (item.type === 'page' || item.type === 'action') {
      if (item.href) { onClose(); router.push(item.href) }
    }
  }, [onClose, pushRecent, router])

  useEffect(() => {
    if (!open) return
    function onKey(e) {
      if (e.key === 'Escape')     { e.preventDefault(); onClose() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(flat.length - 1, i + 1)) }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx((i) => Math.max(0, i - 1)) }
      else if (e.key === 'Enter')     { e.preventDefault(); activate(flat[selectedIdx]) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, flat, selectedIdx, activate, onClose])

  // Scroll active item into view
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector(`[data-idx="${selectedIdx}"]`)
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx, open])

  if (!open) return null

  let runningIdx = -1

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh]" role="dialog" aria-modal="true" aria-label="Search and commands">
      <div className="absolute inset-0 bg-[color:rgba(17,17,17,0.42)]" onClick={onClose} />
      <div className="relative w-full max-w-[600px] bg-white border border-[color:var(--color-rc-line)] rounded-[16px] [box-shadow:0_40px_80px_-24px_rgba(17,17,17,0.28)] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[color:var(--color-rc-line)]">
          <Search size={15} className="text-[color:var(--color-rc-muted)]" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="cp-list"
            aria-activedescendant={`cp-opt-${selectedIdx}`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or run a command…"
            className="flex-1 bg-transparent text-[14.5px] text-[color:var(--color-rc-ink)] placeholder:text-[color:var(--color-rc-muted)] placeholder:opacity-70 focus:outline-none"
          />
          <span className="text-[11px] text-[color:var(--color-rc-muted)] font-medium inline-flex items-center gap-1"><Command size={11} aria-hidden="true" />K</span>
        </div>

        <div ref={listRef} id="cp-list" role="listbox" className="max-h-[60vh] overflow-y-auto py-2">
          {sections.length === 0 && (
            <p className="px-4 py-8 text-center text-[13.5px] text-[color:var(--color-rc-muted)]">
              No matches for &ldquo;{query}&rdquo;.
            </p>
          )}
          {sections.map((section) => (
            <div key={section.title}>
              <div className="px-4 pt-3 pb-1 text-[10.5px] uppercase tracking-[0.14em] font-semibold text-[color:var(--color-rc-warm)]">
                {section.title}
              </div>
              {section.items.map((item) => {
                runningIdx++
                const idx = runningIdx
                const selected = idx === selectedIdx
                return (
                  <div
                    key={item.key || (item.type + '-' + (item.id ?? item.name))}
                    id={`cp-opt-${idx}`}
                    data-idx={idx}
                    role="option"
                    aria-selected={selected}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    onClick={() => activate({ item })}
                    className={
                      'mx-2 my-0.5 flex items-center gap-3 px-3 py-2 rounded-[10px] cursor-pointer ' +
                      (selected ? 'bg-[color:var(--color-rc-soft)]' : 'hover:bg-[color:var(--color-rc-soft)]')
                    }
                  >
                    <IconFor type={item.type} hint={item.icon} />
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-medium text-[color:var(--color-rc-ink)] truncate">
                        {item.name || item.title || item.label}
                      </div>
                      <div className="text-[12px] text-[color:var(--color-rc-muted)] truncate">
                        {item.type === 'candidate' && (item.roleTitle ? `${item.roleTitle} · ${item.stageName || ''}` : item.email)}
                        {item.type === 'role'      && (item.department || 'Role')}
                        {item.type === 'stage'     && (item.roleTitle ? `${item.roleTitle}` : 'Stage')}
                        {item.type === 'page'      && item.href}
                        {item.type === 'action'    && (item.href || item.hrefHint || 'Action')}
                      </div>
                    </div>
                    {selected && <ArrowRight size={13} className="text-[color:var(--color-rc-muted)]" aria-hidden="true" />}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="border-t border-[color:var(--color-rc-line)] px-4 py-2 flex items-center gap-4 text-[11px] text-[color:var(--color-rc-muted)]">
          <span>↵ Open</span>
          <span>↑ ↓ Move</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  )
}
