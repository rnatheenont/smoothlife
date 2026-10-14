import { z } from "zod";
import { brands, brandProducts, houseBrands, isHouseBrand } from "@/data/brands";
import BrandsDirectory, { type BrandEntry } from "@/app/brands/BrandsDirectory";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The brand directory, whole.
//
// One locked section rather than a header plus a grid, because the thing on
// this page is an application: searching, sorting and filtering sixty-odd
// brands all happen in the browser against one list, and its own heading is
// part of that state. Cutting it into editable blocks would mean handing the
// editor three pieces that only work when all three are present and in order.
//
// What moving it in buys, then, is not editing the directory — it is being
// able to put something above or below it (a campaign strip, a note about a
// brand's stock) without a deploy.

const schema = z.object({});

type Data = { house: BrandEntry[]; rest: BrandEntry[] };

// A brand's categories are not written down anywhere — they are what its
// products actually are, counted here so the filter can never promise a brand
// the catalogue does not back up.
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

async function load(): Promise<Data> {
  return {
    house: houseBrands.map(entry),
    rest: brands.filter((b) => !isHouseBrand(b.slug)).map(entry),
  };
}

function Component({ data }: SectionProps<z.output<typeof schema>, Data>) {
  if (!data) return null;
  return <BrandsDirectory house={data.house} brands={data.rest} />;
}

export const brandDirectory: SectionDefinition<typeof schema> = {
  type: "brand_directory",
  version: 1,
  label: "สารบัญแบรนด์",
  description: "หน้ารวมแบรนด์ทั้งหมด พร้อมค้นหา เรียง และกรองตามหมวด — ทำงานในตัวเอง ไม่มีค่าตั้ง",
  category: "brand",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};
