-- Which outfit Smoothie wears on the storefront, chosen in the admin panel
-- (/admin/mascot) instead of in code.
--
-- Applied to production on 30 Oct 2026.
--
-- One row, like inbox_alert_settings. 'auto' follows the seasonal calendar in
-- src/components/mascot/mascot-theme.ts; anything else forces that outfit.
-- The list is closed: a value the code cannot draw is a mascot with no clothes.
create table if not exists public.mascot_settings (
  id boolean primary key default true check (id),
  theme text not null default 'auto' check (theme in ('auto', 'default', 'halloween')),
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.mascot_settings (id, theme) values (true, 'auto') on conflict (id) do nothing;

-- Read and written only by the server with the service role.
alter table public.mascot_settings enable row level security;
revoke all on public.mascot_settings from anon, authenticated;

comment on table public.mascot_settings is 'ชุดของน้อง Smoothie บนหน้าร้าน — auto = ตามเทศกาล, default = ชุดปกติ, halloween = ฮาโลวีน';
