import Image from "next/image";
import { notFound } from "next/navigation";
import { articles, getArticleBySlug } from "@/data/articles";
import { BookOpen } from "lucide-react";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }) {
  const a = getArticleBySlug(params.slug);
  return { title: a ? `${a.title} | Smoothlife.com` : "Article | Smoothlife.com" };
}

export default function ArticlePage({ params }: { params: { slug: string } }) {
  const article = getArticleBySlug(params.slug);
  if (!article) notFound();

  return (
    <article className="container-page py-8 md:py-10 max-w-2xl mx-auto">
      <div className="relative aspect-video rounded-xl2 overflow-hidden mb-6">
        <Image src={article.image} alt={article.title} fill className="object-cover" />
      </div>
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-3">{article.title}</h1>
      <p className="text-sm text-slate-500 mb-6">{article.readMins} นาทีในการอ่าน</p>
      <div className="flex flex-col gap-4 text-slate-700 leading-relaxed">
        {article.body.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <div className="mt-10 rounded-xl2 bg-surface-soft p-5">
        <div className="flex items-center gap-2 font-bold text-brand-ink mb-2 text-sm">
          <BookOpen size={16} /> แหล่งอ้างอิง
        </div>
        <ul className="text-xs text-slate-500 list-disc list-inside space-y-1">
          {article.sources.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}
