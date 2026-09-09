-- ============================================================================
-- Migration: 2026-09-03 - Which requirement each question came from
-- ============================================================================
--
-- Purpose
--   Shown next to the question on the recruiter's list, so they can see the
--   machine working: five requirements go in, five questions come out, each
--   tagged with the requirement it covers.
--
--   Without it, the jump from "here is what your job description needs" to
--   "here are your questions" is invisible, and the recruiter has no way to
--   tell whether the interview actually covers the role or merely sounds
--   like it does. It is also what makes the resulting score defensible:
--   every number traces to a question, and every question traces to a line
--   in their own job description.
--
-- Safety
--   Nullable. Hand-written questions, and everything drafted before the JD
--   intake existed, simply have no criterion.
--
-- Applied to the hosted project on 2026-09-03.
-- ============================================================================

alter table public.questions
  add column if not exists covers text;
