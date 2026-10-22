-- Close what the security advisor still flags once the nine RLS-disabled
-- tables are locked (20261022_lock_down_rls_disabled_tables.sql), and stop
-- the next new table, function or sequence in public from starting out open.
--
-- Nothing below takes anything away from the app. Every request goes through
-- supabaseRest (src/lib/supabase-server.ts) with the service role; edge logs
-- for 22 Oct 2026 show 149k REST requests (13k of them rpc/), all
-- service_role, and the only requests without a JWT are 316 storage/v1
-- object reads, none on /rest/v1. pg_cron runs every tick as postgres, which
-- owns these functions, and trigger functions are not checked for EXECUTE
-- when they fire, only when the trigger is created.
--
-- 1. Default privileges. postgres's defaults in public grant anon and
--    authenticated every table right (arwdDxtm), EXECUTE on functions and
--    rwU on sequences, which is why new tables arrive wide open. Revoke them
--    in public. For functions that is not enough: per-schema defaults only
--    add to the global ones, and the built-in global default gives EXECUTE
--    to PUBLIC, which anon inherits, so the PUBLIC revoke has to be global.
--    postgres owns no functions outside public today, so the global change
--    only reaches public in practice.
--
--    supabase_admin has the same defaults in public, but postgres cannot
--    change them: ALTER DEFAULT PRIVILEGES FOR ROLE needs membership in that
--    role, and postgres is neither superuser nor a member of supabase_admin.
--    It does not matter here: all 119 relations and every function in public
--    are owned by postgres, and supabase_admin's defaults apply only to
--    objects supabase_admin creates.
--
-- 2. SECURITY DEFINER functions anon/authenticated could call through
--    /rest/v1/rpc. Callers, from src/ and cron.job:
--      fs_sold_sync_tick, inbox_alert_tick, pages_schedule_tick
--        pg_cron only (jobs flash-sale-sold-sync, inbox-alert,
--        pages-schedule, run as postgres). Open, anyone could fire the
--        Shopify sold-count sync or the schedule tick on demand.
--      inbox_unread_counts
--        src/app/api/admin/inbox/unread/route.ts, service role, behind the
--        admin cookie. Open, it leaks inbox counts to anyone.
--      page_section_click
--        src/app/api/page-clicks/route.ts, service role. Open, it skips the
--        route's caps (20 sections, MAX_PER_SECTION) and lets anyone inflate
--        the stats.
--      notify_on_chat_resolved, notify_on_points_earned,
--      notify_on_question_answered
--        triggers on chat_escalations, points_ledger, product_questions.
--        Postgres refuses to call a trigger function directly, so these were
--        never callable, but they stay on the advisor list until revoked.
--    service_role keeps the explicit grant it already has on each.
--
-- 3. shopify_points_balance is a plain (definer) view owned by postgres, so
--    it reads shopify_points_ledger past RLS for whoever queries it, and
--    anon/authenticated were granted it: every member's balance by user_id
--    for the anon key. Nothing in src/ reads it. Make it security_invoker,
--    like points_balance next to it, and revoke the grants. service_role
--    has BYPASSRLS, so it still reads the view either way.
--
-- 4. page_revisions_immutable has no search_path. Its body touches no
--    objects, so an empty one is enough.
--
-- Not covered here: the existing table grants. anon/authenticated still hold
-- arwdDxtm on ~98 older tables in public; RLS with no policies is what keeps
-- them shut. Revoking those as well is a separate decision.

-- 1. Default privileges -----------------------------------------------------

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
-- Global, not "in schema": see the note on PUBLIC above.
alter default privileges for role postgres
  revoke execute on functions from public;

-- 2. SECURITY DEFINER functions ---------------------------------------------

revoke all on function public.fs_sold_sync_tick()           from public, anon, authenticated;
revoke all on function public.inbox_alert_tick()            from public, anon, authenticated;
revoke all on function public.pages_schedule_tick()         from public, anon, authenticated;
revoke all on function public.inbox_unread_counts()         from public, anon, authenticated;
revoke all on function public.page_section_click(text, text, text, integer)
                                                            from public, anon, authenticated;
revoke all on function public.notify_on_chat_resolved()     from public, anon, authenticated;
revoke all on function public.notify_on_points_earned()     from public, anon, authenticated;
revoke all on function public.notify_on_question_answered() from public, anon, authenticated;

-- 3. shopify_points_balance -------------------------------------------------

