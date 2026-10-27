-- How often each product gets opened.
--
-- The shop had no click signal at all: search_queries stores the words
-- someone typed and nothing about what they went on to look at, so "rank by
-- what customers are interested in" had no data behind it. This is that data,
-- starting from the day it ships.
--
-- A counter per product per day rather than one row per view. The ranking
-- reads a 30-day total, which a counter answers in one indexed scan, and the
-- table stays at roughly (products opened that day) rows instead of growing
-- with traffic forever. The day is Bangkok's, not UTC's: a view at 7am local
-- belongs to that morning, and a UTC bucket would put it with the night
-- before.
create table if not exists product_views (
  product_slug text not null,
  day date not null,
  views integer not null default 0,
  primary key (product_slug, day)
);

comment on table product_views is
  'Product opens per day, for ranking. Counts only — nothing about who looked.';

-- RLS on with no policy: service role only, the same shape as every other
-- table that holds behaviour. Nothing here identifies a person, but a public
-- read would hand a competitor the shop''s demand curve.
alter table product_views enable row level security;

-- PostgREST can insert and it can replace, but it cannot add one to a number
-- that may not exist yet, which is the whole operation. Hence a function.
create or replace function record_product_view(p_slug text)
returns void
language sql
as $$
  insert into product_views (product_slug, day, views)
  values (p_slug, (now() at time zone 'Asia/Bangkok')::date, 1)
  on conflict (product_slug, day) do update set views = product_views.views + 1;
$$;

-- Said out loud rather than left to the default. Default privileges in public
-- were closed on 22 Oct, so a new function is already private — but this one
-- writes, and a reader of this file should not have to know the history of the
-- schema to be sure of that.
revoke all on function record_product_view(text) from public;
revoke all on function record_product_view(text) from anon, authenticated;

-- The ranking asks for one window — the last 30 days, every product — so the
-- useful index is on the day, not the slug.
create index if not exists product_views_day_idx on product_views (day);
