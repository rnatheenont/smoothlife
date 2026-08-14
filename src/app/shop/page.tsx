import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { filterProducts, PAGE_SIZE, ShopSearchParams } from "@/lib/filter-products";
import ProductCard from "@/components/ProductCard";
import ShopFilters from "@/components/ShopFilters";
import SortSelect from "@/components/SortSelect";
import Pagination from "@/components/Pagination";

export const metadata = { title: "Shop ทั้งหมด | Smoothlife.com" };

export default function ShopPage({ searchParams }: { searchParams: ShopSearchParams }) {
  const allItems = filterProducts(searchParams);
  const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(searchParams.page) || 1), totalPages);
  const items = allItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="container-page py-8 md:py-10">
      <nav className="mb-3 flex items-center gap-1.5 text-xs text-slate-400">
        <Link href="/" className="hover:text-brand-emerald">
          หน้าแรก
        </Link>
        <ChevronRight size={12} />
        <span className="text-slate-600 font-medium">สินค้าทั้งหมด</span>
      </nav>
      <div className="mb-6 flex items-end justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-brand-ink">สินค้าทั้งหมด</h1>
        <span className="text-xs md:text-sm font-medium text-brand-emerald bg-brand-gradient-soft rounded-full px-3 py-1 shrink-0">
          {allItems.length} รายการ
        </span>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <ShopFilters current={searchParams} mobileExtra={<SortSelect current={searchParams} />} />
        <div className="flex-1">
          <div className="hidden lg:flex items-center justify-end mb-4">
            <SortSelect current={searchParams} />
          </div>
          {items.length === 0 ? (
            <div className="text-center py-20 text-slate-400">
              <p>ไม่พบสินค้าที่ตรงกับตัวกรองของคุณ</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
                {items.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
              <Pagination current={searchParams} page={page} totalPages={totalPages} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
