-- Customize Page: เพจ = รายการ section เรียงกัน เก็บเป็น JSON
--
-- เก็บไฟล์ไว้ใน repo ด้วย เพราะเดิม schema อยู่ใน Supabase อย่างเดียว —
-- คนที่มาอ่านโค้ดทีหลังไม่มีทางรู้ว่าตารางหน้าตาอย่างไรโดยไม่เปิดแดชบอร์ด

create table if not exists public.pages (
  id                    uuid primary key default gen_random_uuid(),
  kind                  text not null check (kind in ('home', 'page', 'campaign', 'brand')),
  slug                  text not null,
  title                 text not null,
  status                text not null default 'draft'
                          check (status in ('draft', 'scheduled', 'published', 'ended', 'archived')),
  -- ร่างล่าสุด: autosave เขียนที่นี่เท่านั้น ลูกค้าไม่เห็นจนกว่าจะเผยแพร่
  draft_doc             jsonb not null,
  -- optimistic lock: PUT ที่ส่งเลขไม่ตรงจะถูกปฏิเสธ แทนที่จะทับงานคนอื่นเงียบๆ
  draft_version         int not null default 1,
  draft_updated_by      text,
  draft_updated_at      timestamptz not null default now(),
  published_revision_id uuid,
  publish_at            timestamptz,
  unpublish_at          timestamptz,
  -- เวลาถัดไปที่หน้าจะแสดงผลต่างจากตอนนี้ (section ที่ตั้งเวลาไว้)
  -- เก็บไว้ตอนเผยแพร่ เพื่อให้ตัวตั้งเวลาถามได้ด้วยการเทียบคอลัมน์เดียว
  next_boundary_at      timestamptz,
  campaign_teaser_at    timestamptz,
  campaign_live_at      timestamptz,
  campaign_extended_at  timestamptz,
  campaign_ends_at      timestamptz,
  takeover_home         boolean not null default false,
  created_by            text,
  created_at            timestamptz not null default now(),
  unique (kind, slug)
);

-- เวอร์ชันที่เผยแพร่ไปแล้ว — ห้ามแก้ ห้ามลบ
-- ย้อนกลับ = ชี้ published_revision_id กลับไปแถวเก่า ไม่ต้อง deploy
create table if not exists public.page_revisions (
  id             uuid primary key default gen_random_uuid(),
  page_id        uuid not null references public.pages(id) on delete cascade,
  number         int not null,
  doc            jsonb not null,
  schema_version int not null,
  note           text,
  published_by   text,
  published_at   timestamptz not null default now(),
  unique (page_id, number)
);

create table if not exists public.page_templates (
  id          uuid primary key default gen_random_uuid(),
  scope       text not null check (scope in ('page', 'section')),
  kind        text,
  name        text not null,
  description text,
  thumbnail   text,
  doc         jsonb not null,
  is_system   boolean not null default false,
  created_by  text,
  created_at  timestamptz not null default now()
);

create index if not exists pages_status_publish_idx on public.pages (status, publish_at);
create index if not exists pages_boundary_idx on public.pages (next_boundary_at)
  where next_boundary_at is not null;
create index if not exists page_revisions_page_idx on public.page_revisions (page_id, number desc);

alter table public.pages enable row level security;
alter table public.page_revisions enable row level security;
alter table public.page_templates enable row level security;

-- ประวัติที่แก้ย้อนหลังได้ไม่ใช่ประวัติ — กันไว้ที่ฐานข้อมูล ไม่ใช่แค่ในโค้ด
-- (ลบเพจแล้ว cascade ลบ revision ได้ตามปกติ เพราะเป็น DELETE จาก constraint)
create or replace function public.page_revisions_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'page_revisions is append-only (attempted % on revision %)', tg_op, old.id;
end;
$$;

drop trigger if exists page_revisions_no_update on public.page_revisions;
create trigger page_revisions_no_update
  before update on public.page_revisions
  for each row execute function public.page_revisions_immutable();
