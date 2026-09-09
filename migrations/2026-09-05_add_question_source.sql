-- Distinguish a question the AI drafted against a requirement from one
-- the recruiter typed themselves.
--
-- Both are scored. The difference is the follow-up: an AI question always
-- spawns exactly one, because the drafted wording is a starting point and
-- the follow-up is where the real answer lives. A custom question does
-- not, because the recruiter already asked precisely what they meant to
-- ask, and chasing it with a generated "can you say more about that"
-- reads as the machine second-guessing them.
--
-- It also drives the label on the transcript: an AI question is shown
-- against the requirement it covers, a custom one as "your question".

alter table public.questions
  add column if not exists source text not null default 'ai';

alter table public.questions
  drop constraint if exists questions_source_check;

alter table public.questions
  add constraint questions_source_check
  check (source in ('ai', 'custom'));

comment on column public.questions.source is
  'ai = drafted against a must_have, gets one mandatory follow-up at interview time. custom = the recruiter wrote it, scored but never followed up (the recruiter already asked exactly what they meant to ask).';
