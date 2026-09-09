-- ============================================================================
-- Migration: 2026-09-02 — JD-first intake: job description + confirmed criteria
-- ============================================================================
--
-- Purpose
--   Role setup starts from a job description instead of a blank form. The
--   recruiter uploads the JD, the AI extracts what the role needs, and the
--   recruiter confirms or corrects it. These columns hold that confirmed
--   result.
--
--   They are the single source of truth for BOTH question generation and
--   resume ranking, which is what makes a score defensible: every criterion
--   a candidate is measured against traces back to something the recruiter
--   agreed the job requires.
--
-- Safety
--   Every column is nullable or defaulted, so roles created before this
--   migration keep working untouched and the old create-role form still
--   inserts successfully.
--
-- Applied to the hosted project on 2026-09-02.
-- ============================================================================

alter table public.roles
  add column if not exists jd_text          text,
  add column if not exists must_haves       jsonb not null default '[]'::jsonb,
  add column if not exists nice_to_haves    jsonb not null default '[]'::jsonb,
  add column if not exists salary_range     text,
  -- What a candidate is told when they ask about pay. Agency recruiters
  -- often must not reveal a client's budget, so this is the recruiter's
  -- call per role, never a default the product makes on their behalf.
  add column if not exists salary_visibility text not null default 'hide',
  add column if not exists intake_confirmed_at timestamptz;

alter table public.roles
  drop constraint if exists roles_salary_visibility_check;

alter table public.roles
  add constraint roles_salary_visibility_check
  check (salary_visibility in ('hide', 'show', 'defer'));

comment on column public.roles.must_haves is
  'Confirmed requirements. Each entry {label, weight}. Drives question generation and resume ranking.';
comment on column public.roles.salary_visibility is
  'hide = never tell the candidate; show = state the range; defer = "discussed at the next stage".';
