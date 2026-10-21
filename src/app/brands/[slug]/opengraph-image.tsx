import { brands } from "@/data/brands";
import { ogCard, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og-card";

// The brand's logo, centred on a white card. See lib/og-card.
//
// This is the one that needed it most: several of these logos are 320x320,
// which is under the size LINE and Facebook want for a large card, so the
// link fell back to a thumbnail beside the text. On a 1200x630 card the same
// logo is a card.

export const alt = "แบรนด์บน Smoothlife.com";
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = brands.find((b) => b.slug === slug);
  return ogCard({ image: brand?.image });
}
