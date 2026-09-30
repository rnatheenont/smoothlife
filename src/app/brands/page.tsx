import {
  brands,
  brandProducts,
  houseBrands,
  isHouseBrand,
} from "@/data/brands";
import { pageMetadata } from "@/lib/site-pages";
import BrandsDirectory, { BrandEntry } from "./BrandsDirectory";

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
    thai: b.origin?.thai,
    // Nothing in the catalogue records units sold, but every product carries
    // its real review count — so how many people have actually written about
    // a brand's products stands in for how well known it is. It is a measured
    // number, not a hand-picked "featured" list that would go stale.
    reviews: items.reduce((n, p) => n + (p.reviewCount ?? 0), 0),
  };
}

export default function BrandsPage() {
  const house = houseBrands.map(entry);
  const rest = brands.filter((b) => !isHouseBrand(b.slug)).map(entry);

  return <BrandsDirectory house={house} brands={rest} />;
}
