import Link from "next/link";
import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";

export const metadata = { title: "Beauty Knowledge | Smoothlife.com" };

const sections = [
  { href: "/knowledge/ingredients", label: "Ingredient Library" },
  { href: "/knowledge/routines", label: "Routine Guides" },
  { href: "/knowledge/questions", label: "Question Hub" },
  { href: "/knowledge/videos", label: "Video and How-to" },
];

export default function KnowledgePage() {
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Beauty Knowledge</h1>
      <p className="text-sm text-slate-500 mb-6">คลังความรู้เรื่องผิวพรรณจากผู้เชี่ยวชาญ พร้อมแหล่งอ้างอิงที่น่าเชื่อถือ</p>
      <div className="flex flex-wrap gap-3 mb-8">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:border-brand-teal hover:text-brand-emerald transition-colors">
            {s.label}
          </Link>
        ))}
      </div>
      <h2 className="font-bold text-brand-ink mb-4">Expert Guides</h2>
      <ArticleGrid articles={articles} />
    </div>
  );
}
