import Link from "next/link";
import { concerns } from "@/data/categories";
import { products } from "@/data/products";
import { formatTHB } from "@/lib/format";

export const metadata = { title: "Routine Builder | Smoothlife.com" };

export default function RoutineBuilderPage() {
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Routine Builder</h1>
      <p className="text-sm text-slate-500 mb-8">ประกอบรูทีนดูแลผิวแบบขั้นตอนตามปัญหาที่คุณกังวล</p>
      <div className="grid md:grid-cols-2 gap-6">
        {concerns.map((c) => {
          const items = products.filter((p) => p.concerns.includes(c.slug)).slice(0, 3);
          if (items.length === 0) return null;
          return (
            <div key={c.slug} className="rounded-xl2 border border-slate-100 p-5 shadow-card">
              <h3 className="font-bold text-brand-ink mb-3">{c.nameTh}</h3>
              <ol className="flex flex-col gap-3">
                {items.map((p, idx) => (
                  <li key={p.slug} className="flex items-center gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald text-xs font-bold">
                      {idx + 1}
                    </span>
                    <Link href={`/product/${p.slug}`} className="flex-1 text-sm text-slate-600 hover:text-brand-emerald line-clamp-1">
                      {p.name}
                    </Link>
                    <span className="text-xs font-semibold text-brand-ink shrink-0">{formatTHB(p.price)}</span>
                  </li>
                ))}
              </ol>
              <Link href={`/concern/${c.slug}`} className="text-xs font-semibold text-brand-emerald mt-4 inline-block">
                ดูรูทีนแบบเต็ม →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
