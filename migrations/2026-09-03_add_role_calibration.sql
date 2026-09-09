-- ============================================================================
-- Migration: 2026-09-03 - Role calibration
-- ============================================================================
--
-- Purpose
--   What the recruiter knows that the job description does not say.
--
--   A JD is a marketing document written for candidates. It is vague
--   exactly where the useful detail lives, so questions generated from it
--   alone hit a ceiling: the interview can only ever be as good as the
--   document. These fields raise that ceiling.
--
-- Why these four fields and not "tell us more about the role"
--   They are deliberately about HIRING JUDGEMENT, not job trivia. Recrewt
--   sells to staffing agencies, where the recruiter is not the hiring
--   manager: they were handed a JD by a client and had one call about it.
--   Ask them internal operational detail and they genuinely do not know,
--   and the setup screen ends up quizzing them on a role they are supposed
--   to own. That is the fastest way to lose them on their first run.
--
--   Every recruiter, agency or in-house, can answer "what separates a
--   great one from an okay one" and "what would make you say no in five
--   minutes". That is literally their job.
--
-- How it is used
--   Mostly for SCORING, not for writing questions. Over-fitting question
--   wording to one recruiter's anecdote narrows the funnel to candidates
--   who happen to share that background. Same questions for everyone,
--   better-informed judgement of the answers.
--
-- When it is asked
--   AFTER the questions are drafted, never before. Nobody fills in a form
--   before they have seen anything worth improving.
--
-- Applied to the hosted project on 2026-09-03.
-- ============================================================================

alter table public.roles
  add column if not exists flexible_criteria jsonb not null default '[]'::jsonb,
  add column if not exists great_vs_okay     text,
  add column if not exists dealbreakers      text,
  -- backfill | growth | replacement | unknown
  add column if not exists opening_reason    text,
  add column if not exists calibrated_at     timestamptz;
