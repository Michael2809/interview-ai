'use client'

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { primaryForRoute } from './route-config'

/**
 * ContextualPrimaryContext — every page can register (label, onClick,
 * shortcut) for the header's right-slot primary CTA.  When the page
 * unmounts we clear the registration, so the header falls back to the
 * route's static default from route-config.
 *
 * Pages call:  useContextualPrimary({ label, onClick, shortcut, disabled })
 * Header reads: usePrimary()
 */

const ContextualPrimaryContext = createContext(null)

export function ContextualPrimaryProvider({ children }) {
  const [registration, setRegistration] = useState(null)
  const pathname = usePathname()

  const set = useCallback((next) => setRegistration(next), [])
  const clear = useCallback(() => setRegistration(null), [])

  const fallback = useMemo(() => {
    const p = primaryForRoute(pathname)
    if (!p) return null
    return { label: p.label, href: p.href, disabled: false }
  }, [pathname])

  const value = useMemo(() => ({
    set, clear,
    primary: registration || fallback,
  }), [set, clear, registration, fallback])

  return <ContextualPrimaryContext.Provider value={value}>{children}</ContextualPrimaryContext.Provider>
}

export function useContextualPrimary(spec) {
  const ctx = useContext(ContextualPrimaryContext)
  useEffect(() => {
    if (!ctx || !spec) return
    ctx.set(spec)
    return () => ctx.clear()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec?.label, spec?.href, spec?.disabled, spec?.shortcut])
}

export function usePrimary() {
  const ctx = useContext(ContextualPrimaryContext)
  return ctx?.primary || null
}
