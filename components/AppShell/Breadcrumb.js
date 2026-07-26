'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePathname, useParams } from 'next/navigation'
import { useNavHistory } from './NavHistoryContext'
import { labelForRoute } from './route-config'

/**
 * Breadcrumb — path-aware, uses in-memory nav history so the trail
 * reflects the actual path taken (not a static parent hierarchy).
 *
 * The label resolver is provided by the caller via a routeLabels map
 * (e.g. { '/roles/12': 'Frontend Engineer' }).  Falls back to the
 * route-config label otherwise.
 */

function segmentsFromPath(pathname) {
  if (!pathname) return []
  return pathname.split('/').filter(Boolean)
}

function isDeepPath(pathname) {
  const seg = segmentsFromPath(pathname)
  return seg.length >= 2  // /roles/12, /interview/9/transcript, etc.
}

export default function Breadcrumb({ labels = {} }) {
  const pathname = usePathname()
  const params = useParams()
  const { stack } = useNavHistory()

  const path = useMemo(() => {
    // Take the last 4 entries of history; ensure current is last.
    const trimmed = stack.slice(-4)
    const current = pathname
    const withCurrent = trimmed[trimmed.length - 1] === current ? trimmed : [...trimmed, current]
    return withCurrent
  }, [stack, pathname])

  if (!isDeepPath(pathname)) {
    // On top-level pages (Dashboard, Roles, etc.) render nothing —
    // the sidebar already tells the recruiter where they are.
    return null
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex items-center gap-1.5 text-[13px] text-[color:var(--color-rc-muted)]">
        {path.map((p, i) => {
          const isLast = i === path.length - 1
          const label = labels[p] || labelForRoute(p) || 'Page'
          return (
            <li key={p + '-' + i} className="flex items-center gap-1.5 min-w-0">
              {i > 0 && <span aria-hidden="true" className="opacity-60">/</span>}
              {isLast ? (
                <span aria-current="page" className="text-[color:var(--color-rc-ink)] font-medium truncate max-w-[24ch]">
                  {label}
                </span>
              ) : (
                <Link href={p} className="hover:text-[color:var(--color-rc-ink)] transition-colors truncate max-w-[18ch]">
                  {label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
