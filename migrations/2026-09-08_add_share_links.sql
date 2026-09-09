-- Share links: read-only access to one candidate's result for someone
-- who has no account.
--
-- The public read path deliberately does NOT go through RLS. It runs in
-- an API route with the service client, after that route has checked the
-- token is real, unrevoked and unexpired. That means anon must have no
-- policy here at all: if anon could select from this table it could
-- enumerate live tokens, which is the whole secret.

create table if not exists public.share_links (
  id             uuid primary key default gen_random_uuid(),
  token          text not null unique,
  user_id        uuid not null references auth.users(id) on delete cascade,
  stage_id       bigint not null,
  candidate_name text not null,
  label          text,
  include_video  boolean not null default true,
  expires_at     timestamptz,
  revoked_at     timestamptz,
  view_count     integer not null default 0,
  last_viewed_at timestamptz,
  created_at     timestamptz not null default now()
);

comment on table public.share_links is
  'Read-only links to one candidate result. Public reads go through the service client in /api/shared/[token], never through RLS.';
comment on column public.share_links.candidate_name is
  'Always set. A link is scoped to exactly one candidate - never a whole stage.';
comment on column public.share_links.include_video is
  'False hides the recording from the viewer. Some recruiters may share a written result but not a candidate''s face.';

create index if not exists share_links_user_idx  on public.share_links (user_id, created_at desc);
create index if not exists share_links_stage_idx on public.share_links (stage_id, candidate_name);

alter table public.share_links enable row level security;

-- Owner-only. No anon policy on purpose (see the note above).
drop policy if exists share_links_owner_select on public.share_links;
create policy share_links_owner_select on public.share_links
  for select to authenticated using (user_id = auth.uid());

drop policy if exists share_links_owner_insert on public.share_links;
create policy share_links_owner_insert on public.share_links
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists share_links_owner_update on public.share_links;
create policy share_links_owner_update on public.share_links
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists share_links_owner_delete on public.share_links;
create policy share_links_owner_delete on public.share_links
  for delete to authenticated using (user_id = auth.uid());
