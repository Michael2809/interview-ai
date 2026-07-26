'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * SearchIndexContext — a small client-side index of candidates, roles,
 * and stages that the command palette searches over.  Refreshed on mount
 * and every 60 seconds.  Ranked by exact > prefix > substring, with
 * recents lifted to the top.
 */

const REFRESH_MS = 60_000
const RECENTS_KEY = 'recrewt:v2:recents'
const MAX_RECENTS = 20

const SearchIndexContext = createContext(null)

function readRecents() {
  if (typeof window === 'undefined') return { candidates: [], roles: [], stages: [], searches: [] }
  try {
    const raw = window.localStorage.getItem(RECENTS_KEY)
    return raw ? JSON.parse(raw) : { candidates: [], roles: [], stages: [], searches: [] }
  } catch { return { candidates: [], roles: [], stages: [], searches: [] } }
}

function writeRecents(next) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(RECENTS_KEY, JSON.stringify(next)) } catch {}
}

function normalise(s) { return String(s || '').toLowerCase() }

function scoreMatch(hay, needle) {
  const h = normalise(hay)
  const n = normalise(needle)
  if (!n) return 0
  if (h === n) return 100
  if (h.startsWith(n)) return 80
  if (h.includes(' ' + n)) return 60
  if (h.includes(n)) return 40
  return 0
}

export function SearchIndexProvider({ children }) {
  const supabase = createClient()
  const [index, setIndex] = useState({ candidates: [], roles: [], stages: [] })
  const [recents, setRecents] = useState(() => readRecents())
  const timerRef = useRef(null)

  const refresh = useCallback(async () => {
    const [rolesRes, stagesRes, interviewsRes, scoresRes] = await Promise.all([
      supabase.from('roles').select('id, title, department, status').limit(500),
      supabase.from('stages').select('id, role_id, name, position').limit(1000),
      supabase.from('interviews').select('stage_id, candidate_name, candidate_email, speaker').limit(4000),
      supabase.from('scores').select('stage_id, candidate_name, score, status').limit(4000),
    ])
    const roles = rolesRes.data || []
    const stages = stagesRes.data || []
    const interviews = interviewsRes.data || []
    const scores = scoresRes.data || []

    // Candidates: unique by email or candidate_name
    const seen = new Map()
    interviews.forEach((r) => {
      const key = (r.candidate_email || r.candidate_name || '').toLowerCase()
      if (!key) return
      const stage = stages.find((s) => s.id === r.stage_id)
      const role = stage ? roles.find((rr) => rr.id === stage.role_id) : null
      const score = scores.find((s) => String(s.stage_id) === String(r.stage_id) && (s.candidate_name || '').toLowerCase() === (r.candidate_name || '').toLowerCase())
      if (!seen.has(key)) {
        seen.set(key, {
          type: 'candidate',
          key,
          name: r.candidate_name || r.candidate_email,
          email: r.candidate_email || '',
          stageId: r.stage_id,
          stageName: stage?.name || null,
          roleId: stage?.role_id || null,
          roleTitle: role?.title || null,
          score: score?.score ?? null,
          status: score?.status ?? null,
        })
      }
    })

    setIndex({
      candidates: Array.from(seen.values()),
      roles: roles.map((r) => ({
        type: 'role',
        key: 'role-' + r.id,
        id: r.id,
        title: r.title || 'Untitled role',
        department: r.department || null,
        status: r.status || 'active',
      })),
      stages: stages.map((s) => {
        const role = roles.find((rr) => rr.id === s.role_id)
        return {
          type: 'stage',
          key: 'stage-' + s.id,
          id: s.id,
          name: s.name || 'Untitled stage',
          roleId: s.role_id,
          roleTitle: role?.title || null,
          position: s.position,
        }
      }),
    })
  }, [supabase])

  useEffect(() => {
    refresh()
    timerRef.current = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(timerRef.current)
  }, [refresh])

  const search = useCallback((query, { limit = 8 } = {}) => {
    const q = query.trim()
    const buckets = { candidates: [], roles: [], stages: [] }
    if (!q) return buckets

    const push = (bucket, item, score) => {
      if (score <= 0) return
      buckets[bucket].push({ item, score })
    }

    index.candidates.forEach((c) => {
      const best = Math.max(scoreMatch(c.name, q), scoreMatch(c.email, q))
      push('candidates', c, best)
    })
    index.roles.forEach((r) => {
      const best = Math.max(scoreMatch(r.title, q), scoreMatch(r.department, q))
      push('roles', r, best)
    })
    index.stages.forEach((s) => {
      const best = Math.max(scoreMatch(s.name, q), scoreMatch(s.roleTitle, q))
      push('stages', s, best)
    })

    for (const k of Object.keys(buckets)) {
      buckets[k].sort((a, b) => b.score - a.score)
      buckets[k] = buckets[k].slice(0, limit).map((x) => x.item)
    }
    return buckets
  }, [index])

  const pushRecent = useCallback((type, item) => {
    setRecents((prev) => {
      const bucket = prev[type + 's'] || []
      const key = item.key || item.id || item.name || JSON.stringify(item)
      const filtered = bucket.filter((x) => (x.key || x.id || x.name) !== key)
      const next = { ...prev, [type + 's']: [item, ...filtered].slice(0, MAX_RECENTS) }
      writeRecents(next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ index, recents, search, refresh, pushRecent }), [index, recents, search, refresh, pushRecent])
  return <SearchIndexContext.Provider value={value}>{children}</SearchIndexContext.Provider>
}

export function useSearchIndex() {
  const ctx = useContext(SearchIndexContext)
  if (!ctx) throw new Error('SearchIndexContext missing — wrap in <SearchIndexProvider>')
  return ctx
}
