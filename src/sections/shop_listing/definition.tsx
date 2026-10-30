import { z } from "zod";
import ProductCard from "@/components/ProductCard";
import ShopFilters from "@/components/ShopFilters";
import ActiveFilterChips from "@/components/shop/ActiveFilterChips";
import SortSelect from "@/components/SortSelect";
import SortMenu from "@/components/shop/SortMenu";
import StickyToolbar from "@/components/shop/StickyToolbar";
import Pagination from "@/components/Pagination";
import InfiniteProducts from "@/components/shop/InfiniteProducts";
import ViewToggle from "@/components/shop/ViewToggle";
import ProductRow from "@/components/shop/ProductRow";
import { categories } from "@/data/categories";
import { toCardData, type ProductCardData } from "@/data/card";
import { brandNames, brandOptions } from "@/lib/brand-options";
import type { Product } from "@/data/types";
import {
  filterCounts,
  filterProducts,
  PAGE_SIZE,
  type FilterCounts,
  type ShopSearchParams,
} from "@/lib/filter-products";
import { withCustomImages } from "@/lib/product-images";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The shop: the category row, the filters, and the products that survive them.
//
// One section and not three: the category row, the toolbar and the grid are
// one idea read top to bottom, and a page document that could drop the row
// and keep the filters would be a shop you cannot leave a category from.
//
// The category row that used to head this page is gone: it is a dropdown in
// the filter row now, beside the other five ways of narrowing the list.
//
// Locked and settingless: every number on this page is counted per request
// against the filters already on, so there is nothing here to type in.

const schema = z.object({});

type Data = {
  params: ShopSearchParams;
  cards: ProductCardData[];
  rows: Product[];
  total: number;
  page: number;
  totalPages: number;
  counts: FilterCounts;
  isList: boolean;
  heading: string;
  house: ReturnType<typeof brandOptions>["house"];
  other: ReturnType<typeof brandOptions>["other"];
  names: ReturnType<typeof brandNames>;
};

async function load(_settings: z.output<typeof schema>, ctx: { query?: Record<string, string | undefined> }): Promise<Data> {
  const params = (ctx.query ?? {}) as ShopSearchParams;
  const all = filterProducts(params);
  const totalPages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(params.page) || 1), totalPages);
  const slice = await withCustomImages(all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const active = categories.find((c) => c.slug === params.category);
  const options = brandOptions();

  return {
    params,
    rows: slice,
    cards: slice.map(toCardData),
    total: all.length,
    page,
    totalPages,
    // Counted per request and against the filters already on, so the number
    // beside an option is what ticking it would actually leave you with.
    counts: filterCounts(params),
    isList: params.view === "list",
    heading: active ? active.nameTh : "สินค้าทั้งหมด",
    house: options.house,
    other: options.other,
    names: brandNames(),
  };
}

function Component({ data }: SectionProps<z.output<typeof schema>, Data>) {
  if (!data) return null;

  return (
    <div className="container-page py-5 md:py-8">
      <div className="flex flex-col gap-6">
        <div className="min-w-0 flex-1">
          {/* One toolbar: what narrows the list on the left, how it is
              ordered on the right. */}
          {/* No heading here any more: the banner above says which category
              this is and how many there are, and a second copy of both was
              the page telling you twice. */}
          {/* Sticky, and the full width of the container's box rather than
              of the text column — a bar with the page sliding past in the
              gutters either side of it is not a bar. Its parent has to be
              the tall column, not a wrapper the height of the toolbar:
              sticky can only travel inside its own parent. */}
          <StickyToolbar>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <ShopFilters
                houseBrands={data.house}
                otherBrands={data.other}
                current={data.params}
                counts={data.counts}
                mobileExtra={<SortSelect current={data.params} />}
              />
              <div className="hidden items-center gap-2 lg:flex">
                <SortMenu current={data.params} />
                <ViewToggle current={data.params} />
              </div>
            </div>
          </StickyToolbar>

          <ActiveFilterChips current={data.params} brandNames={data.names} />

          {data.rows.length === 0 ? (
            <div className="rounded-xl2 bg-white py-20 text-center text-slate-500 shadow-card">
              <p>ไม่พบสินค้าที่ตรงกับตัวกรองของคุณ</p>
            </div>
          ) : (
            <>
              {data.isList ? (
                <div className="flex flex-col gap-3">
                  {data.rows.map((p) => (
                    <ProductRow key={p.slug} product={p} />
                  ))}
                </div>
              ) : (
                /* The grid and everything that lands in it later are one
                   component, so the fetched pages continue the same rows
                   rather than starting a second grid under the first — which
                   left a hole beside the four products in page one's last
                   row. The list view keeps its page numbers, because a row
                   carries the full product and that is the half of the
                   catalogue this page never sends to a browser. */
                <InfiniteProducts
                  initial={data.cards}
                  params={data.params}
                  page={data.page}
                  totalPages={data.totalPages}
                />
              )}
              {data.isList && (
                <Pagination current={data.params} page={data.page} totalPages={data.totalPages} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const shopListing: SectionDefinition<typeof schema> = {
  type: "shop_listing",
  version: 1,
  label: "หมวดหมู่ ตัวกรอง และรายการสินค้า",
  description: "แถวหมวด ตัวกรอง การเรียง และตารางสินค้าของหน้าช้อป — ทำงานในตัวเอง ไม่มีค่าตั้ง",
  category: "product",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};
