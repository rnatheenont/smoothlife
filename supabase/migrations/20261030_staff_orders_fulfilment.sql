-- Where a staff order goes: posted, or collected at one of two places.
--
-- Applied to production on 30 Oct 2026.
--
-- Defaulted to 'ship' so every order placed before this keeps meaning what
-- it meant, and so staff_create_order — which inserts these rows and names
-- its columns — needs no change.
alter table public.staff_orders
  add column if not exists fulfilment text not null default 'ship',
  add column if not exists pickup_name text,
  add column if not exists pickup_floor text;

-- The list is closed on purpose, but it has to carry every value the code
-- can write before the code that writes it ships. A constraint that does
-- not know a value is a payment callback lost forever (28 Oct 2026).
alter table public.staff_orders
  drop constraint if exists staff_orders_fulfilment_check;
alter table public.staff_orders
  add constraint staff_orders_fulfilment_check
  check (fulfilment in ('ship', 'pickup_warehouse', 'pickup_office'));

comment on column public.staff_orders.fulfilment is
  'ship = ส่งตามที่อยู่ในโปรไฟล์, pickup_warehouse = รับที่คลังตลิ่งชัน, pickup_office = รับที่สาทร';
comment on column public.staff_orders.pickup_name is 'ชื่อเล่นที่ติดกล่องไว้ให้ — เฉพาะตอนรับเอง';
comment on column public.staff_orders.pickup_floor is 'ชั้นที่รับของ — เฉพาะที่สาทร';
