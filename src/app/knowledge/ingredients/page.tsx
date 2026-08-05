import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";

export const metadata = { title: "Ingredient Library | Smoothlife.com" };

export default function IngredientsPage() {
  const items = articles.filter((a) => a.category === "ingredient");
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Ingredient Library</h1>
      <p className="text-sm text-slate-500 mb-8">ทำความรู้จักส่วนผสมสำคัญในผลิตภัณฑ์ดูแลผิว</p>
      <ArticleGrid articles={items} />
    </div>
  );
}
