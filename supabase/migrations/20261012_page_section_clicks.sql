-- นับคลิกต่อ section ต่อวัน (Customize Page เฟส 6 · แผน §12)
--
-- เก็บเป็นยอดรวมรายวันต่อ section เท่านั้น ไม่มีคอลัมน์ไหนบอกว่าใครคลิก
-- ไม่มี session ไม่มี IP ไม่มี user agent — คำถามที่ต้องตอบคือ "section ไหน
-- มีคนกด" ไม่ใช่ "ใครกด" และข้อมูลที่ไม่ได้เก็บคือข้อมูลที่รั่วไม่ได้
--
-- วันคิดตามเวลาไทย ไม่ใช่ UTC เพราะคนอ่านรายงานอ่านเป็นวันไทย และเซลที่จบ
-- เที่ยงคืนไทยต้องอยู่ในวันเดียวกันทั้งก้อน
--
-- ทำไมเป็น RPC ไม่ใช่ให้ route เขียนเอง: ฟังก์ชันนี้เป็น security definer
-- ตัวเลขที่ส่งมาจากหน้าเว็บจึงเป็นของที่ไม่น่าเชื่อถือ ขอบเขตทั้งหมด
-- (จำนวนต่อครั้ง ความยาวของ slug/section) จึงบังคับในฐานข้อมูล ไม่ใช่
-- ใน route ที่ใครก็ยิงตรงข้ามไปได้
--
-- เพดาน 20 ครั้งต่อการยิงหนึ่งครั้ง และเกินแล้ว "ทิ้ง" ไม่ใช่ "ปัดลงเหลือ 20"
-- ตอนแรกเขียนเป็นปัดลง แล้วทดสอบด้วย 99999 ปรากฏว่าได้ +50 เข้าไปจริง ๆ
-- เพดานที่ปัดลงไม่ใช่เพดาน มันคือค่าผ่านทาง

create table if not exists public.page_section_clicks (
  page_kind  text not null,
  page_slug  text not null,
  section_id text not null,
  day        date not null default (now() at time zone 'Asia/Bangkok')::date,
  clicks     integer not null default 0,
  primary key (page_kind, page_slug, section_id, day)
);

alter table public.page_section_clicks enable row level security;

comment on table public.page_section_clicks is
  'นับคลิกต่อ section ต่อวัน แบบรวมยอด ไม่เก็บว่าใครคลิก — ใช้ในหน้าสถิติของเพจ';

create or replace function public.page_section_click(
  p_kind text,
  p_slug text,
  p_section text,
  p_count integer default 1
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_count is null or p_count < 1 or p_count > 20 then
    return;
  end if;
  if length(coalesce(p_kind, '')) = 0 or length(p_kind) > 20
     or length(coalesce(p_slug, '')) = 0 or length(p_slug) > 120
     or length(coalesce(p_section, '')) = 0 or length(p_section) > 60 then
    return;
  end if;

  insert into public.page_section_clicks as c (page_kind, page_slug, section_id, clicks)
  values (p_kind, p_slug, p_section, p_count)
  on conflict (page_kind, page_slug, section_id, day)
  do update set clicks = c.clicks + excluded.clicks;
end;
$$;
