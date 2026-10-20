-- Whether the AI engines mention us, checked by hand once a month.
--
-- There is no API that answers "does ChatGPT recommend our toothpaste when
-- somebody asks which one whitens teeth". The only way to know is to ask,
-- read the answer, and write down what it said — so this table is a form,
-- not a feed: thirty questions customers really ask, against each engine,
-- once a month, with the three facts that matter. Were we cited, where did
-- the link go, and whose product did it name instead.
--
-- Kept in the database rather than a spreadsheet so the series survives the
-- person who started it, and so the admin can show this month beside last.
--
-- RLS on with no policies: service role only; the admin API is the way in.

create table if not exists public.geo_checks (
  id          uuid primary key default gen_random_uuid(),
  -- The first day of the month being measured. A date rather than a text
  -- "2026-10" so ordering and "last six months" are plain SQL.
  month       date not null,
  question    text not null,
  engine      text not null check (engine in ('chatgpt', 'gemini', 'perplexity', 'copilot', 'google_aio')),
  -- Null until somebody has actually looked: "not checked yet" and "checked,
  -- not cited" are different answers, and a boolean default would quietly
  -- turn every blank row into a reported failure.
  cited       boolean,
  linked_url  text,
  competitor  text,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (month, question, engine)
);

alter table public.geo_checks enable row level security;

create index if not exists geo_checks_month_idx on public.geo_checks (month desc);
