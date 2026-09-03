import Image from "next/image";
import Link from "next/link";
import { collections } from "@/data/collections";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "คอลเลกชันทั้งหมด | Smoothlife.com",
  description: "รวมทุกคอลเลกชันและโปรโมชันจาก Smoothlife.com",
  alternates: { canonical: "/collections" },
};

// Index of the real Shopify collections. Sorted biggest-first because the
// merchandising ones worth browsing (bundles, clearance, brand pages) carry far
// more products than the long tail of one-off campaign groups.
export default function CollectionsIndexPage() {
  const sorted = [...collections].sort((a, b) => b.productSlugs.length - a.productSlugs.length);

  return (
    <div className="container-page py-6 md:py-8">
      <Breadcrumb items={[{ label: "หน้าแรก", href: "/" }, { label: "คอลเลกชัน" }]} />
      <h1 className="mt-4 text-2xl font-bold text-brand-ink md:text-3xl">คอลเลกชันทั้งหมด</h1>
      <p className="mt-1 text-sm text-slate-500">{sorted.length} คอลเลกชัน อัปเดตตรงจากร้าน</p>

      {sorted.length === 0 ? (
        <p className="mt-8 text-sm text-slate-400">ยังไม่มีคอลเลกชันในขณะนี้</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {sorted.map((c) => (
            <Link
              key={c.handle}
              href={`/collections/${c.handle}`}
              className="group overflow-hidden rounded-xl2 border border-slate-100 shadow-card transition-shadow hover:shadow-cardHover"
            >
              <div className="relative aspect-[4/3] bg-surface-soft">
                {c.image ? (
                  <Image
                    src={c.image}
                    alt={c.title}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                ) : (
                  <div className="grid h-full place-items-center bg-brand-gradient-soft text-2xl font-bold text-brand-emerald/40">
                    {c.title.slice(0, 1)}
                  </div>
                )}
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-semibold text-brand-ink">{c.title}</p>
                <p className="mt-0.5 text-xs text-slate-400">{c.productSlugs.length} รายการ</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
