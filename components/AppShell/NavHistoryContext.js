'use client'

import { createContext, useContext, useEffect, useRef, useState, useMemo } from 'react'
import { usePathname } from 'next/navigation'

/**
 * NavHistoryContext — in-memory record of where the recruiter came from.
 * Powers breadcrumbs that reflect the *actual* path, not the hierarchical
 * parent.  Cleared on sign-out.
 */

const MAX_HISTORY = 20
const NavHistoryContext = createContext(null)

export function NavHistoryProvider({ children }) {
  const pathname = usePathname()
  const [stack, setStack] = useState([])
  const lastPushRef = useRef(null)

  useEffect(() => {
    if (!pathname) return
    if (lastPushRef.current === pathname) return
    lastPushRef.current = pathname
    setStack((prev) => {
      const next = prev.length && prev[prev.length - 1] === pathname ? prev : [...prev, pathname]
      return next.slice(-MAX_HISTORY)
    })
  }, [pathname])

  const value = useMemo(() => ({ stack, pathname }), [stack, pathname])
  return <NavHistoryContext.Provider value={value}>{children}</NavHistoryContext.Provider>
}

export function useNavHistory() {
  const ctx = useContext(NavHistoryContext)
  if (!ctx) throw new Error('NavHistoryContext missing — wrap in <NavHistoryProvider>')
  return ctx
}
