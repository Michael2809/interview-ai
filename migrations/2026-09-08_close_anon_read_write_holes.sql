-- Anonymous access was far wider than the candidate interview needs.
--
-- The anon key is embedded in the browser bundle, so it is public by
-- definition. Every policy below granted that public key rights over
-- every customer's data:
--
--   interviews_select_anon  select using (true)  -- every transcript line,
--                                                -- candidate name, candidate
--                                                -- email and video URL in the
--                                                -- entire database
--   stages_select_anon      select using (true)
--   questions_select_anon   select using (true)
--   allow anon upsert scores  update using (true) -- rewrite anyone's score
--   allow anon insert scores  insert
--
-- What the candidate interview page actually does as anon, verified by
-- reading every Supabase call in app/interview/[stageId]/page.js:
--   * INSERT into interviews (transcript lines, video row, audio row)
--   * nothing else
-- Its stage, role and questions come from /api/interview-context, and
-- its score from /api/score-interview - both service-role routes. The
-- completion update moved to /api/interview-complete for the same reason.
--
-- So anon keeps exactly one permission in this database: inserting
-- interview rows. No reads at all.

drop policy if exists "interviews_select_anon"    on public.interviews;
drop policy if exists "stages_select_anon"        on public.stages;
drop policy if exists "questions_select_anon"     on public.questions;
drop policy if exists "allow anon upsert scores"  on public.scores;
drop policy if exists "allow anon insert scores"  on public.scores;

-- Redundant duplicate of interviews_insert_auth, same role and effect.
drop policy if exists "allow insert interviews"   on public.interviews;
