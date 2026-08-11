import Link from "next/link";
import Image from "next/image";
import { concerns } from "@/data/categories";

export const metadata = { title: "Shop by Concern | Smoothlife.com" };

export default function ConcernHubPage() {
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">ช้อปตามปัญหาผิวที่กังวล</h1>
      <p className="text-sm text-slate-500 mb-8">เลือกดูผลิตภัณฑ์ที่ตรงกับความต้องการของผิวคุณ พร้อมคำแนะนำจากผู้เชี่ยวชาญ</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-5">
        {concerns.map((c) => (
          <Link key={c.slug} href={`/concern/${c.slug}`} className="group rounded-xl2 overflow-hidden shadow-card">
            <div className="relative aspect-[4/3]">
              <Image src={c.image} alt={c.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 p-4 text-white">
                <h3 className="font-bold">{c.nameTh}</h3>
                <p className="text-xs text-white/80 mt-1 line-clamp-2">{c.description}</p>
              </div>
            </div>
          </Link>
        ))}
        <Link href="/advisor" className="rounded-xl2 border-2 border-dashed border-brand-teal flex flex-col items-center justify-center text-center p-6 aspect-[4/3]">
          <p className="font-bold text-brand-ink">ไม่แน่ใจว่าผิวคุณกังวลเรื่องอะไร?</p>
          <span className="text-sm text-brand-emerald font-semibold mt-2">ให้น้อง Smoothie ช่วยประเมิน →</span>
        </Link>
      </div>
    </div>
  );
}
