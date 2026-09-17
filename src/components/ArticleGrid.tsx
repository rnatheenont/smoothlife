import Link from "next/link";
import Image from "next/image";
import { Clock } from "lucide-react";
import { Article } from "@/data/types";

// Static guides, or Shopify blog posts (no category, a publish date, and maybe
// no cover image).
type GridArticle = Pick<Article, "slug" | "title" | "excerpt" | "readMins"> & { image: string | null; date?: string };

export default function ArticleGrid({ articles }: { articles: GridArticle[] }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {articles.map((a) => (
        <Link key={a.slug} href={`/knowledge/article/${a.slug}`} className="group rounded-xl2 border border-slate-100 shadow-card overflow-hidden">
          <div className="relative aspect-16/10 bg-surface-mist">
            {a.image && <Image src={a.image} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover transition-transform duration-500" />}
          </div>
          <div className="p-4">
            <h3 className="font-bold text-brand-ink text-sm line-clamp-2 group-hover:text-brand-800 transition-colors">{a.title}</h3>
            <p className="text-xs text-slate-500 mt-1.5 line-clamp-2">{a.excerpt}</p>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-3">
              {a.date && <span className="mr-2">{a.date}</span>}
              <Clock size={12} aria-hidden="true" /> {a.readMins} นาทีในการอ่าน
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
