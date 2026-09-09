/**
 * The questions every candidate answers, and which of them count.
 *
 * Two rules live here, and they are the reason this file is shared rather
 * than duplicated in each page:
 *
 * 1. A score is only meaningful if every candidate was measured on the
 *    same thing. The scored set is therefore fixed per stage, never per
 *    candidate.
 *
 * 2. The interview page and the transcript page BOTH call
 *    /api/score-interview, and they used to send different question
 *    lists — the interview page sent the warm-up intro questions too,
 *    the transcript page sent only the recruiter's approved ones. The
 *    same candidate got judged against a different set depending on
 *    which path fired. Both now call scoredQuestionTexts().
 */

/**
 * Opening questions, asked before the recruiter's role questions.
 *
 * NONE of these move the score, and that is deliberate.
 *
 * They exist to settle nerves, give the speech analysis a clean sample,
 * and let the recruiter see who they are dealing with. But how well
 * someone answers them depends mostly on how rehearsed they are at
 * talking about themselves, which is not the job. Scoring them let a
 * confident talker with none of the requirements outrank a quiet one
 * who had them all.
 *
 * They are still recorded, still transcribed, and still shown on the
 * transcript with evidence. They just do not count toward the number.
 */
export const INTRO_QUESTIONS = [
  { text: 'Tell me a little about yourself.', scored: false },
  { text: 'Walk me through your background — what kind of work or experience have you had so far?', scored: false },
  { text: 'What made you interested in applying for this kind of role?', scored: false },
]

/**
 * The exact list handed to /api/score-interview.
 *
 * Only the recruiter's own questions — the ones they picked against a
 * requirement, plus any they wrote themselves — are in here. If that
 * list is ever empty the score has nothing to stand on, and the caller
 * should not be scoring at all.
 *
 * @param {Array<{text: string}|string>} approvedQuestions - the stage's
 *        recruiter-approved questions, in the order they were asked.
 */
export function scoredQuestionTexts(approvedQuestions = []) {
  return [
    ...INTRO_QUESTIONS.filter((q) => q.scored).map((q) => q.text),
    ...approvedQuestions.map((q) => (typeof q === 'string' ? q : q?.text)).filter(Boolean),
  ]
}
