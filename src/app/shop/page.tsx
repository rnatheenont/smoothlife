import { categories } from "@/data/categories";
import { filterCounts, filterProducts, PAGE_SIZE, ShopSearchParams } from "@/lib/filter-products";
import ProductCard from "@/components/ProductCard";
import ShopFilters from "@/components/ShopFilters";
import ActiveFilterChips from "@/components/shop/ActiveFilterChips";
import SortSelect from "@/components/SortSelect";
import SortMenu from "@/components/shop/SortMenu";
import Pagination from "@/components/Pagination";
import InfiniteProducts from "@/components/shop/InfiniteProducts";
import ShopHero from "@/components/shop/ShopHero";
import ViewToggle from "@/components/shop/ViewToggle";
import ProductRow from "@/components/shop/ProductRow";
import { pageMetadata } from "@/lib/site-pages";
import { withCustomImages } from "@/lib/product-images";
import { toCardData } from "@/data/card";
import { brandNames, brandOptions } from "@/lib/brand-options";
import { PAGES_WAVE2_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";

// Every ?brand=/?page=/?sort= filter combination renders this same route —
// without a canonical they'd all index as separate near-duplicate pages.
export function generateMetadata() {
  return pageMetadata("shop");
}

async function ShopPageWritten({ searchParams }: { searchParams: ShopSearchParams }) {
  const allItems = filterProducts(searchParams);
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const items = await withCustomImages(allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const isList = searchParams.view === "list";
  const activeCategory = categories.find((c) => c.slug === searchParams.category);
  // Counted per request and against the filters already on, so the number
  // beside an option is what ticking it would actually leave you with.
  const counts = filterCounts(searchParams);

  return (
    <>
      {/* Outside the container on purpose: the banner is full-bleed and
          carries its own. */}
      <ShopHero
        title={activeCategory ? activeCategory.nameTh : "สินค้าทั้งหมด"}
        subtitle="ดูแลตัวเองได้ง่าย ๆ ในทุกวัน"
        count={allItems.length}
      >
      </ShopHero>

      <div className="container-page py-5 md:py-8">

        <div className="flex flex-col gap-6">
          <div className="min-w-0 flex-1">
            {/* One toolbar: what narrows the list on the left, how it is
                ordered on the right. The filters had a row of their own
                above the count, and two rows of controls for one list is
                one row too many. */}
            {/* No heading here any more: the banner above says which
                category this is and how many there are. */}
            <div className="mb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ShopFilters
                  houseBrands={brandOptions().house}
                  otherBrands={brandOptions().other}
                  current={searchParams}
                  counts={counts}
                  resultCount={allItems.length}
                  mobileExtra={<SortSelect current={searchParams} />}
                />
                <div className="hidden items-center gap-2 lg:flex">
                  <SortMenu current={searchParams} />
                  <ViewToggle current={searchParams} />
                </div>
              </div>
            </div>

            <ActiveFilterChips current={searchParams} brandNames={brandNames()} />

            {items.length === 0 ? (
              <div className="rounded-xl2 bg-white py-20 text-center text-slate-500 shadow-card">
                <p>ไม่พบสินค้าที่ตรงกับตัวกรองของคุณ</p>
              </div>
            ) : (
              <>
                {isList ? (
                  <div className="flex flex-col gap-3">
                    {items.map((p) => (
                      <ProductRow key={p.slug} product={p} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4 2xl:grid-cols-5">
                    {/* Five per row only from 2xl. This page gives 256px to the
                        filter sidebar, so at 1280 five columns would leave 179px
                        cards — narrower than the two-column phone layout. */}
                    {items.map((p) => (
                      <ProductCard key={p.slug} product={toCardData(p)} />
                    ))}
                  </div>
                )}
                {/* See the note in sections/shop_listing: scroll-loading
                    for the grid, page numbers for the list view. */}
                {isList ? (
                  <Pagination current={searchParams} page={page} totalPages={totalPages} />
                ) : (
                  <InfiniteProducts params={searchParams} page={page} totalPages={totalPages} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * The page, from its document when wave 2 is on and from the markup above
 * when it is not. Both halves stay in the tree on purpose — the flag is the
 * emergency switch, and it only works while the hand-written half is here.
 *
 * The query string is read here and handed down either way: the document's
 * sections cannot reach for it themselves (useSearchParams is a client hook
 * and they render on the server), and the whole page is one reading of it.
 */
export default async function ShopPage(props: { searchParams: Promise<ShopSearchParams> }) {
  const searchParams = await props.searchParams;
  if (PAGES_WAVE2_ENABLED) return <SystemPageBody pageKey="shop" query={searchParams} />;
  return <ShopPageWritten searchParams={searchParams} />;
}
