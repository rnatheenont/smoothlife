import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import ShopFilters from "@/components/ShopFilters";
import SortMenu from "@/components/shop/SortMenu";
import SortSelect from "@/components/SortSelect";
import { categories } from "@/data/categories";
import { toCardData, type ProductCardData } from "@/data/card";
import { brandOptions } from "@/lib/brand-options";
import { filterProducts, type ShopSearchParams } from "@/lib/filter-products";
import { withCustomImages } from "@/lib/product-images";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The filters and the products, for one category.
//
// Every page of this template is this block plus a name, so it is locked and
// has nothing to type in: the filters are built from the catalogue, the order
// comes from the query string, and the grid is whatever survives both.
//
// Not the same block as the shop's own listing even though they look alike.
// This one has no result counts beside the filter options and no sort chips
// or view toggle — /shop grew those and the category pages did not — and
// pretending they are one section would mean picking which of the two pages
// changes on the day they merge.

const schema = z.object({
  emptyText: z.string().max(200).default(""),
});

type Data = {
  params: ShopSearchParams;
  cards: ProductCardData[];
  house: ReturnType<typeof brandOptions>["house"];
  other: ReturnType<typeof brandOptions>["other"];
};

async function load(
  _settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; slug?: string }; query?: Record<string, string | undefined> }
): Promise<Data | null> {
  const slug = ctx.entity?.slug;
  const c = categories.find((x) => x.slug === slug);
  if (!c) return null;

  const params = { ...(ctx.query ?? {}), category: c.slug } as ShopSearchParams;
  const items = await withCustomImages(filterProducts(params));
  const options = brandOptions();
  return { params, cards: items.map(toCardData), house: options.house, other: options.other };
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  if (!data) return null;

  return (
    <section className="container-page pb-8 md:pb-10">
      <div className="flex flex-col gap-6">
        <div className="flex-1">
          {/* One toolbar, the same as /shop: filters on the left, ordering
              on the right. The sort appears twice on this page and never at
              the same time — here from lg, and inside the filter drawer on
              a phone. */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <ShopFilters
              current={data.params}
              houseBrands={data.house}
              otherBrands={data.other}
              mobileExtra={<SortSelect current={data.params} />}
            />
            <div className="hidden lg:flex">
              <SortMenu current={data.params} />
            </div>
          </div>
          {data.cards.length === 0 ? (
            <div className="py-20 text-center text-slate-500">{settings.emptyText}</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
              {data.cards.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export const categoryListing: SectionDefinition<typeof schema> = {
  type: "category_listing",
  version: 1,
  label: "ตัวกรองและสินค้าของหมวด",
  description: "ตัวกรองด้านข้าง การเรียง และตารางสินค้าของหมวดที่หน้านี้แสดง",
  category: "product",
  schema,
  defaults: { emptyText: "ไม่พบสินค้าในหมวดนี้" },
  fields: [{ key: "emptyText", type: "text", label: "ข้อความเมื่อไม่พบสินค้า" }],
  enabledOn: ["template"],
  requiresEntity: ["category"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};
