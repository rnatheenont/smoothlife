import { products } from "@/data/products";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-card";

// The product's photo, centred on a white card. See lib/og-card.
//
// Nothing is prerendered here for the same reason the page itself is not:
// 900-odd cards at build time, for pages most people never open.

export const alt = "สินค้าบน Smoothlife.com";
// Cached per slug for a day: the photo behind it changes when the shop
// changes it, not when somebody shares the link.
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((p) => p.slug === slug);
  // A blank white card is still the right size and still beats a failed
  // render, which would leave the preview with no picture at all.
  return ogCard({ image: product?.image });
}
