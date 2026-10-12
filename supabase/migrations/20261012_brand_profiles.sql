-- Customize Page เฟส 5: โปรไฟล์แบรนด์
--
-- ข้อมูลที่หน้าแบรนด์อัตโนมัติ (template) ใช้ — รูปหัว เรื่องราว จุดเด่น
-- สินค้าแนะนำ แบรนด์ที่ยังไม่มีแถวในตารางนี้ หน้าตาเหมือนเดิมทุกอย่าง
--
-- แยกจาก pages เพราะเป็นข้อมูลของ "แบรนด์" ไม่ใช่ของ "เพจ": แบรนด์ที่ทีมจัด
-- หน้าเองด้วย editor ก็ยังดึงเรื่องราว/รูปหัวชุดเดียวกันนี้ไปใช้ แก้ที่เดียว
-- ขึ้นทุกที่

create table if not exists public.brand_profiles (
  slug              text primary key,            -- ตรงกับ src/data/brands.ts
  hero_image        text not null default '',    -- รูปหัว (desktop) จากคลังรูป
  hero_image_mobile text not null default '',    -- ว่าง = ใช้รูป desktop
  hero_alt          text not null default '',
  story             text not null default '',    -- markdown-lite (ไม่เก็บ HTML)
  -- [{ "title": "...", "text": "..." }] สูงสุด 4 ข้อ
  usp               jsonb not null default '[]'::jsonb,
  -- slug สินค้าแนะนำ เรียงตามที่เลือก ว่าง = ใช้สินค้ารีวิวเยอะสุดอัตโนมัติ
  featured_slugs    text[] not null default '{}',
  updated_by        text,
  updated_at        timestamptz not null default now()
);

alter table public.brand_profiles enable row level security;
