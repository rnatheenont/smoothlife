-- Two things the report table could not answer, and both of them are what
-- stands between this policy and being enforced.
--
-- 1. WHERE the violation came from. `blocked` is "eval" for every one of the
--    script-src eval reports, which says what happened and nothing about who
--    did it. The browser also sends source-file and line-number; keeping the
--    script's origin and path (never its query — the same reason `blocked`
--    is reduced to an origin) names the offending script directly.
--
-- 2. WHICH deployment it came from. Preview builds post to this same table,
--    so "has the table stopped collecting?" — the stated gate for enforcing —
--    has been answered with preview noise all along. 24,800 of the 25,900
--    reports were the Vercel toolbar, which production never loads. Without
--    this column there is no way to filter those out.

alter table public.csp_reports
  add column if not exists source text,
  add column if not exists env text not null default 'unknown';

comment on column public.csp_reports.source is
  'Origin + path of the script that triggered the violation, query stripped. Null when the browser sent none.';
comment on column public.csp_reports.env is
  'VERCEL_ENV of the deployment that received the report — production, preview or development. Only production rows gate enforcing the policy.';

-- Production and preview must count separately, or they collapse into one
-- row and the env column tells you only whichever arrived last.
alter table public.csp_reports
  drop constraint if exists csp_reports_directive_blocked_page_key;
alter table public.csp_reports
  add constraint csp_reports_directive_blocked_page_env_key
  unique (directive, blocked, page, env);

-- Defaults on the two new arguments so a deployment still running the old
-- four-argument call keeps working through the rollout.
create or replace function public.record_csp_report(
  p_directive text,
  p_blocked text,
  p_page text,
  p_sample text,
  p_source text default null,
  p_env text default 'unknown'
)
returns void
language sql
security definer
set search_path to 'public'
as $function$
  insert into public.csp_reports (directive, blocked, page, sample, source, env)
  values (
    left(p_directive, 100),
    left(p_blocked, 300),
    left(p_page, 300),
    left(p_sample, 200),
    left(p_source, 300),
    left(coalesce(p_env, 'unknown'), 20)
  )
  on conflict (directive, blocked, page, env)
  do update set
    count = public.csp_reports.count + 1,
    last_seen = now(),
    -- Keep the first source we learned rather than letting a later report
    -- with none blank it out.
    source = coalesce(excluded.source, public.csp_reports.source);
$function$;
