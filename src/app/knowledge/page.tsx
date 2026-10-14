import Link from "next/link";
import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";
import { getStoreArticles, thaiDate } from "@/lib/storefront-articles";
import { pageMetadata } from "@/lib/site-pages";
import { PAGES_WAVE2_ENABLED } from "@/lib/feature-flags";
import { SystemPageBody } from "@/lib/pages/system-page";

export function generateMetadata() {
  return pageMetadata("knowledge");
}
export const revalidate = 1800;

const sections = [
  { href: "/knowledge/ingredients", label: "Ingredient Library" },
  { href: "/knowledge/routines", label: "Routine Guides" },
  { href: "/knowledge/questions", label: "Question Hub" },
  { href: "/knowledge/videos", label: "Video and How-to" },
];

async function KnowledgePageWritten() {
  // Posts from the Shopify blog, newest first; the static guides stay below.
  const posts = await getStoreArticles();
  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">Beauty Knowledge</h1>
      <p className="text-sm text-slate-500 mb-6">คลังความรู้เรื่องผิวพรรณจากผู้เชี่ยวชาญ พร้อมแหล่งอ้างอิงที่น่าเชื่อถือ</p>
      <div className="flex flex-wrap gap-3 mb-8">
        {sections.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:border-brand-teal hover:text-brand-800 transition-colors">
            {s.label}
          </Link>
        ))}
      </div>
      {posts && posts.length > 0 && (
        <>
          <h2 className="font-bold text-brand-ink mb-4">บทความล่าสุด</h2>
          <div className="mb-10">
            <ArticleGrid
              articles={posts.map((p) => ({
                slug: encodeURIComponent(p.handle),
                title: p.title,
                excerpt: p.excerpt,
                image: p.image,
                readMins: p.readMins,
                date: thaiDate(p.publishedAt),
              }))}
            />
          </div>
        </>
      )}
      <h2 className="font-bold text-brand-ink mb-4">Expert Guides</h2>
      <ArticleGrid articles={articles} />
    </div>
  );
}

/**
 * The page, from its document when wave 2 is on and from the markup above
 * when it is not. Both halves stay in the tree on purpose — the flag is the
 * emergency switch, and it only works while the hand-written half is here.
 */
export default async function KnowledgePage() {
  if (PAGES_WAVE2_ENABLED) return <SystemPageBody pageKey="knowledge" />;
  return <KnowledgePageWritten />;
}
