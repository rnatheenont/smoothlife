import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";

export const metadata = { title: "Question Hub | Smoothlife.com" };

export default function QuestionsPage() {
  const items = articles.filter((a) => a.category === "qa");
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Question Hub</h1>
      <p className="text-sm text-slate-500 mb-8">คำถามที่พบบ่อยเกี่ยวกับสกินแคร์และการดูแลผิว</p>
      <ArticleGrid articles={items} />
    </div>
  );
}
