import { PAGES_WAVE2_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";

export const metadata = { title: "Routine Guides | Smoothlife.com" };

function RoutinesPageWritten() {
  const items = articles.filter((a) => a.category === "routine");
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Routine Guides</h1>
      <p className="text-sm text-slate-500 mb-8">คู่มือจัดรูทีนดูแลผิวสำหรับทุกสภาพผิว</p>
      <ArticleGrid articles={items} />
    </div>
  );
}

/**
 * The page, from its document when wave 2 is on and from the markup above
 * when it is not. Both halves stay in the tree on purpose — the flag is the
 * emergency switch, and it only works while the hand-written half is here.
 */
export default function RoutinesPage() {
  if (PAGES_WAVE2_ENABLED) return <SystemPageBody pageKey="knowledge-routines" />;
  return <RoutinesPageWritten />;
}
