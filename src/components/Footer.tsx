import Link from "next/link";
import {
  Facebook,
  Instagram,
  MessageCircle,
  Phone,
  Mail,
  Clock,
  ShieldCheck,
  CreditCard,
  QrCode,
  ChevronDown,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";
import FooterNewsletter from "@/components/FooterNewsletter";

// Server component. Only the newsletter form holds state, and it lives in its
// own client file.

type Col = { title: string; links: { href: string; label: string }[] };

const columns: Col[] = [
  {
    title: "ช้อปปิ้ง",
    links: [
      { href: "/shop", label: "สินค้าทั้งหมด" },
      { href: "/brands", label: "แบรนด์ทั้งหมด" },
      { href: "/promotions", label: "โปรโมชั่น" },
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
      { href: "/help", label: "ศูนย์ช่วยเหลือ" },
      { href: "/track", label: "ติดตามพัสดุ" },
      { href: "/help/delivery", label: "การจัดส่งและคืนสินค้า" },
      { href: "/help/payment", label: "การชำระเงิน" },
      { href: "/loyalty", label: "สิทธิสมาชิก" },
      { href: "/stores", label: "สาขาและติดต่อเรา" },
    ],
  },
];

// One place to fix when the real accounts exist. LINE is derivable from the
// OA handle the contact pages already publish; Facebook and Instagram have no
// URL anywhere in the codebase yet, so they stay "#" rather than pointing at
// an invented page.
const socials = [
  { label: "Facebook", href: "#", Icon: Facebook },
  { label: "Instagram", href: "#", Icon: Instagram },
  { label: "LINE Official @smoothlifeofficial", href: "https://line.me/R/ti/p/@smoothlifeofficial", Icon: MessageCircle },
];

// Kept in sync with the contact details on /stores and /help/contact.
const TEL_DISPLAY = "02-000-0000";
const TEL_HREF = "tel:020000000";
const EMAIL = "support@smoothlife.com";
const HOURS = "ทุกวัน 9:00–20:00 น.";

// Only what checkout actually accepts (2C2P: card + PromptPay QR). No badge
// for a method the site cannot take.
const payments = [
  { label: "บัตรเครดิต / เดบิต", Icon: CreditCard },
  { label: "พร้อมเพย์ QR", Icon: QrCode },
];

// slate-600 rather than the old slate-500: on surface-soft (#F4FAF8) the 500
// lands at 4.5:1, exactly on the AA line with nothing to spare. 600 is 7.2:1.
const linkClass =
  "text-sm text-slate-600 transition-colors hover:text-brand-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action/40 rounded-sm";

function LinkList({ links }: { links: Col["links"] }) {
  return (
    <ul className="space-y-1">
      {links.map((l) => (
        <li key={l.href}>
          {/* py-2 gives each row a 40px hit area on touch without opening
              the visual rhythm up the way a taller row would. */}
          <Link href={l.href} className={`${linkClass} block py-2 md:py-1`}>
            {l.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function ContactBlock() {
  return (
    <ul className="space-y-3">
      <li>
        <a href={TEL_HREF} className={`${linkClass} flex items-start gap-2.5 py-1`}>
          <Phone size={16} className="mt-0.5 shrink-0 text-brand-emerald" aria-hidden />
          <span>
            <span className="block font-semibold text-brand-ink">{TEL_DISPLAY}</span>
            <span className="text-xs">โทรหาทีมบริการลูกค้า</span>
          </span>
        </a>
      </li>
      <li>
        <a href={`mailto:${EMAIL}`} className={`${linkClass} flex items-center gap-2.5 py-1`}>
          <Mail size={16} className="shrink-0 text-brand-emerald" aria-hidden />
          <span className="break-all">{EMAIL}</span>
        </a>
      </li>
      <li>
        <Link href="/help/contact" className={`${linkClass} flex items-center gap-2.5 py-1`}>
          <MessageCircle size={16} className="shrink-0 text-brand-emerald" aria-hidden />
          <span>แชทกับเรา · LINE @smoothlifeofficial</span>
        </Link>
      </li>
      <li className="flex items-center gap-2.5 py-1 text-sm text-slate-600">
        <Clock size={16} className="shrink-0 text-slate-400" aria-hidden />
        <span>{HOURS}</span>
      </li>
    </ul>
  );
}

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-surface-line bg-surface-soft">
      <div className="container-page py-10 md:py-12">
        <div className="grid gap-8 md:grid-cols-12 md:gap-10">
          {/* Brand + newsletter */}
          <div className="md:col-span-4 lg:col-span-4">
            <BrandLogo className="mb-3 h-7" />
            <p className="max-w-xs text-sm text-slate-600">
              ศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงาม ของแท้ 100% มีอย. จัดส่งทั่วไทย
            </p>
            <div className="mt-5">
              <FooterNewsletter />
            </div>
            <ul className="mt-5 flex items-center gap-2">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    aria-label={label}
                    {...(href.startsWith("http") ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                    // 44×44 hit area (WCAG 2.5.5); the circle inside stays 36px
                    // so the row looks the same as before.
                    className="grid h-11 w-11 place-items-center rounded-full text-slate-600 transition-colors hover:text-brand-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action/40"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white shadow-card">
                      <Icon size={16} aria-hidden />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Link columns — desktop */}
          <nav aria-label="ลิงก์ส่วนท้ายเว็บไซต์" className="hidden md:col-span-5 md:grid md:grid-cols-3 md:gap-8 lg:col-span-5">
            {columns.map((col) => (
              <div key={col.title}>
                <h2 className="mb-2 text-sm font-semibold text-brand-ink">{col.title}</h2>
                <LinkList links={col.links} />
              </div>
            ))}
          </nav>

          {/* Contact — desktop */}
          <div className="hidden md:col-span-3 md:block lg:col-span-3">
            <h2 className="mb-3 text-sm font-semibold text-brand-ink">ติดต่อเรา</h2>
            <ContactBlock />
          </div>

          {/* Mobile: contact stays open (it is the reason most people scroll
              this far), the three link columns collapse so the footer does not
              run to three screens on a phone. */}
          <div className="md:hidden">
            <h2 className="mb-3 text-sm font-semibold text-brand-ink">ติดต่อเรา</h2>
            <ContactBlock />
          </div>

          <nav aria-label="ลิงก์ส่วนท้ายเว็บไซต์" className="-mt-2 md:hidden">
            {columns.map((col) => (
              <details key={col.title} className="group border-b border-surface-line last:border-b-0">
                <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-sm font-semibold text-brand-ink marker:hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action/40">
                  {col.title}
                  <ChevronDown
                    size={18}
                    className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="pb-3">
                  <LinkList links={col.links} />
                </div>
              </details>
            ))}
          </nav>
        </div>

        {/* Payment + security. The site claims "ของแท้ 100% มีอย." at the top of
            this same footer and then offered nothing to back it — this row is
            the backing. */}
        <div className="mt-6 flex flex-col gap-4 border-t border-surface-line pt-6 md:mt-10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">ชำระเงินปลอดภัย</span>
            <ul className="flex flex-wrap items-center gap-2">
              {payments.map(({ label, Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 rounded-full border border-surface-line bg-white px-3 py-1.5 text-xs text-slate-600"
                >
                  <Icon size={14} className="text-brand-emerald" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-slate-600">
            <ShieldCheck size={16} className="shrink-0 text-brand-emerald" aria-hidden />
            เชื่อมต่อแบบเข้ารหัส SSL ทุกขั้นตอน
          </p>
        </div>
      </div>

      <div className="border-t border-surface-line bg-white/60">
        {/* Bottom padding, not a right-hand gutter: the QuickChat mascot is a
            fixed 64px (96px from lg) button that sits 60px up on phones and 12px
            up on desktop, and it can be dragged to either side — so the only
            clearance that holds is vertical. Measured: it covers the bottom
            124px of the viewport below lg (the layout already contributes a
            60px spacer there) and 108px from lg. */}
        <div className="container-page flex flex-col items-center justify-between gap-2 pt-4 pb-20 text-xs text-slate-600 sm:flex-row lg:pb-32">
          <span>© 2026 Smoothlife.com — เว็บไซต์เดโมสำหรับการนำเสนอ (Prototype)</span>
          <div className="flex items-center gap-1">
            <Link href="/privacy" className={`${linkClass} px-2 py-2 text-xs`}>
              นโยบายความเป็นส่วนตัว
            </Link>
            <span aria-hidden className="text-slate-300">·</span>
            <Link href="/terms" className={`${linkClass} px-2 py-2 text-xs`}>
              เงื่อนไขการใช้บริการ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
