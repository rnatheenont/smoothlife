-- E1: เพจชนิดใหม่ system / template / global
--
-- เดิมมี 4 ชนิด (home, page, campaign, brand) ซึ่งทุกตัวเป็น "หน้าหนึ่งหน้า"
-- สามชนิดใหม่ไม่ใช่แบบนั้น:
--   system   = หน้าที่มีอยู่แล้วในโค้ดและ URL ตายตัว (/about, /shop) —
--              รายการปิด อยู่ใน SYSTEM_PAGES สร้างเพิ่มจากหน้าแอดมินไม่ได้
--   template = เอกสารเดียวใช้กับทุกรายการของชนิดนั้น (สินค้าทุกตัวใช้
--              template/product เหมือน product.json ของ Shopify)
--   global   = ส่วนที่อยู่ทุกหน้า (header, footer, ข้อมูลติดต่อ, แถบประกาศ)
--
-- เปลี่ยนแค่ check constraint — คอลัมน์ ดัชนี และ unique (kind, slug) เดิม
-- ใช้ได้กับทั้งสามชนิดอยู่แล้ว เพราะต่างกันแค่ความหมายของ slug
--
-- ปลอดภัยกับข้อมูลที่มี: constraint ใหม่กว้างกว่าเดิมทุกกรณี แถวเดิมจึงผ่าน
-- ทั้งหมด และรันซ้ำได้ (drop if exists ก่อน add)

alter table public.pages
  drop constraint if exists pages_kind_check;

alter table public.pages
  add constraint pages_kind_check
  check (kind in ('home', 'page', 'campaign', 'brand', 'system', 'template', 'global'));
