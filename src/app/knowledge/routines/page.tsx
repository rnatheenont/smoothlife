import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";

export const metadata = { title: "Routine Guides | Smoothlife.com" };

export default function RoutinesPage() {
  const items = articles.filter((a) => a.category === "routine");
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Routine Guides</h1>
      <p className="text-sm text-slate-500 mb-8">คู่มือจัดรูทีนดูแลผิวสำหรับทุกสภาพผิว</p>
      <ArticleGrid articles={items} />
    </div>
  );
}
