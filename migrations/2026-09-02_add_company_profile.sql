-- ============================================================================
-- Migration: 2026-09-02 - Company profile for the candidate Q&A
-- ============================================================================
--
-- Purpose
--   At the end of an interview the AI asks "any questions for us?" and
--   answers whatever the candidate asks. These columns are the ONLY source
--   it may answer from.
--
--   The AI answers closed-book. If a candidate asks something these fields
--   do not cover, it says so plainly and logs the question for the recruiter
--   rather than inventing an answer.
--
--   That constraint is the entire design. A hallucinated headcount is
--   embarrassing. A hallucinated salary or start date is a candidate holding
--   a screenshot of a promise the recruiter never made, about a client budget
--   the recruiter may not even be allowed to disclose.
--
--   Filled once per workspace during onboarding, reused for every role.
--   Pay is deliberately NOT here: it is per-role, and whether to disclose it
--   is per-role too (see roles.salary_visibility).
--
-- Safety
--   All columns nullable. An empty profile simply means the AI can answer
--   fewer questions; it never means it guesses.
--
-- Applied to the hosted project on 2026-09-02.
-- ============================================================================

alter table public.settings
  add column if not exists company_about     text,
  add column if not exists company_headcount text,
  add column if not exists work_model        text,
  add column if not exists working_hours     text,
  add column if not exists hiring_process    text,
  add column if not exists benefits          text;
