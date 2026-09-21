import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/json-ld";
import {
  categoryLabel,
  excerptOf,
  getPublicQuestion,
  getPublicQuestions,
  taggedProducts,
} from "@/lib/kb-public";
import { thaiDate } from "@/lib/storefront-articles";

// One question, one page — the answer the team wrote, and the products it is
// about. Refreshed on a quarter-hour; the knowledge base changes when someone
// edits an article, not on a schedule.
export const revalidate = 900;

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const q = await getPublicQuestion(decodeURIComponent(slug));
  if (!q) return { title: "คำถามที่พบบ่อย | Smoothlife.com" };
  return {
    title: `${q.title} | Smoothlife.com`,
    description: excerptOf(q.content),
    alternates: { canonical: `/knowledge/questions/${encodeURIComponent(q.public_slug)}` },
  };
}

export default async function PublicQuestionPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const question = await getPublicQuestion(decodeURIComponent(slug));
  if (!question) notFound();

  const products = taggedProducts(question.product_tags);
  const others = (await getPublicQuestions()).filter((q) => q.public_slug !== question.public_slug).slice(0, 6);
  const paragraphs = question.content.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div className="container-page py-6 md:py-10">
      {/* The whole answer is on this page, which is what lets the markup
          claim it — a FAQPage whose answer lives somewhere else is the kind
          Google drops. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            faqPageJsonLd([{ question: question.title, answer: question.content, dateModified: question.updated_at }])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd([
              { label: "หน้าแรก", href: "/" },
              { label: "ความรู้เรื่องผิวและสุขภาพ", href: "/knowledge" },
              { label: "คำถามที่พบบ่อย", href: "/knowledge/questions" },
              { label: question.title },
            ])
          ),
        }}
      />

      <nav aria-label="breadcrumb" className="text-sm">
        <Link
          href="/knowledge/questions"
          className="-ml-2 inline-flex min-h-[44px] items-center gap-1 rounded-full px-2 font-medium text-brand-800 hover:bg-surface-mist"
        >
          <ChevronLeft size={16} aria-hidden="true" /> คำถามที่พบบ่อย
        </Link>
      </nav>

      <article className="mx-auto max-w-2xl lg:mx-0">
        <span className="text-xs font-semibold text-brand-800">{categoryLabel(question.category)}</span>
        <h1 className="mt-2 text-2xl font-extrabold leading-snug text-brand-ink md:text-4xl md:leading-tight">
          {question.title}
        </h1>
        <p className="mt-2 text-xs text-slate-400">
          อัปเดตล่าสุด <time dateTime={question.updated_at}>{thaiDate(question.updated_at)}</time>
        </p>
        <div className="article-body mt-6">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>

        <div className="mt-8 flex items-center gap-2 rounded-xl2 bg-surface-soft p-4 text-sm text-slate-600">
          <MessageCircle size={18} className="shrink-0 text-brand-800" aria-hidden="true" />
          <span>
            ยังไม่ได้คำตอบที่ต้องการ?{" "}
            <Link href="/help/contact" className="font-semibold text-brand-800 hover:underline">
              ทักทีมงานได้เลย
            </Link>
          </span>
        </div>
      </article>

      {products.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-brand-ink md:text-xl">สินค้าที่เกี่ยวข้อง</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {products.slice(0, 4).map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-brand-ink md:text-xl">คำถามอื่นที่คนถามบ่อย</h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {others.map((q) => (
              <li key={q.public_slug}>
                <Link
                  href={`/knowledge/questions/${encodeURIComponent(q.public_slug)}`}
                  className="flex items-center justify-between gap-3 rounded-xl2 bg-white p-4 ring-1 ring-surface-line transition-colors hover:ring-brand-action/40"
                >
                  <span className="min-w-0 text-sm font-medium text-brand-ink">{q.title}</span>
                  <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
