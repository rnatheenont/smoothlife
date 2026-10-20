-- Which crawlers read the pages we opened to search, counted as it happens.
--
-- Vercel keeps request logs for days, not months, so "did Googlebot ever
-- come back after we opened /faq" and "has ChatGPT fetched an answer yet"
-- cannot be answered from logs here. One row per day, crawler and path, and
-- the proxy adds to it after the page has already been sent.
--
-- RLS on with no policies: service role only, like every other table here
-- that the browser has no business reading.

create table if not exists public.bot_hits_daily (
  day   date    not null,
  bot   text    not null,
  path  text    not null,
  hits  integer not null default 0,
  primary key (day, bot, path)
);

alter table public.bot_hits_daily enable row level security;

-- Add one, cheaply, and never let a flood of new paths grow the table
-- without bound.
--
-- The update is tried first because the normal case is a path that already
-- has a row today: that is one indexed update and nothing else. Only a
-- genuinely new (day, bot, path) pays for the cap check, which is why the
-- cap can be a plain count instead of a counter that has to be maintained.
--
-- The proxy only calls this for paths that are open to search — /faq plus
-- one per published answer — so the honest expectation is a few dozen rows
-- a day. The cap is what holds if that ever stops being true.
create or replace function public.bot_hit(p_bot text, p_path text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'utc')::date;
  b text := left(p_bot, 60);
  p text := left(p_path, 200);
begin
  if p_bot is null or p_path is null then
    return;
  end if;

  update public.bot_hits_daily
     set hits = hits + 1
   where day = d and bot = b and path = p;
  if found then
    return;
  end if;

  if (select count(*) from public.bot_hits_daily where day = d) >= 500 then
    return;
  end if;

  insert into public.bot_hits_daily (day, bot, path, hits)
  values (d, b, p, 1)
  on conflict (day, bot, path) do update set hits = public.bot_hits_daily.hits + 1;
end;
$$;

revoke all on function public.bot_hit(text, text) from public, anon, authenticated;
grant execute on function public.bot_hit(text, text) to service_role;
