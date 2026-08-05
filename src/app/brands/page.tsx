import Link from "next/link";
import { brands } from "@/data/brands";
import { ArrowUpRight } from "lucide-react";

export const metadata = { title: "แบรนด์ทั้งหมด | Smoothlife.com" };

export default function BrandsPage() {
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">แบรนด์ทั้งหมด</h1>
      <p className="text-sm text-slate-500 mb-8">คัดสรรแบรนด์คุณภาพจากทั่วโลกเพื่อสุขภาพและความงามของคุณ</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
        {brands.map((b) => (
          <Link
            key={b.slug}
            href={`/shop?brand=${b.slug}`}
            className="group flex min-h-[230px] flex-col rounded-xl2 border border-slate-100 bg-white p-4 md:p-5 shadow-card hover:-translate-y-0.5 hover:border-brand-teal hover:shadow-cardHover transition-all"
          >
            <div className="mb-4 grid h-24 place-items-center rounded-xl bg-surface-soft p-4 md:h-28">
              {/* Brand assets are loaded from each brand's official domain icon. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.logo} alt={`โลโก้ ${b.name}`} loading="lazy" className="h-16 w-16 object-contain md:h-20 md:w-20" />
            </div>
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-bold text-brand-ink group-hover:text-brand-emerald transition-colors">{b.name}</h2>
              <ArrowUpRight size={16} className="shrink-0 text-slate-300 group-hover:text-brand-emerald" aria-hidden="true" />
            </div>
            <p className="mt-1 min-h-8 text-xs leading-relaxed text-slate-500">{b.tagline}</p>
            <p className="mt-auto pt-3 text-xs font-semibold text-brand-emerald">เลือกดู {b.productCount}+ สินค้า</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
