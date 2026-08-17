-- ============================================================================
-- Migration: 2026-08-08 — Add `is_demo` flag to public.roles and public.settings
-- ============================================================================
--
-- Purpose
--   Optional, defense-in-depth marker for the permanent demo workspace
--   (see docs/demo-mode.md, scripts/demo/seed-demo.mjs). Isolation is
--   already guaranteed by Supabase RLS — every table is scoped by
--   user_id/auth.uid(), so the demo account structurally cannot see or
--   be seen by production accounts regardless of this column. This flag
--   exists purely so a human (or a future audit query) can answer
--   "which rows belong to the demo workspace?" without cross-referencing
--   the demo account's user_id by hand.
--
--   NOT required for the seed script to run — seed-demo.mjs does not
--   set or depend on this column. Apply it whenever convenient.
--
-- How to run
--   Open Supabase Studio → SQL editor → paste this file → Run.
--   Safe to re-run: every statement is IF NOT EXISTS / conditional.
--
-- Rollback
--   ALTER TABLE public.roles DROP COLUMN IF EXISTS is_demo;
--   ALTER TABLE public.settings DROP COLUMN IF EXISTS is_demo;
-- ============================================================================

ALTER TABLE public.roles
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS roles_is_demo_idx
  ON public.roles(is_demo)
  WHERE is_demo = true;

-- ============================================================================
-- Done. To backfill after seeding the demo workspace once:
--   UPDATE public.roles    SET is_demo = true WHERE user_id = '<demo user id>';
--   UPDATE public.settings SET is_demo = true WHERE user_id = '<demo user id>';
-- ============================================================================
