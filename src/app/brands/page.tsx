import Link from "next/link";
import Image from "next/image";
import { brands } from "@/data/brands";

export const metadata = { title: "แบรนด์ทั้งหมด | Smoothlife.com" };

export default function BrandsPage() {
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">แบรนด์ทั้งหมด</h1>
      <p className="text-sm text-slate-500 mb-8">คัดสรรแบรนด์คุณภาพจากทั่วโลกเพื่อสุขภาพและความงามของคุณ</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {brands.map((b) => (
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
