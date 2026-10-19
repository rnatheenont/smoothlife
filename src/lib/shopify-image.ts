// The same Shopify photo, at the width it is actually drawn.
//
// Every catalogue image URL carries `width=700` (scripts/fetch-products.js),
// and the site runs with `images.unoptimized` — so whatever width the URL
// asks for is what the visitor downloads, wherever the picture is shown. A
// 28px ticker thumbnail and a product card were both pulling the 700px file.
// Shopify's CDN resizes on request, so asking for the size we draw is free.
//
// Leaves anything that is not a Shopify CDN URL alone: pictures the team
// uploaded themselves are already stored at their own sizes.

const SHOPIFY_CDN = /^https:\/\/(cdn\.shopify\.com|www\.smoothlife\.com\/cdn\/shop)\//;

export function shopifyImage(url: string, width: number): string;
export function shopifyImage(url: string | undefined, width: number): string | undefined;
export function shopifyImage(url: string | undefined, width: number): string | undefined {
  if (!url || !SHOPIFY_CDN.test(url)) return url;
  try {
    const u = new URL(url);
    u.searchParams.set("width", String(Math.round(width)));
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * The same photo at several widths, for the browser to choose between.
 *
 * A banner drawn edge to edge is the one image on the page whose right size
 * depends entirely on the screen: the homepage hero was shipping the 2000px
 * file to every phone, 434 KB of it, when 480px and 51 KB covers a 360px
 * display. On the throttled connection Lighthouse scores with, that single
 * difference is most of the Largest Contentful Paint.
 *
 * Returns undefined for anything we cannot resize, so the caller leaves the
 * attribute off entirely rather than emitting the same URL several times
 * under different widths and lying to the browser about the choice.
 */
export function shopifySrcSet(
  url: string | undefined,
  widths: number[] = [480, 768, 1024, 1440, 2000]
): string | undefined {
  if (!url || !SHOPIFY_CDN.test(url)) return undefined;
  return widths.map((w) => `${shopifyImage(url, w)} ${w}w`).join(", ");
}
