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
      <div className="flex flex-col lg:flex-row gap-8">
        <ShopFilters current={searchParams} />
        <div className="flex-1">
          <div className="flex items-center justify-end mb-4">
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
