/**
 * How a stage's questions are shaped for the recruiter, and how long the
 * resulting interview actually is.
 *
 * This lives in lib/ rather than in the page because the length estimate
 * is a promise made to a recruiter about how much of a candidate's
 * evening they are about to spend. It is worth a test.
 */

/**
 * Seventy seconds per recorded answer.
 *
 * Every AI question counts twice because it always spawns exactly one
 * follow-up. The three openers count too — they are recorded and
 * transcribed, they just do not move the score. Custom questions count
 * once: the recruiter asked precisely what they meant to ask, so nothing
 * follows up on them.
 */
export const SECONDS_PER_ANSWER = 70
export const OPENING_ANSWERS = 3

export function interviewShape(approved = []) {
  const ai = approved.filter((q) => q?.source !== 'custom').length
  const custom = approved.length - ai
  const answers = OPENING_ANSWERS + ai * 2 + custom
  return {
    ai,
    custom,
    picked: ai + custom,
    answers,
    minutes: Math.round((answers * SECONDS_PER_ANSWER) / 60),
  }
}

/**
 * How many questions a recruiter may write themselves.
 *
 * Two, not unlimited. The drafted questions are written against
 * requirements the recruiter confirmed, so they are comparable across
 * candidates and defensible afterwards; a custom question is neither,
 * it is just a question. A couple of them is a recruiter adding the
 * thing only they know to ask. Ten of them is the blank-list product
 * this replaced, with a longer interview and a score that no longer
 * means what the page says it means.
 */
export const CUSTOM_QUESTION_LIMIT = 2

export function customQuestionCount(questions = []) {
  return questions.filter((q) => q?.source === 'custom').length
}

export function canAddCustomQuestion(questions = []) {
  return customQuestionCount(questions) < CUSTOM_QUESTION_LIMIT
}

/**
 * Split a stage's questions into the three things the page draws.
 *
 * `groups`   — pairs written for a confirmed requirement. Two questions
 *              share a `covers` string, and that is what pairs them.
 * `untagged` — drafted questions with no requirement behind them: roles
 *              created before we tracked requirements, and the prose
 *              fallback. Still asked, still scored.
 * `custom`   — the recruiter's own.
 *
 * Untagged questions are deliberately NOT rendered as one-option groups.
 * A radio with a single choice and a "skip" is a checkbox wearing a
 * costume, and labelling six cards in a row "General competency" makes a
 * working page look broken. They get a plain list under a heading that
 * says why they have no requirement.
 */
export function groupQuestions(questions = []) {
  const custom = questions.filter((q) => q?.source === 'custom')
  const untagged = []
  const groups = []
  const byCriterion = new Map()
  for (const q of questions.filter((q) => q?.source !== 'custom')) {
    if (!q.covers) {
      untagged.push(q)
      continue
    }
    if (!byCriterion.has(q.covers)) {
      const g = { key: q.covers, covers: q.covers, options: [] }
      byCriterion.set(q.covers, g)
      groups.push(g)
    }
    byCriterion.get(q.covers).options.push(q)
  }
  return { groups, untagged, custom }
}
