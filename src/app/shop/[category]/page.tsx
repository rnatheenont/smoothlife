import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { filterProducts } from "@/lib/filter-products";
import { categories } from "@/data/categories";
import ProductCard from "@/components/ProductCard";
import ShopFilters from "@/components/ShopFilters";
import SortSelect from "@/components/SortSelect";
import Breadcrumb from "@/components/Breadcrumb";
import BackButton from "@/components/BackButton";
import { notFound } from "next/navigation";

const ADVISOR_ENTRY: Record<string, { href: string; title: string; subtitle: string }> = {
  "oral-care": {
    href: "/oral-care-advisor",
    title: "ไม่รู้จะเริ่มจากตัวไหนดี?",
    subtitle: "ตอบ 3 คำถาม ให้น้อง Smoothie จัดเซ็ตดูแลช่องปากที่ใช่สำหรับคุณ",
  },
  wellness: {
    href: "/supplement-advisor",
    title: "อาหารเสริมเยอะจนเลือกไม่ถูก?",
    subtitle: "ตอบ 5 คำถาม ให้น้อง Smoothie ช่วยหาแพลนที่ตรงเป้าหมายและงบของคุณ",
  },
};

export function generateStaticParams() {
  return categories.map((c) => ({ category: c.slug }));
}

export function generateMetadata({ params }: { params: { category: string } }) {
  const c = categories.find((c) => c.slug === params.category);
  return {
    title: c ? `${c.nameTh} | Smoothlife.com` : "Shop | Smoothlife.com",
    description: c ? `ช้อปสินค้าหมวด ${c.nameTh} คุณภาพดี ราคาคุ้มค่า ที่ Smoothlife.com` : undefined,
    alternates: { canonical: `/shop/${params.category}` },
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
    <div className="container-page pt-3 pb-8 md:py-10">
      <div className="flex items-center gap-3 mb-4">
        <BackButton fallbackHref="/shop" />
        <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }, { label: "ช้อป", href: "/shop" }, { label: categoryInfo.nameTh }]} />
      </div>
      <div className="mb-6 flex items-end justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-bold text-brand-ink">{categoryInfo.nameTh}</h1>
        <span className="text-xs md:text-sm font-medium text-brand-emerald bg-brand-gradient-soft rounded-full px-3 py-1 shrink-0">
          {items.length} รายการ
        </span>
      </div>
      {ADVISOR_ENTRY[params.category] && (
        <Link
          href={ADVISOR_ENTRY[params.category].href}
          className="group mb-6 flex items-center gap-4 rounded-xl2 bg-brand-ink p-4 md:p-5 text-white shadow-cardHover transition-transform hover:scale-[1.01]"
        >
          <div className="relative h-12 w-12 shrink-0">
            <Image src="/mascot/smoothie-hi.png" alt="Smoothie" fill sizes="48px" className="object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold leading-tight">{ADVISOR_ENTRY[params.category].title}</p>
            <p className="text-xs text-white/60 mt-0.5">{ADVISOR_ENTRY[params.category].subtitle}</p>
          </div>
          <ChevronRight size={20} className="text-white/50 shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        <ShopFilters current={current} mobileExtra={<SortSelect current={current} />} />
        <div className="flex-1">
          <div className="hidden lg:flex items-center justify-end mb-4">
            <SortSelect current={current} />
          </div>
          {items.length === 0 ? (
            <div className="text-center py-20 text-slate-400">ไม่พบสินค้าในหมวดนี้</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
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
