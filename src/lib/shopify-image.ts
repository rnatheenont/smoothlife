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
