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
// The structure — wordmark left, the link columns in a row beside it, one
// quiet line across the bottom under an oversized watermark — follows the
// reference the team picked, on the site's own pale surface rather than that
// reference's dark band.

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
const FACEBOOK_URL = "https://www.facebook.com/smoothlifeofficial";
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

// slate-600 rather than slate-500: on surface-soft (#F4FAF8) the 500 lands at
// 4.5:1, exactly on the AA line with nothing to spare. 600 is 7.2:1.
const linkClass =
  "text-sm text-slate-600 transition-colors hover:text-brand-800 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-action/40 rounded-sm";
const headingClass =
  "mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500";

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
            className="mt-0.5 shrink-0 text-brand-emerald"
            aria-hidden
          />
          <span>
            <span className="block font-semibold text-brand-ink">
              {TEL_DISPLAY}
            </span>
            <span className="text-xs">โทรหาทีมบริการลูกค้า</span>
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
          <Facebook size={16} className="shrink-0 text-brand-emerald" aria-hidden />
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
            className="shrink-0 text-brand-emerald"
            aria-hidden
          />
          <span>LINE {LINE_HANDLE}</span>
        </a>
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
    // No top margin: the page background is white, so 64px of it showed as a
    // blank band between a tinted section and the footer. The footer has its
    // own border, background and padding to separate itself with.
    <footer className="border-t border-surface-line bg-surface-soft">
      <div className="container-page py-10 md:py-14">
        {/* The wordmark and what the shop is, then everything else in a row
            beside it — the arrangement the reference uses, and the one that
            stops the contact details being mistaken for a fourth link list. */}
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-16">
          <div>
            <BrandLogo className="mb-3 h-7" />
            <p className="max-w-xs text-sm text-slate-600">
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
                  className="group border-b border-surface-line last:border-b-0"
                >
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
        </div>

        {/* Payment + security. The site claims "ของแท้ 100% มีอย." at the top of
            this same footer and then offered nothing to back it — this row is
            the backing. */}
        <div className="mt-10 flex flex-col gap-4 border-t border-surface-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              ชำระเงินปลอดภัย
            </span>
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

        {/* Copyright and the legal links sit up here with the payment row
            rather than in a strip of their own. Down there they were a line of
            text alone on a band, and the band only exists to hold the
            mascot's clearance — which does not need a sentence in it. */}
        <div className="mt-4 flex flex-col items-center justify-between gap-2 text-xs text-slate-600 sm:flex-row">
          <span>© 2026 Smoothlife.com</span>
          <div className="flex items-center gap-1">
            <Link href="/privacy" className={`${linkClass} px-2 py-1 text-xs`}>
              นโยบายความเป็นส่วนตัว
            </Link>
            <span aria-hidden className="text-slate-300">
              ·
            </span>
            <Link href="/terms" className={`${linkClass} px-2 py-1 text-xs`}>
              เงื่อนไขการใช้บริการ
            </Link>
          </div>
        </div>
      </div>

      {/* The name, oversized and running off both edges, filling the band the
          mascot's clearance already leaves at the bottom of the page.
          Decoration only: aria-hidden and unselectable.

          The height is that clearance: the QuickChat mascot is a fixed 64px
          (96px from lg) button sitting 60px up on phones and 12px up on
          desktop, and it can be dragged to either side — so the only
          clearance that holds is vertical. Measured: it covers the bottom
          124px of the viewport below lg (the layout already contributes a
          60px spacer there) and 108px from lg. */}
      <div
        aria-hidden
        className="relative overflow-hidden border-t border-surface-line bg-white/60 h-[calc(5rem+env(safe-area-inset-bottom))] lg:h-32"
      >
        <span className="pointer-events-none absolute inset-x-0 -bottom-[0.18em] select-none text-center font-extrabold leading-none tracking-tight whitespace-nowrap text-brand-800/[0.07] [font-size:clamp(5rem,20vw,18rem)]">
          Smoothlife
        </span>
      </div>
    </footer>
  );
}
