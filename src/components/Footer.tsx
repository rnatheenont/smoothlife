import Link from "next/link";
import { CONTACT_DEFAULT } from "@/lib/pages/contact";
import { FOOTER_COLUMNS_DEFAULT, type FooterColumns } from "@/lib/pages/footer-links";
import type { ComponentType } from "react";
import {
  Facebook,
  Instagram,
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
import { TikTokMark, LineMark } from "@/components/SocialMarks";

// Server component. Only the newsletter form holds state, and it lives in its
// own client file.
//
// The structure — wordmark left, the link columns in a row beside it, one
// quiet line across the bottom under an oversized watermark — follows the
// reference the team picked, on the site's own pale surface rather than that
// reference's dark band.

// The link columns arrive as a prop, read on the server by the layout — the
// same arrangement as the shop menu above, and for the same reason: this
// component is reached through a client component, so anything it imports
// ships to the browser, and a database client is the last thing that should.
// The built-in columns are the default, so a Footer rendered with no props
// is the footer the site has always had.

// The real channels, from the global contact record — one copy for the whole
// site now, instead of this file plus /stores plus /help/contact plus the
// campaign chrome, kept in step by a comment asking people to remember.
//
// Read from the constant rather than the stored document: the footer is on
// every page, and a database round trip per page for a phone number that
// changes twice a year is the wrong trade. The pages that already render
// from documents read the live one through contact_channels.
//
// No Instagram in the contact block and no support@ address: an icon
// pointing at "#" and a mailbox nobody has promised to read are worse than
// the channels being listed honestly as the three that are actually
// answered.
const TEL_DISPLAY = CONTACT_DEFAULT.phoneDisplay;
const TEL_HREF = CONTACT_DEFAULT.phoneHref;
const FACEBOOK_URL = CONTACT_DEFAULT.facebookUrl;
const INSTAGRAM_URL = CONTACT_DEFAULT.instagramUrl;
const TIKTOK_URL = CONTACT_DEFAULT.tiktokUrl;
const LINE_HANDLE = CONTACT_DEFAULT.lineHandle;
// Two different LINE links on purpose: the icon row is "follow us", and goes
// to the shop page; the contact block is "talk to us", and adds the OA as a
// friend so there is somewhere to type.
const LINE_SHOP_URL = CONTACT_DEFAULT.lineShopUrl;
const LINE_URL = CONTACT_DEFAULT.lineChatUrl;
const HOURS = CONTACT_DEFAULT.hours;

// The four the shop actually posts on. Same list and same links as the
// campaign pages' footer (see campaign/StoreChrome.tsx).
const socials: {
  label: string;
  href: string;
  Icon: ComponentType<{ size?: number; "aria-hidden"?: boolean }>;
}[] = [
  { label: "Facebook", href: FACEBOOK_URL, Icon: Facebook },
  { label: "Instagram", href: INSTAGRAM_URL, Icon: Instagram },
  { label: "TikTok", href: TIKTOK_URL, Icon: TikTokMark },
  { label: `LINE ${LINE_HANDLE}`, href: LINE_SHOP_URL, Icon: LineMark },
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

function LinkList({ links }: { links: FooterColumns[number]["links"] }) {
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
          {/* The column above is sized to fit the handle, so these two are
              only a backstop: a flex child will not shrink below its longest
              unbreakable word, which is how the overflow happened in the first
              place. Keeping them means a narrower column wraps instead of
              scrolling the page sideways again. */}
          <span className="min-w-0 break-words">LINE {LINE_HANDLE}</span>
        </a>
      </li>
      <li className="flex items-center gap-2.5 py-1 text-sm text-slate-600">
        <Clock size={16} className="shrink-0 text-slate-400" aria-hidden />
        <span>{HOURS}</span>
      </li>
    </ul>
  );
}

export default function Footer({ columns = FOOTER_COLUMNS_DEFAULT }: { columns?: FooterColumns }) {
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

          {/* Link columns + contact — desktop.

              Contact gets a wider column than the three link lists rather than
              an equal quarter: the link lists hold short Thai labels, contact
              holds a phone number and a 19-character LINE handle with nowhere
              to break. On four equal columns that came to 124px each, and the
              handle alone needs ~127px — so it pushed past the viewport and
              gave every page a 4px horizontal scrollbar between 1024px and
              about 1200px. */}
          <div className="hidden md:grid md:grid-cols-[1fr_1fr_1fr_1.5fr] md:gap-8">
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
        className="relative overflow-hidden border-t border-surface-line bg-white/60 h-[clamp(6rem,14vw,12rem)] lg:h-[clamp(8rem,14vw,12rem)]"
      >
        {/* Sitting on the bottom edge rather than hanging off it, so the whole
            word reads instead of its lower half. Only the descender of the "f"
            crosses the edge. */}
        <span className="pointer-events-none absolute inset-x-0 -bottom-[0.06em] select-none text-center font-extrabold leading-none tracking-tight whitespace-nowrap text-brand-800/[0.07] [font-size:clamp(4rem,15vw,13rem)]">
          Smoothlife
        </span>
      </div>
    </footer>
  );
}
