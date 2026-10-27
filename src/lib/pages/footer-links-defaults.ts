// Split out of footer-links.ts so a client component can read this constant
// without importing zod with it. Footer.tsx is a client component and sits on every page. Pulling it through the schema module
// put a 94 KB validator in the browser to look up some links.
//
// The type comes back as `import type`, which the build erases.

import type { FooterColumns } from "./footer-links.ts";

export const FOOTER_COLUMNS_DEFAULT: FooterColumns = [
  {
    title: "ช้อปปิ้ง",
    links: [
      { href: "/shop", label: "สินค้าทั้งหมด" },
      { href: "/brands", label: "แบรนด์ทั้งหมด" },
      // "โปรโมชั่น" is out here too, by request — the last place it was
      // still being offered after it left the header bar and the drawer.
      // The page is untouched and still answers at /promotions.
      { href: "/concern", label: "เลือกตามปัญหาผิว" },
    ],
  },
  {
    title: "ทำไมต้อง Smooth Life",
    links: [
      { href: "/about", label: "เกี่ยวกับเรา" },
      { href: "/about/quality", label: "คุณภาพและมาตรฐาน" },
      { href: "/about/experts", label: "ผู้เชี่ยวชาญและพาร์ทเนอร์" },
      { href: "/about/sustainability", label: "ความรับผิดชอบต่อสังคม" },
    ],
  },
  {
    title: "ช่วยเหลือและบัญชี",
    links: [
      { href: "/faq", label: "คำถามที่พบบ่อย" },
      { href: "/help", label: "ศูนย์ช่วยเหลือ" },
      { href: "/track", label: "ติดตามพัสดุ" },
      { href: "/help/delivery", label: "การจัดส่งและคืนสินค้า" },
      { href: "/help/payment", label: "การชำระเงิน" },
      { href: "/loyalty", label: "สิทธิสมาชิก" },
      { href: "/stores", label: "สาขาและติดต่อเรา" },
    ],
  },
];
