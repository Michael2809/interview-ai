# Demo workspace — Meridian Cloud

A permanent, seeded Recrewt AI account used for product videos, screenshots,
Product Hunt, investor decks, and sales demos. It's a real account in the
production Supabase project, isolated the same way every account is
isolated — Supabase RLS scopes every table by `user_id`/`auth.uid()`, so
this workspace structurally cannot see production data and production
accounts cannot see it. No app code was changed to build this — it's just
data.

## Logging in

- Email: `DEMO_ACCOUNT_EMAIL` in `.env.local` (default `demo@recrewtai.com`)
- Password: `DEMO_ACCOUNT_PASSWORD` in `.env.local`

Log in at `/login` like any other account. Nothing in the UI marks it as a
demo — that's deliberate, so screenshots and recordings look like a real
customer workspace.

## What's seeded

One fictional company, **Meridian Cloud**, with:

- 8 roles across Engineering, Design, Sales, Customer Success, and Data —
  a mix of `active`, one `paused`, and two `archived` (filled) roles, so
  the Roles page shows real lifecycle variety.
- 30 candidates with distinct names, backgrounds, and full interview
  transcripts (or, for a few, just an open invite — some candidates are
  mid-funnel on purpose).
- AI evaluations for every completed interview: score, recommendation,
  confidence + reasons, strengths/concerns, and a per-question breakdown.
  Every quoted "evidence" line is a real substring of that candidate's
  transcript answer — checked by the seed script before it writes
  anything.
- A handful of recruiter notes and ~35 inbox notifications spread across
  the timeline.
- A complimentary, permanently-active paid subscription (highest plan
  available in the live `plans` table) — every premium feature is
  unlocked and nothing will show a paywall or trial-expiry nag mid-demo.

Timestamps span roughly the last six months, with a few candidates
completed in the last day and a couple of stale, un-answered invites —
so the dashboard's "needs attention," "upcoming interviews," and "recent
activity" panels all have something real to show.

## Refreshing before a recording

Timestamps are stored as "N days ago *relative to when you last seeded*,"
so a workspace seeded three weeks ago will start looking stale. Re-run the
seed before anything time-sensitive (a launch video, a live demo):

```bash
npm run demo:seed
```

This is fully idempotent — it deletes only rows belonging to the demo
account's own `user_id` (roles → stages → questions/interviews/scores/
notes, notifications, subscription/usage/billing-event rows), then
re-inserts everything fresh from `scripts/demo/fixtures.mjs`. It never
touches any other account.

## Editing the story

All the content — company name, roles, candidate names/backgrounds,
transcripts, scores — lives in `scripts/demo/fixtures.mjs`. It's plain
data, no seeding logic, so it's safe to edit directly. Re-run
`npm run demo:seed` after any change.

## Safety notes

- The seed script (`scripts/demo/seed-demo.mjs`) uses the Supabase
  **service-role key** and must only ever be run from a trusted machine/CI
  — never expose it as a public API route.
- `DEMO_ACCOUNT_PASSWORD` lives in `.env.local` only (git-ignored). Don't
  commit it or paste it anywhere public.
- Every delete in the seed script is scoped to id sets fetched from the
  demo account's own rows first — it cannot cascade into another
  account's data even if RLS were somehow misconfigured.
- An optional `migrations/2026-08-08_add_is_demo_flag.sql` adds an
  `is_demo` boolean to `roles`/`settings` for easy auditing. It's not
  required for isolation (RLS already guarantees that) and the seed
  script doesn't depend on it — apply it whenever convenient.
