import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";

export const metadata = { title: "Video and How-to | Smoothlife.com" };

export default function VideosPage() {
  const items = articles.filter((a) => a.category === "video");
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Video and How-to</h1>
      <p className="text-sm text-slate-500 mb-8">วิดีโอสาธิตวิธีใช้ผลิตภัณฑ์อย่างถูกต้อง</p>
      <ArticleGrid articles={items} />
    </div>
  );
}
