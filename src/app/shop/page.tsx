import { categories } from "@/data/categories";
import { products } from "@/data/products";
import { brands, brandSlugAliases, slugifyVendor } from "@/data/brands";
import { filterProducts, PAGE_SIZE, ShopSearchParams } from "@/lib/filter-products";
import ProductCard from "@/components/ProductCard";
import ShopFilters, { type FilterCounts } from "@/components/ShopFilters";
import SortSelect from "@/components/SortSelect";
import Pagination from "@/components/Pagination";
import ShopHero from "@/components/shop/ShopHero";
import CategoryCircles from "@/components/shop/CategoryCircles";
import ViewToggle from "@/components/shop/ViewToggle";
import ProductRow from "@/components/shop/ProductRow";

// Every ?brand=/?page=/?sort= filter combination renders this same route —
// without a canonical they'd all index as separate near-duplicate pages.
export const metadata = { title: "Shop ทั้งหมด | Smoothlife.com", alternates: { canonical: "/shop" } };

// How many buyable products sit behind each category and brand, counted once
// from the catalogue rather than per request: the numbers beside a filter say
// what it holds, not what the current filters have left of it (a count that
// changed as you ticked boxes would read as stock disappearing).
function filterCounts(): FilterCounts {
  const inStock = products.filter((p) => p.inStock);
  const category: Record<string, number> = {};
  for (const c of categories) category[c.slug] = inStock.filter((p) => p.category === c.slug).length;

  const brand: Record<string, number> = {};
  for (const b of brands) {
    const slugs = brandSlugAliases(b);
    brand[b.slug] = inStock.filter((p) => slugs.includes(slugifyVendor(p.brand))).length;
  }
  return { category, brand };
}

export default function ShopPage({ searchParams }: { searchParams: ShopSearchParams }) {
  const allItems = filterProducts(searchParams);
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const items = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const isList = searchParams.view === "list";
  const activeCategory = categories.find((c) => c.slug === searchParams.category);

  return (
    <div className="container-page py-5 md:py-8">
      <ShopHero
        title={activeCategory ? activeCategory.nameTh : "สินค้าทั้งหมด"}
        subtitle="ดูแลตัวเองได้ง่าย ๆ ในทุกวัน"
        image={activeCategory?.image}
      />

      <CategoryCircles current={searchParams} />

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <ShopFilters current={searchParams} counts={filterCounts()} mobileExtra={<SortSelect current={searchParams} />} />

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-brand-ink md:text-lg">
              {activeCategory ? activeCategory.nameTh : "สินค้าทั้งหมด"}{" "}
              <span className="text-sm font-medium text-slate-500">{allItems.length.toLocaleString("th-TH")} รายการ</span>
            </h2>
            <div className="hidden items-center gap-2 lg:flex">
              <SortSelect current={searchParams} />
              <ViewToggle current={searchParams} />
            </div>
          </div>

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
                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 xl:grid-cols-4">
                  {items.map((p) => (
                    <ProductCard key={p.slug} product={p} />
                  ))}
                </div>
              )}
              <Pagination current={searchParams} page={page} totalPages={totalPages} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
