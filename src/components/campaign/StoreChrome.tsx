import Image from "next/image";
import type { ReactNode } from "react";
import { Facebook, Instagram } from "lucide-react";

// The header and footer of www.smoothlife.com, for pages customers are sent to
// before this site has launched.
//
// A campaign link goes out to people who know the shop as smoothlife.com and
// have never seen this one. Landing them on unfamiliar chrome, with a menu and
// an account area belonging to a site that does not exist publicly yet, is how
// a real promotion starts looking like a phishing page. So the page wears the
// shop they already know and every way out leads back to it.
//
// The header is deliberately not the shop's: that one is a sixty-link mega
// menu, and a campaign page has one job. Logo and a way back to the store is
// the whole of it — which is also why this does not have to be kept in step
// with whatever the Shopify menu does next.

/** The live store. Every link here leaves this app on purpose. */
const STORE = "https://www.smoothlife.com";
const LOGO = `${STORE}/cdn/shop/files/Smooth_Life_logo-com_AW.png?v=1780626791&width=440`;

const SITEMAP: [string, string][] = [
  ["Shop", "/collections/all"],
  ["About", "/pages/about"],
  ["Contact", "/policies/contact-information"],
  ["Smooth Life Rewards", "/pages/smooth-life-rewards"],
];

const CUSTOMER_SERVICE: [string, string][] = [
  ["Terms of Service", "/policies/terms-of-service"],
  ["Shipping Terms", "/pages/shipping-conditions"],
  ["Privacy policy", "/policies/privacy-policy"],
  ["Return policy", "/pages/returns"],
  ["Refund policy", "/policies/refund-policy"],
  ["Shipping Policy", "/policies/shipping-policy"],
];

const SOCIAL: [string, string, ReactNode][] = [
  ["Facebook", "https://www.facebook.com/smoothlifeoffcial/", <Facebook key="f" size={20} />],
  ["Instagram", "https://www.instagram.com/smoothlife_official", <Instagram key="i" size={20} />],
  ["TikTok", "https://www.tiktok.com/@smoothlife_pharmacy", <TikTok key="t" />],
  ["LINE", "https://shop.line.me/@smoothlifeofficial", <Line key="l" />],
];

/** lucide has no TikTok or LINE mark; these are the two the shop's footer shows. */
function TikTok() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-1.79-2.46V9.78a5.87 5.87 0 1 0 4.88 5.78V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z" />
    </svg>
  );
}
function Line() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 5.64 2 10.13c0 4.02 3.55 7.39 8.35 8.03.33.07.77.22.88.5.1.26.07.66.03.92l-.14.85c-.04.25-.2.99.87.54s5.77-3.4 7.87-5.82c1.45-1.59 2.14-3.2 2.14-4.99C22 5.64 17.52 2 12 2ZM8.1 12.85H6.06a.27.27 0 0 1-.27-.27V8.5a.27.27 0 0 1 .27-.27h.53c.15 0 .27.12.27.27v3.28H8.1c.15 0 .27.12.27.27v.53c0 .15-.12.27-.27.27Zm1.6-.27c0 .15-.12.27-.27.27h-.53a.27.27 0 0 1-.27-.27V8.5c0-.15.12-.27.27-.27h.53c.15 0 .27.12.27.27v4.08Zm4.42 0c0 .15-.12.27-.27.27h-.53a.27.27 0 0 1-.21-.11l-1.87-2.52v2.36c0 .15-.12.27-.27.27h-.53a.27.27 0 0 1-.27-.27V8.5c0-.15.12-.27.27-.27h.55c.08 0 .16.04.21.11l1.85 2.5V8.5c0-.15.12-.27.27-.27h.53c.15 0 .27.12.27.27v4.08Zm3.55-3.55c0 .15-.12.27-.27.27h-1.51v.58h1.51c.15 0 .27.12.27.27v.53c0 .15-.12.27-.27.27h-1.51v.58h1.51c.15 0 .27.12.27.27v.53c0 .15-.12.27-.27.27h-2.31a.27.27 0 0 1-.27-.27V8.5c0-.15.12-.27.27-.27h2.31c.15 0 .27.12.27.27v.53Z" />
    </svg>
  );
}

export function StoreHeader() {
  return (
    <header className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <a href={STORE} aria-label="Smoothlife.com">
          <Image src={LOGO} alt="Smoothlife.com" width={220} height={34} priority className="h-[26px] w-auto sm:h-8" />
        </a>
        <a
          href={`${STORE}/collections/all`}
          className="shrink-0 rounded-full border border-black/15 px-4 py-2 text-[13px] font-semibold text-black hover:bg-black/5"
        >
          กลับไปหน้าร้าน
        </a>
      </div>
    </header>
  );
}

function FooterColumn({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-black">{title}</h2>
      <ul className="mt-3 flex flex-col gap-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <a href={`${STORE}${href}`} className="text-[14px] text-black/70 hover:text-black hover:underline">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StoreFooter() {
  return (
    <footer className="mt-16 border-t border-black/10 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <a href={STORE} aria-label="Smoothlife.com">
          <Image src={LOGO} alt="Smoothlife.com" width={220} height={34} className="h-7 w-auto" />
        </a>
        <p className="mt-4 max-w-md text-[14px] leading-relaxed text-black/70">
          Smooth Life - Thailand&apos;s Leading Health &amp; Wellbeing Store. We sell a wide range of branded and
          own-label products across these categories and also own a number of trademarks for specific product lines.
        </p>

        <div className="mt-5 flex items-center gap-5 text-black">
          {SOCIAL.map(([label, href, icon]) => (
            <a key={label} href={href} aria-label={label} className="hover:opacity-70" target="_blank" rel="noopener noreferrer">
              {icon}
            </a>
          ))}
        </div>

        <div className="mt-10 grid gap-8 border-t border-black/10 pt-8 sm:grid-cols-2">
          <FooterColumn title="Sitemap" links={SITEMAP} />
          <FooterColumn title="Customer Service" links={CUSTOMER_SERVICE} />
        </div>

        <p className="mt-10 border-t border-black/10 pt-6 text-[13px] text-black/60">
          © {new Date().getFullYear()} smoothlifethailand
        </p>
      </div>
    </footer>
  );
}
