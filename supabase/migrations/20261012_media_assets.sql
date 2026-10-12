-- คลังรูปของหน้าเว็บ
--
-- ไฟล์อยู่ใน Supabase Storage (bucket blog-images เหมือนรูปบทความ) ตารางนี้คือ
-- สิ่งที่ทำให้มันเป็น "คลัง" ไม่ใช่แค่กองไฟล์
--
-- alt เก็บที่รูป ไม่ใช่ที่ section ที่เอาไปใช้ เพราะคำบรรยายเป็นของรูป —
-- รูปเดียวกันที่ใช้สามที่ไม่ควรต้องเขียนคำบรรยายสามครั้ง และสองในสามครั้งนั้น
-- คือที่ที่มันจะถูกเว้นว่างไว้
--
-- sources เก็บเป็น jsonb (กว้าง -> URL) ไม่ใช่คอลัมน์ต่อขนาด เพราะจำนวนขนาด
-- อาจเปลี่ยน และการเพิ่มคอลัมน์ต่อขนาดแปลว่าต้อง migrate ทุกครั้งที่เปลี่ยนใจ
create table if not exists public.media_assets (
  id          uuid primary key default gen_random_uuid(),
  folder      text not null default 'pages',
  path        text not null unique,
  sources     jsonb not null,
  url         text not null,
  width       int,
  height      int,
  bytes       int,
  mime        text not null,
  alt         text not null default '',
  uploaded_by text,
  created_at  timestamptz not null default now()
);

create index if not exists media_assets_recent_idx on public.media_assets (folder, created_at desc);

alter table public.media_assets enable row level security;