alter view public.shopify_points_balance set (security_invoker = true);
revoke all on table public.shopify_points_balance from anon, authenticated;

-- 4. page_revisions_immutable -----------------------------------------------

alter function public.page_revisions_immutable() set search_path = '';

-- Fail the whole migration rather than leave half of it in place, and make
-- sure the server and cron still have what they need.
do $$
declare
  f regprocedure;
  probe_t regclass;
  probe_f regprocedure;
begin
  -- 1. No default in public for postgres still names anon/authenticated, and
  -- the global function default no longer names PUBLIC.
  if exists (
    select 1
    from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole
      and d.defaclnamespace = 'public'::regnamespace::oid
      and a.grantee in ('anon'::regrole::oid, 'authenticated'::regrole::oid)
  ) then
    raise exception 'postgres default privileges in public still grant anon/authenticated';
  end if;
  if not exists (
    select 1 from pg_default_acl
    where defaclrole = 'postgres'::regrole and defaclnamespace = 0 and defaclobjtype = 'f'
  ) or exists (
    select 1
    from pg_default_acl d, aclexplode(d.defaclacl) a
    where d.defaclrole = 'postgres'::regrole and d.defaclnamespace = 0
      and d.defaclobjtype = 'f' and a.grantee = 0
  ) then
    raise exception 'postgres functions still default to EXECUTE for PUBLIC';
  end if;

  -- Prove it on real objects: a table and a function created now must come
  -- out closed to anon/authenticated and open to service_role. Both are
  -- dropped again before the migration commits.
  create table public._acl_probe (id int);
  create function public._acl_probe() returns int language sql as 'select 1';
  probe_t := 'public._acl_probe'::regclass;
  probe_f := 'public._acl_probe()'::regprocedure;
  if has_table_privilege('anon', probe_t, 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', probe_t, 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'a new table in public is still granted to anon/authenticated';
  end if;
  if has_function_privilege('anon', probe_f, 'EXECUTE')
     or has_function_privilege('authenticated', probe_f, 'EXECUTE') then
    raise exception 'a new function in public is still executable by anon/authenticated';
  end if;
  if not (has_table_privilege('service_role', probe_t, 'SELECT')
      and has_table_privilege('service_role', probe_t, 'INSERT')
      and has_function_privilege('service_role', probe_f, 'EXECUTE')) then
    raise exception 'service_role no longer gets new tables/functions in public';
  end if;
  drop function public._acl_probe();
  drop table public._acl_probe;

  -- 2. The eight functions are shut to anon/authenticated (has_function_privilege
  -- counts PUBLIC too), and service_role keeps the two the app calls.
  foreach f in array array[
    'public.fs_sold_sync_tick()', 'public.inbox_alert_tick()',
    'public.pages_schedule_tick()', 'public.inbox_unread_counts()',
    'public.page_section_click(text,text,text,integer)',
    'public.notify_on_chat_resolved()', 'public.notify_on_points_earned()',
    'public.notify_on_question_answered()'
  ]::regprocedure[] loop
    if has_function_privilege('anon', f, 'EXECUTE')
       or has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'anon/authenticated can still execute %', f;
    end if;
  end loop;
  if not (has_function_privilege('service_role', 'public.inbox_unread_counts()', 'EXECUTE')
      and has_function_privilege('service_role', 'public.page_section_click(text,text,text,integer)', 'EXECUTE')) then
    raise exception 'service_role lost an rpc the app calls';
  end if;

  -- 3. The view checks the caller's rights now, and only service_role has it.
  if not exists (
    select 1 from pg_class
    where oid = 'public.shopify_points_balance'::regclass
      and 'security_invoker=true' = any (reloptions)
  ) then
    raise exception 'shopify_points_balance is still security definer';
  end if;
  if has_table_privilege('anon', 'public.shopify_points_balance', 'SELECT')
     or has_table_privilege('authenticated', 'public.shopify_points_balance', 'SELECT') then
    raise exception 'anon/authenticated can still read shopify_points_balance';
  end if;
  if not has_table_privilege('service_role', 'public.shopify_points_balance', 'SELECT') then
    raise exception 'service_role lost shopify_points_balance';
  end if;

  -- 4. search_path is pinned.
  if not exists (
    select 1 from pg_proc
    where oid = 'public.page_revisions_immutable()'::regprocedure
      and exists (select 1 from unnest(proconfig) c where c like 'search_path=%')
  ) then
    raise exception 'page_revisions_immutable still has a mutable search_path';
  end if;
end $$;
