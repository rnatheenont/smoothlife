import { PAGES_WAVE2_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";
import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";

export const metadata = { title: "Video and How-to | Smoothlife.com" };

function VideosPageWritten() {
  const items = articles.filter((a) => a.category === "video");
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Video and How-to</h1>
      <p className="text-sm text-slate-500 mb-8">วิดีโอสาธิตวิธีใช้ผลิตภัณฑ์อย่างถูกต้อง</p>
      <ArticleGrid articles={items} />
    </div>
  );
}

/**
 * The page, from its document when wave 2 is on and from the markup above
 * when it is not. Both halves stay in the tree on purpose — the flag is the
 * emergency switch, and it only works while the hand-written half is here.
 */
export default function VideosPage() {
  if (PAGES_WAVE2_ENABLED) return <SystemPageBody pageKey="knowledge-videos" />;
  return <VideosPageWritten />;
}
