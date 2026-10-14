import {
  brands,
  brandProducts,
  houseBrands,
  isHouseBrand,
} from "@/data/brands";
import { pageMetadata } from "@/lib/site-pages";
import BrandsDirectory, { BrandEntry } from "./BrandsDirectory";
import { PAGES_WAVE2_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";

export function generateMetadata() {
  return pageMetadata("brands");
}

// A brand's categories are not written down anywhere — they are what its
// products actually are, counted here at build time so the filter can never
// promise a brand the catalogue does not back up.
function entry(b: (typeof brands)[number]): BrandEntry {
  const items = brandProducts(b);
  return {
    slug: b.slug,
    name: b.name,
    tagline: b.tagline,
    image: b.image,
    productCount: b.productCount,
    categories: [...new Set(items.map((p) => p.category))],
    // Nothing in the catalogue records units sold, but every product carries
    // its real review count — so how many people have actually written about
    // a brand's products stands in for how well known it is. It is a measured
    // number, not a hand-picked "featured" list that would go stale.
    reviews: items.reduce((n, p) => n + (p.reviewCount ?? 0), 0),
  };
}

function BrandsPageWritten() {
  const house = houseBrands.map(entry);
  const rest = brands.filter((b) => !isHouseBrand(b.slug)).map(entry);

  return <BrandsDirectory house={house} brands={rest} />;
}

/**
 * The page, from its document when wave 2 is on and from the markup above
 * when it is not. Both halves stay in the tree on purpose — the flag is the
 * emergency switch, and it only works while the hand-written half is here.
 */
export default function BrandsPage() {
  if (PAGES_WAVE2_ENABLED) return <SystemPageBody pageKey="brands" />;
  return <BrandsPageWritten />;
}
