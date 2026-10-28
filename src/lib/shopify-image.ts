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
 * Square crops of the same photo, for a slot that is drawn square.
 *
 * The product card is `aspect-square` with `object-cover`, so a 560×948
 * packshot is decoded whole and then has two thirds of it thrown away by the
 * crop — the phone pays for every one of those pixels in memory. Shopify
 * crops on request, so asking for the square is both smaller to download and
 * smaller once decoded.
 *
 * Widths, not one width: `images.unoptimized` is on, which means next/image
 * emits a bare <img> with no srcset and quietly drops the `sizes` prop, so
 * the browser is handed exactly one candidate and takes it whatever size the
 * screen is. Measured on a 375px phone: 120 card images at 560px wide came
 * to 147 MB of decoded image, which is what was killing the tab.
 */
export function shopifySquareSrcSet(
  url: string | undefined,
  widths: number[] = [180, 240, 320, 400, 480]
): string | undefined {
  if (!url || !SHOPIFY_CDN.test(url)) return undefined;
  return widths.map((w) => `${shopifySquare(url, w)} ${w}w`).join(", ");
}

/** One square crop at the given side length. */
export function shopifySquare(url: string | undefined, side: number): string | undefined {
  if (!url) return url;
  if (!SHOPIFY_CDN.test(url)) return url;
  try {
    const u = new URL(url);
    const n = String(Math.round(side));
    u.searchParams.set("width", n);
    u.searchParams.set("height", n);
    u.searchParams.set("crop", "center");
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
