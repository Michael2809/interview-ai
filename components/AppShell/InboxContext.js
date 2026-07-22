'use client'

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * InboxContext — the recruiter's activity timeline.  Polling by default
 * (60s); realtime upgrade wires the subscription when the app boots.
 *
 * State exposed:
 *   items:         Array of notifications, newest-first
 *   unreadCount:   Number of items with read_at IS NULL
 *   loading:       Boolean, only true on first mount
 *   openDrawer:    () => void
 *   closeDrawer:   () => void
 *   drawerOpen:    Boolean
 *   markAllRead:   () => Promise<void>
 *   markRead:      (id) => Promise<void>
 *   refresh:       () => Promise<void>
 */

const POLL_MS = 60_000
const MAX_ITEMS = 200

const InboxContext = createContext(null)

export function InboxProvider({ children }) {
  const supabase = createClient()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const timerRef = useRef(null)
  const channelRef = useRef(null)

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_ITEMS)
    setItems(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, POLL_MS)

    // Optional realtime — falls through gracefully if not enabled.
    try {
      channelRef.current = supabase
        .channel('recrewt:notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => setItems((prev) => [payload.new, ...prev].slice(0, MAX_ITEMS)))
        .subscribe()
    } catch {}

    return () => {
      clearInterval(timerRef.current)
      try { channelRef.current && supabase.removeChannel(channelRef.current) } catch {}
    }
  }, [refresh, supabase])

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  }, [supabase])

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString()
    setItems((prev) => prev.map((n) => n.read_at ? n : { ...n, read_at: now }))
    await supabase.from('notifications').update({ read_at: now }).is('read_at', null)
  }, [supabase])

  const openDrawer = useCallback(() => setDrawerOpen(true), [])
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  const unreadCount = useMemo(() => items.filter((n) => !n.read_at).length, [items])

  const value = useMemo(() => ({
    items, unreadCount, loading, drawerOpen,
    openDrawer, closeDrawer, markRead, markAllRead, refresh,
  }), [items, unreadCount, loading, drawerOpen, openDrawer, closeDrawer, markRead, markAllRead, refresh])

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>
}

export function useInbox() {
  const ctx = useContext(InboxContext)
  if (!ctx) throw new Error('InboxContext missing — wrap in <InboxProvider>')
  return ctx
}
