import { filterProducts, ShopSearchParams } from "@/lib/filter-products";
import ProductCard from "@/components/ProductCard";
import ShopFilters from "@/components/ShopFilters";
import SortSelect from "@/components/SortSelect";

export const metadata = { title: "Shop ทั้งหมด | Smoothlife.com" };

export default function ShopPage({ searchParams }: { searchParams: ShopSearchParams }) {
  const items = filterProducts(searchParams);

  return (
    <div className="container-page py-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-brand-ink">สินค้าทั้งหมด</h1>
        <p className="text-sm text-slate-500 mt-1">พบ {items.length} รายการ</p>
      </div>
      <div className="lg:hidden sticky top-[84px] z-30 -mx-4 mb-5 flex items-center justify-between gap-3 border-y border-slate-100 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md">
        <ShopFilters current={searchParams} showDesktop={false} />
        <div className="min-w-0">
          <SortSelect current={searchParams} />
        </div>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <ShopFilters current={searchParams} showMobile={false} />
        <div className="flex-1">
          <div className="hidden lg:flex sticky top-32 z-20 items-center justify-end mb-4 bg-white/95 py-2 backdrop-blur-md">
            <SortSelect current={searchParams} />
          </div>
          {items.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <p>ไม่พบสินค้าที่ตรงกับตัวกรองของคุณ</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-5">
              {items.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
