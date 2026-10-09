import { getProductBySlug } from "@/data/products";
import { SITE_URL } from "@/lib/site-url";
import type { ResolvedProduct } from "@/lib/channels/markers";

// How a [[slug]] marker resolves on the channels that sell from our own site:
// web, LINE, and anything else that can send a customer to smoothlife.
//
// A marketplace channel will not use this. On Shopee or TikTok the same
// product is that shop's own item, the customer never leaves the app, and
// links are banned outright — so those adapters resolve against
// marketplace_item_map and pass a resolver that returns a name and no url.

export function resolveFromCatalog(slug: string): ResolvedProduct | null {
  const product = getProductBySlug(slug);
  if (!product) return null;
  return { name: product.name, url: `${SITE_URL}/product/${product.slug}` };
}
