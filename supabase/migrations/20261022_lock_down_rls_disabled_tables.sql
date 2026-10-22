-- Close nine public tables that PostgREST would serve to anyone holding the
-- anon key.
--
-- These were created without RLS, and the project's default privileges hand
-- anon and authenticated every right (select, insert, update, delete,
-- truncate) on every new table in public. With RLS off nothing stands between
-- those grants and /rest/v1: admin_users carries password_hash and role_key,
-- so the anon key alone could read every admin's hash or insert a row that
-- makes its author an owner; receipt_campaign_entries carries entrants'
-- names, phones and emails.
--
-- Nothing in the app uses those roles. Every read and write of these tables
-- goes through supabaseRest (src/lib/supabase-server.ts) with the service
-- role, which bypasses RLS and keeps its own grants, and the anon key is not
-- in the app, its env or its git history. Edge logs for 22 Oct 2026 show
-- 149k REST requests, all service_role, none anon.
--
-- So: RLS on with no policies (service role only), the same shape as the
-- other ~100 tables here, and the anon/authenticated grants revoked as well
-- so a policy added by mistake later still cannot open them.
--
-- Not covered here: the default privileges that caused this. New tables in
-- public still start fully granted to anon; see the follow-up note in the
-- audit write-up before changing that.

alter table public.admin_users              enable row level security;
alter table public.roles                    enable row level security;
alter table public.role_permissions         enable row level security;
alter table public.brand_signals            enable row level security;
alter table public.receipt_campaign_entries enable row level security;
alter table public.receipt_campaign_uploads enable row level security;
alter table public.receipt_campaign_draws   enable row level security;
alter table public.receipt_campaign_winners enable row level security;
alter table public.gift_stock_alerts        enable row level security;

revoke all on table
  public.admin_users,
  public.roles,
  public.role_permissions,
  public.brand_signals,
  public.receipt_campaign_entries,
  public.receipt_campaign_uploads,
  public.receipt_campaign_draws,
  public.receipt_campaign_winners,
  public.gift_stock_alerts
from anon, authenticated;

-- Fail the whole migration rather than leave a table half closed, and make
-- sure the server still has what it needs.
do $$
declare
  t text;
begin
  foreach t in array array[
    'admin_users', 'roles', 'role_permissions', 'brand_signals',
    'receipt_campaign_entries', 'receipt_campaign_uploads',
    'receipt_campaign_draws', 'receipt_campaign_winners', 'gift_stock_alerts'
  ] loop
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'RLS still off on public.%', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE')
       or has_table_privilege('authenticated', 'public.' || t, 'SELECT,INSERT,UPDATE,DELETE') then
      raise exception 'anon/authenticated still granted on public.%', t;
    end if;
    -- A comma list in has_table_privilege means "any of", so check each one.
    if not (has_table_privilege('service_role', 'public.' || t, 'SELECT')
        and has_table_privilege('service_role', 'public.' || t, 'INSERT')
        and has_table_privilege('service_role', 'public.' || t, 'UPDATE')
        and has_table_privilege('service_role', 'public.' || t, 'DELETE')) then
      raise exception 'service_role lost access to public.%', t;
    end if;
  end loop;
end $$;
