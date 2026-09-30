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
  const cats = [...new Set(brandProducts(b).map((p) => p.category))];
  const first = b.name.trim().charAt(0).toUpperCase();
  return {
    slug: b.slug,
    name: b.name,
    tagline: b.tagline,
    image: b.image,
    productCount: b.productCount,
    categories: cats,
    letter: /[A-Z]/.test(first) ? first : "#",
  };
}

export default function BrandsPage() {
  const house = houseBrands.map(entry);
  const rest = brands
    .filter((b) => !isHouseBrand(b.slug))
    .map(entry)
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return <BrandsDirectory house={house} brands={rest} />;
}
