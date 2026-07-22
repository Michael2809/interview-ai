-- ============================================================================
-- Migration: 2026-07-18 — Add `status` column to public.roles
-- ============================================================================
--
-- Purpose
--   The Roles v2 screen groups roles by lifecycle stage:
--     • Active   — hiring in flight
--     • Paused   — recruiter temporarily not accepting new invites
--     • Archived — role closed, data preserved for future reference
--
--   We store this on the roles row itself so the list can be filtered and
--   grouped without a join.
--
-- How to run
--   Open Supabase Studio → SQL editor → paste this file → Run.
--   Safe to re-run: every statement is IF NOT EXISTS / conditional.
--
-- Rollback
--   ALTER TABLE public.roles DROP COLUMN IF EXISTS status;
--   DROP INDEX IF EXISTS roles_status_idx;
-- ============================================================================

-- 1. Add the column with a sane default and a check constraint.
--    New roles default to 'active'. Existing rows are backfilled below.
ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

-- 2. Enforce the enum-like set of values at the DB layer.
--    Guarded so a re-run doesn't fail on the duplicate constraint name.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'roles_status_check'
  ) THEN
    ALTER TABLE public.roles
      ADD CONSTRAINT roles_status_check
      CHECK (status IN ('active', 'paused', 'archived'));
  END IF;
END $$;

-- 3. Backfill defensively — DEFAULT handles new inserts and the ADD COLUMN
--    step, but this covers any pre-existing NULLs from an earlier partial run.
UPDATE public.roles
  SET status = 'active'
  WHERE status IS NULL;

-- 4. Index for the common filter — "list all Active roles for user X".
CREATE INDEX IF NOT EXISTS roles_status_idx
  ON public.roles(status);

-- 5. Compound index for the most common query — Active roles per user,
--    ordered by created_at DESC.  Skip if roles.user_id doesn't exist yet
--    on this project; add later.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'user_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS roles_user_status_idx
      ON public.roles(user_id, status, created_at DESC);
  END IF;
END $$;

-- ============================================================================
-- Done.  Verify with:
--   SELECT status, COUNT(*) FROM public.roles GROUP BY status;
-- ============================================================================
