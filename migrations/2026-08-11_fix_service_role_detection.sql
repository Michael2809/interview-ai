-- ============================================================================
-- Migration: 2026-08-11 — Fix service-role detection in record_candidate_invite
--                          and tg_subscriptions_client_guard
-- ============================================================================
--
-- Purpose
--   Both functions detected a service-role caller with:
--
--     current_setting('request.jwt.claim.role', true) = 'service_role'
--
--   That flattened, per-claim GUC (`request.jwt.claim.role`) is not
--   populated for service-role requests on this project's PostgREST
--   setup — only the consolidated JSON GUC (`request.jwt.claims`) is.
--   Supabase's own built-in `auth.role()` helper already checks both:
--
--     coalesce(
--       nullif(current_setting('request.jwt.claim.role', true), ''),
--       (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
--     )::text
--
--   so the hand-rolled check always evaluated to `false` for genuine
--   service-role callers, sending both functions down their non-service
--   -role branch. For record_candidate_invite that meant every
--   service-role invocation (e.g. app/api/send-invite/route.js) hit
--   `auth.uid() is null` and raised `auth required` (42501) — confirmed
--   live via a real failed invite attempt. tg_subscriptions_client_guard
--   has the identical pattern guarding every UPDATE to `subscriptions`,
--   so legitimate service-role subscription writes (plan changes,
--   renewals) are exposed to the same failure mode.
--
--   Fix: replace the hand-rolled GUC check with auth.role() in both
--   functions. No other logic, grants, ownership, or security mode
--   changes. Confirmed against the live function source via read-only
--   introspection before writing this file — not a guessed definition.
--
--   APPLIED LIVE on 2026-08-11 via Supabase MCP (project rxaeqrlaglhzkkpemoen).
--   This file documents that change for source control; it was not the
--   means of application. Re-running it is still safe (idempotent).
--
-- How to run
--   Open Supabase Studio → SQL editor → paste this file → Run.
--   Idempotent: both statements are CREATE OR REPLACE FUNCTION.
--
-- Rollback
--   Re-run CREATE OR REPLACE FUNCTION for each, restoring the original
--   `current_setting('request.jwt.claim.role', true) = 'service_role'`
--   line in place of `auth.role() = 'service_role'`. Prior bodies are
--   preserved in this repo's git history (this commit's diff) for exact
--   restoration if ever needed.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_candidate_invite(p_quantity integer DEFAULT 1, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_is_service_role boolean := coalesce(
    auth.role() = 'service_role',
    false
  );
  v_auth_uid  uuid := auth.uid();
  v_user_id   uuid;
  v_sub       subscriptions%rowtype;
  v_plan      plans%rowtype;
  v_usage     workspace_usage%rowtype;
  v_pack_credits integer := 0;
  v_plan_limit integer;
  v_total_limit integer;
  v_pack      candidate_packs%rowtype;
  v_overflow  integer;
  v_take      integer;
  v_new_used  integer;
begin
  -- Resolve the target user.
  if v_is_service_role then
    if p_user_id is null then
      raise exception 'p_user_id required for service_role' using errcode = '22023';
    end if;
    v_user_id := p_user_id;
  else
    if v_auth_uid is null then
      raise exception 'auth required' using errcode = '42501';
    end if;
    if p_user_id is not null and p_user_id <> v_auth_uid then
      raise exception 'cannot invoke for another user' using errcode = '42501';
    end if;
    v_user_id := v_auth_uid;
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception 'quantity must be > 0' using errcode = '22023';
  end if;

  select * into v_sub from public.subscriptions
    where user_id = v_user_id
    for update;
  if not found then
    raise exception 'no subscription' using errcode = 'P0002';
  end if;

  select * into v_plan from public.plans where key = v_sub.plan_key;
  if not found then
    raise exception 'plan not found' using errcode = 'P0002';
  end if;
  v_plan_limit := v_plan.candidate_limit;

  select * into v_usage from public.workspace_usage
    where user_id = v_user_id
    for update;
  if not found then
    insert into public.workspace_usage (user_id, period_start, period_end, candidates_used)
      values (v_user_id, v_sub.current_period_start, v_sub.current_period_end, 0)
      on conflict (user_id) do nothing;
    select * into v_usage from public.workspace_usage
      where user_id = v_user_id
      for update;
  end if;

  select coalesce(sum(quantity - credits_used), 0)::int into v_pack_credits
    from public.candidate_packs
    where user_id = v_user_id
      and status = 'active'
      and expires_at > now();

  if v_plan_limit is null then
    v_total_limit := null;
  else
    v_total_limit := v_plan_limit + v_pack_credits;
  end if;

  if v_total_limit is not null and v_usage.candidates_used + p_quantity > v_total_limit then
    raise exception 'candidate limit reached' using errcode = 'P0001';
  end if;

  v_new_used := v_usage.candidates_used + p_quantity;
  update public.workspace_usage
    set candidates_used = v_new_used
    where user_id = v_user_id;

  if v_plan_limit is not null and v_new_used > v_plan_limit then
    v_overflow := v_new_used - greatest(v_plan_limit, v_usage.candidates_used);
    for v_pack in
      select * from public.candidate_packs
        where user_id = v_user_id
          and status = 'active'
          and expires_at > now()
        order by purchased_at asc
        for update
    loop
      exit when v_overflow <= 0;
      v_take := least(v_pack.quantity - v_pack.credits_used, v_overflow);
      if v_take > 0 then
        update public.candidate_packs
          set credits_used = credits_used + v_take
          where id = v_pack.id;
        v_overflow := v_overflow - v_take;
      end if;
    end loop;
  end if;

  return jsonb_build_object(
    'candidates_used',       v_new_used,
    'plan_candidate_limit',  v_plan_limit,
    'total_included',        v_total_limit
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.tg_subscriptions_client_guard()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  is_service_role boolean := coalesce(
    auth.role() = 'service_role',
    false
  );
begin
  if is_service_role then
    return new;
  end if;

  if new.plan_key                is distinct from old.plan_key                or
     new.status                  is distinct from old.status                  or
     new.current_period_start    is distinct from old.current_period_start    or
     new.current_period_end      is distinct from old.current_period_end      or
     new.trial_ends_at           is distinct from old.trial_ends_at           or
     new.payment_provider        is distinct from old.payment_provider        or
     new.provider_customer_id    is distinct from old.provider_customer_id    or
     new.provider_subscription_id is distinct from old.provider_subscription_id then
    raise exception 'Subscription field changes require service-role. Only cancel_at_period_end and metadata are client-mutable.'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- ============================================================================
-- Done. Verify with:
--   select proname, prosecdef, (select rolname from pg_roles where oid = proowner) as owner
--     from pg_proc where proname in ('record_candidate_invite','tg_subscriptions_client_guard');
--   select pg_get_functiondef(oid) from pg_proc where proname = 'record_candidate_invite';
--   select pg_get_functiondef(oid) from pg_proc where proname = 'tg_subscriptions_client_guard';
-- ============================================================================
