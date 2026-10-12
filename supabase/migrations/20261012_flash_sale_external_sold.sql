-- ยอดที่ขายผ่านหน้าร้าน Shopify โดยไม่ผ่านคิว
--
-- ก่อนหน้านี้ทุกจุดที่ตัดสินใจเรื่องสต็อกดูแต่ sold_count ซึ่งคิวเป็นคนบวกให้เอง
-- ของที่ขายผ่านหน้าสินค้าของร้านจึงไม่มีใครเห็น — แคมเปญ VIP ชุดละ 55,000 บาท
-- ขายไป 12 ชุด แต่คิวคิดว่า 8 และพร้อมจะรับคนอีก 17 คิวสำหรับของที่เหลือ 13 ชุด
--
-- ไม่เรียก Shopify จากในฟังก์ชันเหล่านี้โดยตั้งใจ: fs_join ถือ lock แถวอยู่ตอน
-- คนหลายร้อยคนกดพร้อมกัน การยิง HTTP ค้างไว้ตรงนั้นคือการทำให้ทั้งคิวหยุดรอ
-- ฝั่งแอปอ่านยอดจาก Shopify แล้วเขียนลงคอลัมน์นี้แทน (raiseSoldToShopify)

alter table public.flash_sales
  add column if not exists external_sold_count int not null default 0
    check (external_sold_count >= 0);

comment on column public.flash_sales.external_sold_count is
  'ขายผ่านหน้าร้าน Shopify ไม่ผ่านคิว — อัปเดตโดย raiseSoldToShopify()';

-- สี่จุดที่ตัดสินใจจากสต็อก ต้องใช้เลขเดียวกันทั้งหมด:
--   fs_campaign_phase   ปิดแคมเปญเมื่อของหมด
--   fs_join             ปฏิเสธคนเข้าคิวเมื่อของหมด
--   fs_settle_locked    ปล่อยคิวที่รออยู่ให้ได้สิทธิ์ซื้อ + ปิดคิวเมื่อของหมด
--   fs_status           เลขที่หน้าเว็บแสดง (ต้องตรงกับที่ประตูใช้ ไม่งั้นจะขึ้นว่า
--                       "เหลือ 2" แล้วกดไม่ได้ ซึ่งอธิบายกับลูกค้าไม่ได้)
--
-- ดูตัวฟังก์ชันเต็มได้จาก migration ที่ชื่อ flash_sale_external_sold_count,
-- flash_sale_join_and_status_use_external_sold และ
-- flash_sale_phase_counts_external_sold ใน Supabase
