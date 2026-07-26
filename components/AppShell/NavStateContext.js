'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'

/**
 * NavStateContext — persistent per-route memory of filters, tabs, scroll,
 * selection.  Persisted to localStorage under one namespaced key per user
 * session.  Cleared on sign-out (call clearNavState() from the logout flow).
 *
 * Hooks:
 *   useListState(key, defaultValue)     — filter / search / sort per page
 *   useTabState(key, tabs, defaultTab)  — remembered tab per page
 *   useScrollRestore(key)               — restore scroll after data render
 *   useSelectionState(key)              — bulk selection sets per page
 */

const STORAGE_KEY = 'recrewt:v2:nav'

const NavStateContext = createContext(null)

function readAll() {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeAll(next) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch {}
}

export function clearNavState() {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(STORAGE_KEY) } catch {}
}

export function NavStateProvider({ children }) {
  // Start empty on BOTH server and client so the first paint agrees.
  // We hydrate from localStorage in a mount-only effect so React
  // doesn't see a mismatch between the SSR HTML and the client tree.
  const [state, setState] = useState({})
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])

  // One-shot hydration after mount. Any persisted values (like the
  // collapsed sidebar) now flow in and trigger a normal re-render.
  useEffect(() => {
    const persisted = readAll()
    if (persisted && Object.keys(persisted).length > 0) {
      setState(persisted)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setSlice = useCallback((key, value) => {
    setState((prev) => {
      const next = { ...prev, [key]: typeof value === 'function' ? value(prev[key]) : value }
      writeAll(next)
      return next
    })
  }, [])

  const getSlice = useCallback((key) => stateRef.current[key], [])

  return (
    <NavStateContext.Provider value={{ getSlice, setSlice, state }}>
      {children}
    </NavStateContext.Provider>
  )
}

function useCtx() {
  const ctx = useContext(NavStateContext)
  if (!ctx) throw new Error('NavStateContext missing — wrap the app in <NavStateProvider>')
  return ctx
}

export function useListState(key, defaultValue) {
  const { getSlice, setSlice } = useCtx()
  const initial = getSlice(key) ?? defaultValue
  const [local, setLocal] = useState(initial)
  const update = useCallback((next) => {
    const val = typeof next === 'function' ? next(local) : next
    setLocal(val)
    setSlice(key, val)
  }, [key, local, setSlice])
  return [local, update]
}

export function useTabState(key, tabs, defaultTab) {
  const { getSlice, setSlice } = useCtx()
  const stored = getSlice(key)
  const initial = tabs.includes(stored) ? stored : defaultTab
  const [tab, setTab] = useState(initial)
  const update = useCallback((next) => {
    if (!tabs.includes(next)) return
    setTab(next)
    setSlice(key, next)
  }, [key, tabs, setSlice])
  return [tab, update]
}

/**
 * useSidebarCollapsed — global boolean stored under `sidebar:collapsed`.
 *
 * Reads directly from the shared context state (not via `useListState`,
 * which keeps a per-consumer local copy). Every component that calls
 * this hook re-renders when the value changes, so the AppShell's
 * outer `<aside>` width stays in lockstep with the toggle button.
 */
const SIDEBAR_KEY = 'sidebar:collapsed'
export function useSidebarCollapsed() {
  const { state, setSlice } = useCtx()
  const collapsed = !!state[SIDEBAR_KEY]
  const set = useCallback(
    (next) => {
      const value = typeof next === 'function' ? next(collapsed) : next
      setSlice(SIDEBAR_KEY, value)
    },
    [collapsed, setSlice],
  )
  return [collapsed, set]
}
