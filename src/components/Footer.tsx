import Link from "next/link";
import {
  Facebook,
  MessageCircle,
  Phone,
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
//
// Dark, in the brand's own deep green (#0b3b36) rather than the pale surface
// it used to sit on: the footer is the end of the page, and a band of colour
// is what tells you you have reached it. The structure — wordmark left, the
// link columns in a row beside it, one quiet line of contact and legal across
// the bottom — follows the reference the team picked.

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

// The real channels, from the team's contact sheet. Kept in sync with
// /stores and /help/contact — the three places a customer can read a phone
// number, and they must not disagree.
//
// No Instagram here and no support@ address: an icon pointing at "#" and a
// mailbox nobody has promised to read are worse than the channels being
// listed honestly as the three that are actually answered.
const TEL_DISPLAY = "085-489-0549";
const TEL_HREF = "tel:0854890549";
const FACEBOOK_URL = "https://www.facebook.com/smoothlifeoffcial";
const LINE_HANDLE = "@smoothlifeofficial";
const LINE_URL = "https://line.me/R/ti/p/@smoothlifeofficial";
const HOURS = "ทุกวัน 09:00–18:00 น.";

const socials = [
  { label: "Facebook", href: FACEBOOK_URL, Icon: Facebook },
  { label: `LINE Official ${LINE_HANDLE}`, href: LINE_URL, Icon: MessageCircle },
];

// Only what checkout actually accepts (2C2P: card + PromptPay QR). No badge
// for a method the site cannot take.
const payments = [
  { label: "บัตรเครดิต / เดบิต", Icon: CreditCard },
  { label: "พร้อมเพย์ QR", Icon: QrCode },
];

// On #0b3b36, white/75 is 8.9:1 and white/60 is 6.0:1 — both clear of AA, so
// the quiet text stays quiet without dropping below it.
const linkClass =
  "text-sm text-white/75 transition-colors hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-teal/60 rounded-sm";
const headingClass =
  "mb-2 text-xs font-semibold uppercase tracking-wider text-white/50";

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
    <ul className="space-y-2">
      <li>
        <a
          href={TEL_HREF}
          className={`${linkClass} flex items-start gap-2.5 py-1`}
        >
          <Phone
            size={16}
            className="mt-0.5 shrink-0 text-brand-teal"
            aria-hidden
          />
          <span>
            <span className="block font-semibold text-white">
              {TEL_DISPLAY}
            </span>
            <span className="text-xs text-white/60">โทรหาทีมบริการลูกค้า</span>
          </span>
        </a>
      </li>
      <li>
        <a
          href={FACEBOOK_URL}
          target="_blank"
          rel="noreferrer noopener"
          className={`${linkClass} flex items-center gap-2.5 py-1`}
        >
          <Facebook size={16} className="shrink-0 text-brand-teal" aria-hidden />
          <span>ทักแชท Facebook</span>
        </a>
      </li>
      <li>
        <a
          href={LINE_URL}
          target="_blank"
          rel="noreferrer noopener"
          className={`${linkClass} flex items-center gap-2.5 py-1`}
        >
          <MessageCircle
            size={16}
            className="shrink-0 text-brand-teal"
            aria-hidden
          />
          <span>LINE {LINE_HANDLE}</span>
        </a>
      </li>
      <li className="flex items-center gap-2.5 py-1 text-sm text-white/60">
        <Clock size={16} className="shrink-0 text-white/40" aria-hidden />
        <span>{HOURS}</span>
      </li>
    </ul>
  );
}

export default function Footer() {
  return (
    <footer className="mt-16 bg-brand-dark text-white">
      <div className="container-page py-10 md:py-14">
        {/* The wordmark and what the shop is, then everything else in a row
            beside it — the arrangement the reference uses, and the one that
            stops the contact details being mistaken for a fourth link list. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <BrandLogo className="mb-3 h-7 brightness-0 invert" />
            <p className="max-w-xs text-sm text-white/70">
              ศูนย์รวมสินค้าและบริการเพื่อสุขภาพและความงาม ของแท้ 100% มีอย.
              จัดส่งทั่วไทย
            </p>
            <div className="mt-6">
              <FooterNewsletter />
            </div>
            <ul className="mt-6 flex items-center gap-2">
              {socials.map(({ label, href, Icon }) => (
                <li key={label}>
                  <a
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noreferrer noopener"
                    // 44×44 hit area (WCAG 2.5.5); the circle inside stays 36px
                    // so the row looks the same as before.
                    className="grid h-11 w-11 place-items-center rounded-full text-white/80 transition-colors hover:text-white focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-teal/60"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white/10">
                      <Icon size={16} aria-hidden />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Link columns + contact — desktop */}
          <div className="hidden md:grid md:grid-cols-4 md:gap-8">
            {columns.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className={headingClass}>{col.title}</h2>
                <LinkList links={col.links} />
              </nav>
            ))}
            <div>
              <h2 className={headingClass}>ติดต่อเรา</h2>
              <ContactBlock />
            </div>
          </div>

          {/* Mobile: contact stays open (it is the reason most people scroll
              this far), the three link columns collapse so the footer does not
              run to three screens on a phone. */}
          <div className="md:hidden">
            <h2 className={headingClass}>ติดต่อเรา</h2>
            <ContactBlock />

            <nav aria-label="ลิงก์ส่วนท้ายเว็บไซต์" className="mt-4">
              {columns.map((col) => (
                <details
                  key={col.title}
                  className="group border-b border-white/10 last:border-b-0"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-sm font-semibold text-white marker:hidden focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-teal/60">
                    {col.title}
                    <ChevronDown
                      size={18}
                      className="shrink-0 text-white/40 transition-transform duration-200 group-open:rotate-180"
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
        </div>

        {/* Payment + security. The site claims "ของแท้ 100% มีอย." at the top of
            this same footer and then offered nothing to back it — this row is
            the backing. */}
        <div className="mt-10 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-white/50">
              ชำระเงินปลอดภัย
            </span>
            <ul className="flex flex-wrap items-center gap-2">
              {payments.map(({ label, Icon }) => (
                <li
                  key={label}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white/80"
                >
                  <Icon size={14} className="text-brand-teal" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-white/70">
            <ShieldCheck size={16} className="shrink-0 text-brand-teal" aria-hidden />
            เชื่อมต่อแบบเข้ารหัส SSL ทุกขั้นตอน
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 bg-black/15">
        {/* Bottom padding, not a right-hand gutter: the QuickChat mascot is a
            fixed 64px (96px from lg) button that sits 60px up on phones and 12px
            up on desktop, and it can be dragged to either side — so the only
            clearance that holds is vertical. Measured: it covers the bottom
            124px of the viewport below lg (the layout already contributes a
            60px spacer there) and 108px from lg. */}
        <div className="container-page flex flex-col items-center justify-between gap-2 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] text-xs text-white/60 sm:flex-row lg:pb-32">
          <span>© 2026 Smoothlife.com</span>
          <div className="flex items-center gap-1">
            <Link href="/privacy" className={`${linkClass} px-2 py-2 text-xs`}>
              นโยบายความเป็นส่วนตัว
            </Link>
            <span aria-hidden className="text-white/25">
              ·
            </span>
            <Link href="/terms" className={`${linkClass} px-2 py-2 text-xs`}>
              เงื่อนไขการใช้บริการ
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
