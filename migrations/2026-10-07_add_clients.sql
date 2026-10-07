-- ============================================================================
-- Migration: 2026-10-07 - Clients
-- ============================================================================
--
-- Purpose
--   Agencies hire for several clients at once. Two "Graphic Designer" roles
--   for two different clients used to sit side by side with nothing telling
--   them apart. Now every role belongs to a client:
--
--     client -> roles -> candidates
--
--   A client is just a name. "about" is optional. When filled, the candidate
--   Q&A answers company questions from it (and from the role's JD), never
--   from the agency's own company profile in settings.
--
-- Backfill
--   Every user who already has roles gets one default client, named after
--   settings.company_name (or "My company"), and all their existing roles
--   are moved under it. Nothing is deleted.
--
-- Safety
--   roles.client_id stays nullable for now so nothing that creates roles
--   breaks before the app code is updated. Deleting a client that still has
--   roles is blocked (on delete restrict) so candidates can't vanish by
--   accident.
--
-- Applied to the hosted project on 2026-10-07. No "drop" statements on
--   purpose: the Supabase connector hangs waiting for a confirmation on them.
--
-- Rollback
--   alter table public.roles drop column if exists client_id;
--   drop table if exists public.clients;
-- ============================================================================

create table if not exists public.clients (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null check (length(btrim(name)) between 1 and 120),
  about      text,
  is_demo    boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.clients is
  'The companies an agency hires for. Each role belongs to one client.';
comment on column public.clients.about is
  'Optional. What the candidate Q&A may say about this company. Empty means it answers from the JD only.';

create index if not exists clients_user_idx on public.clients (user_id, created_at desc);

alter table public.clients enable row level security;

create policy clients_owner_select on public.clients
  for select to authenticated using (user_id = auth.uid());

create policy clients_owner_insert on public.clients
  for insert to authenticated with check (user_id = auth.uid());

create policy clients_owner_update on public.clients
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy clients_owner_delete on public.clients
  for delete to authenticated using (user_id = auth.uid());

alter table public.roles
  add column if not exists client_id uuid references public.clients(id) on delete restrict;

create index if not exists roles_client_idx on public.roles (client_id);

-- Backfill: one default client per user that has roles, then attach the roles.
insert into public.clients (user_id, name, is_demo)
select r.user_id,
       coalesce(nullif(btrim(s.company_name), ''), 'My company'),
       bool_or(r.is_demo)
from public.roles r
left join public.settings s on s.user_id = r.user_id
where r.user_id is not null
  and r.client_id is null
  and not exists (select 1 from public.clients c where c.user_id = r.user_id)
group by r.user_id, s.company_name;

update public.roles r
set client_id = c.id
from (
  select distinct on (user_id) id, user_id
  from public.clients
  order by user_id, created_at asc
) c
where r.client_id is null
  and r.user_id = c.user_id;
