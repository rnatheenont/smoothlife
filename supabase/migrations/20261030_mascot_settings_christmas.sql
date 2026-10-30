-- Smoothie's Christmas outfit: the setting may now name it.
--
-- Applied to production on 30 Oct 2026, before the code that can write it.
alter table public.mascot_settings drop constraint if exists mascot_settings_theme_check;
alter table public.mascot_settings
  add constraint mascot_settings_theme_check check (theme in ('auto', 'default', 'halloween', 'christmas'));
comment on table public.mascot_settings is 'ชุดของน้อง Smoothie บนหน้าร้าน — auto = ตามเทศกาล, default = ชุดปกติ, halloween = ฮาโลวีน, christmas = คริสต์มาส';
