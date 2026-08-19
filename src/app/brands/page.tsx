import Link from "next/link";
import Image from "next/image";
import { houseBrands, otherBrands } from "@/data/brands";

export const metadata = { title: "แบรนด์ทั้งหมด | Smoothlife.com" };

export default function BrandsPage() {
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">แบรนด์ทั้งหมด</h1>
      <p className="text-sm text-slate-500 mb-8">คัดสรรแบรนด์คุณภาพจากทั่วโลกเพื่อสุขภาพและความงามของคุณ</p>

      {houseBrands.length > 0 && (
        <div className="mb-10">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-emerald mb-3">แบรนด์ในเครือของเรา</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {houseBrands.map((b) => (
              <Link
                key={b.slug}
                href={`/shop?brand=${b.slug}`}
                className="relative rounded-xl2 border-2 border-brand-emerald/30 bg-brand-gradient-soft p-6 shadow-card hover:border-brand-emerald hover:shadow-cardHover transition-all"
              >
                <span className="absolute right-4 top-4 rounded-full bg-brand-gradient text-white text-[10px] font-bold px-2 py-0.5">
                  Life So Smooth
                </span>
                {b.image && (
                  <div className="relative h-16 w-full mb-4">
                    <Image src={b.image} alt={b.name} fill className="object-contain object-left" sizes="240px" />
                  </div>
                )}
                <h3 className="font-bold text-lg text-brand-ink">{b.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{b.tagline}</p>
                <p className="text-xs text-brand-emerald font-semibold mt-3">{b.productCount}+ สินค้า</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">แบรนด์อื่นๆ</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {otherBrands.map((b) => (
          <Link
            key={b.slug}
            href={`/shop?brand=${b.slug}`}
            className="rounded-xl2 border border-slate-100 p-5 shadow-card hover:border-brand-teal transition-colors"
          >
            {b.image && (
              <div className="relative h-28 w-full mb-4">
                <Image src={b.image} alt={b.name} fill className="object-contain object-left" sizes="240px" />
              </div>
            )}
            <h3 className="font-bold text-brand-ink">{b.name}</h3>
            <p className="text-xs text-slate-500 mt-1">{b.tagline}</p>
            <p className="text-xs text-brand-emerald font-semibold mt-3">{b.productCount}+ สินค้า</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
