/**
 * Share links — letting somebody without an account read one result.
 *
 * The whole point of an interview result is that somebody else decides
 * on it: the hiring manager, the founder, the client. Until now the only
 * way to show them was to give them the recruiter's login, which also
 * hands over every other candidate, the billing page and the delete
 * button.
 *
 * The rules encoded here:
 *
 *   1. A share link is READ ONLY. There is no write path behind it at
 *      all — the public route uses the service client for a fixed set of
 *      selects and nothing else.
 *   2. It shows ONE candidate in ONE stage. Never a whole pipeline,
 *      never "all my roles". Whoever holds the link sees exactly what
 *      the recruiter chose to send and cannot walk sideways to anything.
 *   3. It never carries private data: no candidate email, no recruiter
 *      notes, no hiring status, no other candidates' names or scores.
 *      A note the recruiter wrote to themselves is not for the client.
 *   4. It can be revoked and it can expire, and both are checked on
 *      every single view, not just at creation.
 *
 * Everything here is pure so it can be tested without a database.
 */

/* ── Token ──────────────────────────────────────────────────────── */

/**
 * 32 random bytes, base64url.
 *
 * Not a uuid: a uuid is 122 bits of entropy but reads as guessable to
 * anyone who has seen one, and these end up pasted into email where a
 * client may forward them onward. Web Crypto rather than node:crypto so
 * this module stays importable from any runtime.
 */
export function newShareToken() {
  const bytes = new Uint8Array(32)
  globalThis.crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Is this string even shaped like one of our tokens?
 *
 * Checked before the database is touched so a scan of /share/<junk>
 * costs a regex rather than a query.
 */
export function looksLikeShareToken(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{20,64}$/.test(value)
}

/* ── Expiry ─────────────────────────────────────────────────────── */

/**
 * What the recruiter may choose. Seven days is the default because a
 * hiring decision that has not been made in a week is a decision that
 * needs a new conversation, not a link that quietly stays open forever.
 */
export const EXPIRY_OPTIONS = [
  { key: '7d',    label: '7 days',  days: 7 },
  { key: '30d',   label: '30 days', days: 30 },
  { key: 'never', label: 'No expiry', days: null },
]

export const DEFAULT_EXPIRY = '7d'

export function expiryFromKey(key, now = new Date()) {
  const opt = EXPIRY_OPTIONS.find((o) => o.key === key)
  if (!opt || opt.days == null) return null
  return new Date(now.getTime() + opt.days * 24 * 60 * 60 * 1000).toISOString()
}

/* ── Usability ──────────────────────────────────────────────────── */

/**
 * Whether a link row may still be viewed, and if not, why.
 *
 * The reason is returned rather than a bare false because the public
 * page says different things for "this was turned off" and "this ran
 * out" — a client who is told the wrong one asks the wrong question.
 */
export function shareLinkState(row, now = new Date()) {
  if (!row) return { ok: false, reason: 'missing' }
  if (row.revoked_at) return { ok: false, reason: 'revoked' }
  if (row.expires_at && new Date(row.expires_at).getTime() <= now.getTime()) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, reason: null }
}

export const STATE_COPY = {
  missing: {
    title: 'This link does not exist',
    body: 'Check you copied the whole thing, or ask whoever sent it for a new one.',
  },
  revoked: {
    title: 'This link was turned off',
    body: 'The person who shared it has revoked access. Ask them for a new link.',
  },
  expired: {
    title: 'This link has expired',
    body: 'Share links stop working after a set time. Ask for a fresh one.',
  },
}

/* ── Payload ────────────────────────────────────────────────────── */

/**
 * Strip a score row down to what an outsider may see.
 *
 * `status` is deliberately dropped. It is the recruiter's own hiring
 * decision, and a hiring manager opening the link to form a view should
 * not be shown the answer first — nor should a candidate, if the link
 * ever reaches one.
 */
export function publicScore(row) {
  if (!row) return null
  return {
    score: row.score ?? null,
    summary: row.summary || null,
    recommendation: row.recommendation || null,
    confidence: row.confidence ?? null,
    confidence_copy: row.confidence_copy || null,
    confidence_reasons: Array.isArray(row.confidence_reasons) ? row.confidence_reasons : [],
    strengths: Array.isArray(row.strengths) ? row.strengths : [],
    concerns: Array.isArray(row.concerns) ? row.concerns : [],
    question_reviews: Array.isArray(row.question_reviews) ? row.question_reviews : [],
  }
}

/**
 * A transcript line, reduced to the two fields that get rendered.
 *
 * `candidate_email`, `token` and `session_id` live on the same rows and
 * must not cross this boundary. Whitelisting rather than deleting means
 * a column added to `interviews` next month is excluded by default
 * instead of leaking until somebody notices.
 */
export function publicLine(line) {
  return {
    id: line?.id ?? null,
    speaker: line?.speaker || null,
    content: line?.content || '',
  }
}

/**
 * What the viewer is told about who sent this.
 *
 * The company name if the recruiter set one, and nothing else. Not their
 * email, not their user id.
 */
export function publicSender(settings) {
  const name = String(settings?.company_name || '').trim()
  return name ? { companyName: name } : {}
}
