import { filterProducts } from "@/lib/filter-products";
import { categories } from "@/data/categories";
import ProductCard from "@/components/ProductCard";
import ShopFilters from "@/components/ShopFilters";
import SortSelect from "@/components/SortSelect";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export function generateMetadata({ params }: { params: { category: string } }) {
  const c = categories.find((c) => c.slug === params.category);
  return {
    title: c ? `${c.nameTh} | Smoothlife.com` : "Shop | Smoothlife.com",
    description: c ? `ช้อปสินค้าหมวด ${c.nameTh} คุณภาพดี ราคาคุ้มค่า ที่ Smoothlife.com` : undefined,
  };
}

export default function CategoryPage({
  params,
  searchParams,
}: {
  params: { category: string };
  searchParams: { sort?: string; brand?: string; concern?: string };
}) {
  const categoryInfo = categories.find((c) => c.slug === params.category);
  if (!categoryInfo) notFound();

  const current = { ...searchParams, category: params.category };
  const items = filterProducts(current);

  return (
    <div className="container-page py-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-brand-ink">{categoryInfo.nameTh}</h1>
        <p className="text-sm text-slate-500 mt-1">พบ {items.length} รายการ</p>
      </div>
      <div className="flex flex-col lg:flex-row gap-8">
        <ShopFilters current={current} mobileExtra={<SortSelect current={current} />} />
        <div className="flex-1">
          <div className="hidden lg:flex items-center justify-end mb-4">
            <SortSelect current={current} />
          </div>
          {items.length === 0 ? (
            <div className="text-center py-20 text-slate-400">ไม่พบสินค้าในหมวดนี้</div>
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
