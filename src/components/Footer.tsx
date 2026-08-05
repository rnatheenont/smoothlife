import Link from "next/link";
import { Facebook, Instagram, MessageCircle } from "lucide-react";

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "สินค้าทั้งหมด" },
      { href: "/brands", label: "แบรนด์ทั้งหมด" },
      { href: "/promotions", label: "โปรโมชั่น" },
      { href: "/concern", label: "Shop by Concern" },
    ],
  },
  {
    title: "Why Smooth Life",
    links: [
      { href: "/about", label: "เกี่ยวกับเรา" },
      { href: "/about/quality", label: "คุณภาพและมาตรฐาน" },
      { href: "/about/experts", label: "ผู้เชี่ยวชาญและพาร์ทเนอร์" },
      { href: "/about/sustainability", label: "ความรับผิดชอบต่อสังคม" },
    ],
  },
  {
    title: "Help & Account",
    links: [
      { href: "/help", label: "ศูนย์ช่วยเหลือ" },
      { href: "/help/delivery", label: "การจัดส่งและคืนสินค้า" },
      { href: "/help/payment", label: "การชำระเงิน" },
      { href: "/stores", label: "สาขาและติดต่อเรา" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-100 bg-surface-soft">
      <div className="container-page py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
        <div className="col-span-2">
          <div className="font-extrabold text-xl mb-3">
            <span className="brand-text-gradient">Smoothlife</span>
            <span className="text-brand-sky">.com</span>
          </div>
          <p className="text-sm text-slate-500 max-w-xs">
            ศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงาม ของแท้ 100% มีอย. จัดส่งทั่วไทย
          </p>
          <div className="flex items-center gap-3 mt-4">
            <a href="#" aria-label="Facebook" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-card text-slate-500 hover:text-brand-emerald">
              <Facebook size={16} />
            </a>
            <a href="#" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-card text-slate-500 hover:text-brand-emerald">
              <Instagram size={16} />
            </a>
            <a href="#" aria-label="LINE Official" className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-card text-slate-500 hover:text-brand-emerald">
              <MessageCircle size={16} />
            </a>
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="font-semibold text-sm text-brand-ink mb-3">{col.title}</h4>
            <ul className="space-y-2">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-slate-500 hover:text-brand-emerald transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-200">
        <div className="container-page py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
          <span>© 2026 Smoothlife.com — เว็บไซต์เดโมสำหรับการนำเสนอ (Prototype)</span>
          <div className="flex items-center gap-4">
            <Link href="/help/payment" className="hover:text-brand-emerald">นโยบายความเป็นส่วนตัว</Link>
            <Link href="/help/delivery" className="hover:text-brand-emerald">เงื่อนไขการใช้บริการ</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
