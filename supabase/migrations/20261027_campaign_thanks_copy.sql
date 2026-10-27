-- The thank-you card's words, so marketing can change them without a deploy.
--
-- Both endings are now a card rather than a grey sentence (ThanksCard), and
-- the words were in the code — which meant a date slipping by a day, or a
-- change of tone, needed an engineer. The dates themselves stay where they
-- are: the receipt card writes them in from opens/closes/announce, so the
-- copy below carries placeholders rather than typed-out dates that would
-- quietly go stale the moment someone moved the window.
--
-- Every column is nullable and the application falls back to the wording it
-- shipped with, so an empty row reads exactly like the day before this ran.

alter table public.receipt_campaign_settings
  add column if not exists thanks_title text,
  add column if not exists thanks_body text,
  add column if not exists thanks_notice_title text,
  add column if not exists thanks_notice_body text;

comment on column public.receipt_campaign_settings.thanks_body is
  'รองรับ {closes} {announce} {confirm} — ระบบแทนที่ด้วยวันที่จริงตอนแสดงผล';
comment on column public.receipt_campaign_settings.thanks_notice_body is
  'รองรับ {closes} {announce} {confirm} — ระบบแทนที่ด้วยวันที่จริงตอนแสดงผล';

alter table public.flash_sale_campaigns
  add column if not exists thanks_title text,
  add column if not exists thanks_body text,
  add column if not exists thanks_notice_title text,
  add column if not exists thanks_notice_body text;
