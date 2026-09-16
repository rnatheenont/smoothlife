import type { HeroBanner } from "@/data/heroBanners";
import { brands } from "@/data/brands";
import { getCollectionByHandle } from "@/data/collections";

// The homepage slideshow, read off the public www.smoothlife.com homepage —
// the same slides the team edits in the Shopify theme, desktop and phone
// image each, with the link each slide opens. Reading the rendered page needs
// no Admin API scope (the theme route below it needs read_themes, which the
// app doesn't have) and only ever GETs a public URL, so nothing on
// smoothlife.com is touched. Cached for 30 minutes; a failed read or a
// markup change returns null and the caller keeps its fallback banners.

const STOREFRONT = "https://www.smoothlife.com";
const REVALIDATE_SECONDS = 1800;

function absolute(url: string, width: number): string {
  const full = url.startsWith("//") ? `https:${url}` : url.startsWith("/") ? `${STOREFRONT}${url}` : url;
  const u = new URL(full.replace(/&amp;/g, "&"));
  u.searchParams.set("width", String(width));
  return u.toString();
}

// Where a slide should lead on this site. smoothlife.com links to its own
// collection pages; a brand collection maps onto the shop filtered to that
// brand (how the old static banners linked), any other collection we also
// carry opens our copy of it, and anything else lands on the shop.
function localHref(href: string): string {
  const path = href.replace(/^https?:\/\/(www\.)?smoothlife\.com/i, "");
  const collection = path.match(/^\/collections\/([^/?#]+)/);
  if (collection) {
    const handle = collection[1];
    if (brands.some((b) => b.slug === handle)) return `/shop?brand=${handle}`;
    if (getCollectionByHandle(handle)) return `/collections/${handle}`;
    return "/shop";
  }
  const product = path.match(/^\/products\/([^/?#]+)/);
  if (product) return `/product/${product[1]}`;
  return "/shop";
}

export async function getStorefrontHeroBanners(): Promise<HeroBanner[] | null> {
  try {
    const res = await fetch(`${STOREFRONT}/`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SmoothlifeWeb/1.0)" },
      next: { revalidate: REVALIDATE_SECONDS, tags: ["storefront-banners"] },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Each slide: <div class="ai-banner-slideshow__slide-…"> <a href> <picture>
    // <source media="(max-width: 768px)" srcset="PHONE"> <img src="DESKTOP">
    const slides = html.split(/<div class="ai-banner-slideshow__slide-[^"]*"/).slice(1);
    const banners: HeroBanner[] = [];
    slides.forEach((chunk, i) => {
      const block = chunk.slice(0, 2500);
      const href = block.match(/<a[^>]+href="([^"]+)"/)?.[1];
      const phone = block.match(/<source[^>]+srcset="([^"\s]+)/)?.[1];
      const desktop = block.match(/<img[^>]+src="([^"\s]+)/)?.[1];
      if (!desktop) return;
      banners.push({
        slug: `storefront-${i + 1}`,
        image: absolute(desktop, 2000),
        mobileImage: phone ? absolute(phone, 1200) : undefined,
        href: href ? localHref(href) : "/shop",
      });
    });
    return banners.length > 0 ? banners : null;
  } catch (err) {
    console.error("[storefront-banners] read failed", err);
    return null;
  }
}
