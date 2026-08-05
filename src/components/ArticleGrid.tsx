import Link from "next/link";
import Image from "next/image";
import { Clock } from "lucide-react";
import { Article } from "@/data/types";

export default function ArticleGrid({ articles }: { articles: Article[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {articles.map((a) => (
        <Link key={a.slug} href={`/knowledge/article/${a.slug}`} className="group rounded-xl2 border border-slate-100 shadow-card overflow-hidden">
          <div className="relative aspect-[16/10]">
            <Image src={a.image} alt={a.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
          </div>
          <div className="p-4">
            {a.productSlug && <span className="mb-2 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-brand-emerald">ข้อมูลสินค้าจาก Shopify</span>}
            <h3 className="font-bold text-brand-ink text-sm line-clamp-2 group-hover:text-brand-emerald transition-colors">{a.title}</h3>
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{a.excerpt}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-3">
              <Clock size={12} /> {a.readMins} นาทีในการอ่าน
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
