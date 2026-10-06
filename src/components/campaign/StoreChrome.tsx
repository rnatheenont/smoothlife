import Image from "next/image";
import type { ReactNode } from "react";
import { CircleUser, Facebook, Instagram } from "lucide-react";
import BackToStore from "@/components/campaign/BackToStore";
import { TikTokMark, LineMark } from "@/components/SocialMarks";

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
  ["Facebook", "https://www.facebook.com/smoothlifeofficial/", <Facebook key="f" size={20} />],
  ["Instagram", "https://www.instagram.com/smoothlife_official", <Instagram key="i" size={20} />],
  ["TikTok", "https://www.tiktok.com/@smoothlife_pharmacy", <TikTokMark key="t" />],
  ["LINE", "https://shop.line.me/@smoothlifeofficial", <LineMark key="l" />],
];

/**
 * @param storeUrl where the way out leads — the shelf this campaign is about,
 *   not the front door. A campaign that does not say gets the full listing.
 */
export function StoreHeader({ storeUrl }: { storeUrl?: string }) {
  return (
    // Stays put: the page below it is a form long enough to scroll, and the
    // only way back to the shop should not be the thing you scroll away from.
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <a href={storeUrl ?? STORE} aria-label="Smoothlife.com">
          <Image src={LOGO} alt="Smoothlife.com" width={220} height={34} priority className="h-[26px] w-auto sm:h-8" />
        </a>
        <span className="flex shrink-0 items-center gap-2">
          {/* Getting back to the shop comes first: it is the way out, and the
              one most people reach for. */}
          <BackToStore fallback={storeUrl ?? `${STORE}/collections/all`} />
          {/* The shop's own account page, not this site's. Someone who arrived
              from a campaign link has an account at smoothlife.com — orders,
              addresses, points — and no reason to know this app exists, so
              "my account" has to mean the one they already have. */}
          <a
            href={`${STORE}/account`}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-black/15 px-3 text-[13px] font-semibold text-black hover:bg-black/5"
          >
            <CircleUser size={16} aria-hidden />
            <span className="hidden sm:inline">บัญชีของฉัน</span>
            <span className="sr-only sm:hidden">บัญชีของฉัน</span>
          </a>
        </span>
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
      {/* Brand beside the links rather than stacked above them: stacked, the
          two short lists left the right half of a desktop footer empty and
          made the whole thing twice as tall as it needed to be. */}
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
          <div className="sm:col-span-2 lg:col-span-1">
            <a href={STORE} aria-label="Smoothlife.com">
              <Image src={LOGO} alt="Smoothlife.com" width={220} height={34} className="h-7 w-auto" />
            </a>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-black/70">
              Smooth Life - Thailand&apos;s Leading Health &amp; Wellbeing Store. We sell a wide range of branded and
              own-label products across these categories and also own a number of trademarks for specific product
              lines.
            </p>
            <div className="mt-5 flex items-center gap-5 text-black">
              {SOCIAL.map(([label, href, icon]) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="hover:opacity-70"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {icon}
                </a>
              ))}
            </div>
          </div>

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
