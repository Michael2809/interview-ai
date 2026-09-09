/**
 * Hiring decisions are made by people, not by the scorer.
 *
 * `scores.status` starts at 'pending' and only a recruiter's click moves it
 * to one of DECISION_STATUSES. Anything asking "has anyone decided about
 * this candidate yet?" must go through hasDecision() rather than testing
 * for a falsy status: 'pending' is truthy, and rows written before this
 * change may still carry null or ''.
 */

export const DECISION_STATUSES = ['shortlisted', 'on-hold', 'rejected']

/** True when a human has recorded a decision for this candidate. */
export function hasDecision(status) {
  return DECISION_STATUSES.includes(status)
}

/** True when the interview is done but nobody has decided yet. */
export function awaitingDecision(status) {
  return !hasDecision(status) && status !== 'archived'
}
