-- When a campaign runs, as a list of windows rather than one pair of dates.
--
-- A campaign over two weekends, or one that pauses midweek, could not be
-- written down: there was one starts_at and one expires_at, so the gap had
-- to be made by somebody switching the campaign off and on by hand — which
-- means somebody has to remember, at nine in the morning, on a Saturday.
--
-- Each entry is { "starts": iso, "ends": iso }. Either side may be absent,
-- meaning "from the beginning" or "until further notice". Null keeps the
-- single pair, which is what every row has today.

alter table public.free_gift_promos
  add column if not exists schedule jsonb;

comment on column public.free_gift_promos.schedule is
  'Run windows: [{starts, ends}] as ISO datetimes. Null = use starts_at/expires_at.';
