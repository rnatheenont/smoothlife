-- ขออนุมัติก่อนเผยแพร่ (Customize Page เฟส 6)
--
-- คนที่มีสิทธิ์ pages.edit แต่ไม่มี pages.publish จะเผยแพร่เองไม่ได้อยู่แล้ว
-- (ด่านอยู่ที่ admin-route-permissions) แต่ก่อนหน้านี้เขาทำได้แค่แก้แล้ว
-- เดินไปบอกใครสักคนด้วยปาก คอลัมน์ชุดนี้ทำให้ "ขอ" เป็นสิ่งที่ระบบรู้จัก
--
-- เก็บเป็นคอลัมน์บน pages ไม่ใช่ตารางประวัติแยก เพราะคำถามที่ต้องตอบคือ
-- "ตอนนี้หน้านี้รออนุมัติอยู่ไหม" ซึ่งเป็นสถานะปัจจุบันหนึ่งค่า ส่วนประวัติ
-- ว่าใครขอ-ใครอนุมัติเมื่อไหร่ มีอยู่ใน admin_audit_log แล้วทุกครั้ง
--
-- index เฉพาะแถวที่ยังรออยู่ (partial) เพราะหน้ารายการถามอยู่คำถามเดียว
-- คือ "มีอะไรรออนุมัติบ้าง" และแถวที่ไม่ได้รอคือเกือบทั้งตาราง

alter table public.pages
  add column if not exists review_state      text    not null default 'none',
  add column if not exists review_note       text,
  add column if not exists review_by         text,
  add column if not exists review_at         timestamptz,
  add column if not exists review_decided_by text,
  add column if not exists review_decided_at timestamptz,
  add column if not exists review_reply      text;

comment on column public.pages.review_state is
  'none | requested | approved | changes — สถานะการขออนุมัติก่อนเผยแพร่';

create index if not exists pages_review_pending on public.pages (review_state)
  where review_state = 'requested';
