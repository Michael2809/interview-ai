/**
 * Presentation helpers for candidate identity.
 *
 * The app uses composite keys like `anon:<stage_id>|<name>` and
 * `<stage_id>|<name>` internally to join transcript rows with
 * invites, scores, and questions. Those identifiers must NEVER
 * reach recruiter-facing UI — but they've historically leaked
 * because "email" was overloaded as a stable dedup key for
 * transcripts with no invite.
 *
 * This module is presentation-only. Do not use it for lookups,
 * joins, routing, or API requests — those must continue to use
 * the underlying identifiers as before.
 */

const ANON_PREFIX = /^anon:/i

/**
 * True if `v` is an internal composite / synthesized key, not a
 * real recruiter-visible email. Rejects:
 *   • Any string starting with `anon:`
 *   • Any string containing `|` (composite key separator) unless
 *     it also has `@` (extremely permissive local-part allowance)
 *   • Empty / non-string values
 */
export function isInternalCandidateId(v) {
  if (v == null) return true
  const s = String(v).trim()
  if (!s) return true
  if (ANON_PREFIX.test(s)) return true
  if (s.includes('|') && !s.includes('@')) return true
  return false
}

/**
 * Trim + reject empty. Returns null when the string is unusable.
 */
function cleanString(v) {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s || null
}

/**
 * Canonical display-name priority:
 *   1. Real candidate name
 *   2. Real candidate email (not an internal id)
 *   3. "Anonymous Candidate"
 *
 * Accepts either a candidate-shaped object ({ name, email }) or
 * two arguments (name, email) so callers can pass raw fields
 * without wrapping them.
 */
export function getCandidateDisplayName(candidateOrName, maybeEmail) {
  let name, email
  if (candidateOrName && typeof candidateOrName === 'object') {
    name = cleanString(candidateOrName.name)
    email = cleanString(candidateOrName.email)
  } else {
    name = cleanString(candidateOrName)
    email = cleanString(maybeEmail)
  }
  if (name && !isInternalCandidateId(name)) return name
  if (email && !isInternalCandidateId(email)) return email
  return 'Anonymous Candidate'
}

/**
 * The email safe to render alongside the name. Returns null when
 * the underlying field is an internal id — the UI should render
 * nothing rather than surface a composite key.
 */
export function getCandidateDisplayEmail(candidateOrEmail) {
  const email = candidateOrEmail && typeof candidateOrEmail === 'object'
    ? cleanString(candidateOrEmail.email)
    : cleanString(candidateOrEmail)
  if (!email) return null
  if (isInternalCandidateId(email)) return null
  return email
}

/**
 * Two-letter initials from the display name. Falls back to '?' so
 * avatar bubbles never render a composite key like `an` from
 * `anon:1|minne`.
 */
export function getCandidateInitials(candidateOrName, maybeEmail) {
  const display = getCandidateDisplayName(candidateOrName, maybeEmail)
  if (display === 'Anonymous Candidate') return '?'
  return display
    .split(/[\s@._+-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'
}
