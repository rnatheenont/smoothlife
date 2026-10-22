import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, MessageCircle } from "lucide-react";
import ProductRow from "@/components/ProductRow";
import FaqFeedback from "@/components/faq/FaqFeedback";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/json-ld";
import { excerptOf } from "@/lib/kb-public";
import { shareMeta } from "@/lib/seo-overrides";
import {
  answerParagraphs,
  faqProductCards,
  getFaqArticle,
  getFaqArticles,
  getFaqTopics,
  getRelatedFaq,
} from "@/lib/faq-public";

// One question, on a page of its own.
//
// Worth a URL for two reasons that are the same reason: a person can be sent
// a link to the exact answer, and an AI engine can cite one. Both want the
// first paragraph to answer the question outright, which is why the answer is
// printed in the order it was written rather than behind a summary.
export const revalidate = 900;

/**
 * Only the pinned questions are built ahead of time.
 *
 * Twenty-one pages is small enough to pre-render all of them today, and that
 * is exactly why not to: the set grows with every answer the team publishes,
 * and a build that renders all of them is a build that gets slower every week
 * for pages most readers never open. The rest render on first request and are
 * then cached like any other.
 */
export async function generateStaticParams() {
  const articles = await getFaqArticles();
  return articles.filter((a) => a.pinned).map((a) => ({ slug: a.public_slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getFaqArticle(decodeURIComponent(slug));
  if (!article) return { title: "ไม่พบคำถามนี้ | Smoothlife.com" };
  const path = `/faq/${encodeURIComponent(article.public_slug)}`;
  const description = excerptOf(article.content, 155);
  return {
    title: `${article.title} | Smoothlife.com`,
    description,
    alternates: { canonical: path },
    // These pages are the ones built to be linked to — by a person pasting
    // the answer into a chat, and by an engine citing it. A link with no
    // card of its own is the question's own title replaced by the site's.
    // `url` is relative to metadataBase, so it names the canonical host.
    ...shareMeta({ type: "article", title: article.title, description, url: path }),
    twitter: { card: "summary", title: article.title, description },
  };
}

export default async function FaqArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getFaqArticle(decodeURIComponent(slug));
  if (!article) notFound();

  const [topics, related] = await Promise.all([getFaqTopics(), getRelatedFaq(article.id, 4)]);
  const topicLabel = topics.find((t) => t.kind === "section" && t.slug === article.topic)?.label_th;
  const paragraphs = answerParagraphs(article.content);
  const cards = faqProductCards(article.product_tags);

  return (
    <div className="container-page py-6 md:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            // This question only — the set belongs to /faq, and repeating it
            // on every answer page would describe one listing at two dozen
            // addresses. The answer is the full text, which is what the
            // paragraphs below print: markup that says more than the page
            // does is the failure this schema is checked for.
            faqPageJsonLd([
              { question: article.title, answer: article.content, dateModified: article.updated_at },
            ])
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd([
              { label: "หน้าแรก", href: "/" },
              { label: "คำถามที่พบบ่อย", href: "/faq" },
              ...(topicLabel && article.topic
                ? [{ label: topicLabel, href: `/faq?topic=${encodeURIComponent(article.topic)}` }]
                : []),
              { label: article.title },
            ])
          ),
        }}
      />

      <nav aria-label="เส้นทาง" className="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
        <Link href="/" className="hover:text-brand-800 hover:underline">
          หน้าแรก
        </Link>
        <span aria-hidden>›</span>
        <Link href="/faq" className="hover:text-brand-800 hover:underline">
          คำถามที่พบบ่อย
        </Link>
        {topicLabel && article.topic && (
          <>
            <span aria-hidden>›</span>
            <Link href={`/faq?topic=${encodeURIComponent(article.topic)}`} className="hover:text-brand-800 hover:underline">
              {topicLabel}
            </Link>
          </>
        )}
      </nav>

      {/* Two columns from lg up: the answer at a readable measure, and a rail
          for everything that is *about* the answer rather than part of it.
          The page used to cap everything at 760px and leave half a wide screen
          empty, with the feedback row and the related questions pushed so far
          down that the answer looked like the whole page.

          One column below lg, in the same order: answer, then what to do next.
          The rail is sticky on desktop only — a sticky block on a phone eats
          the screen the answer needs. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-10 xl:gap-14">
        <article className="max-w-[68ch]">
          <h1 className="text-2xl font-bold leading-snug text-brand-ink md:text-3xl">{article.title}</h1>

          {/* The first paragraph is the answer; the rest is detail. Giving it
              its own size is the difference between a page that answers and a
              page you have to read. */}
          <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate-600 md:text-base">
            {paragraphs.map((p, i) => (
              <p key={i} className={i === 0 ? "text-base text-brand-ink md:text-lg md:leading-relaxed" : undefined}>
                {p}
              </p>
            ))}
          </div>

          {cards.length > 0 && (
            <div className="mt-7">
              {/* Said out loud: two product cards under an answer, with no
                  line telling you why they are there, read as an advert. */}
              <h2 className="mb-2 text-[13px] font-semibold text-slate-500">
                สินค้าที่พูดถึงในคำตอบนี้
              </h2>
              <div className="flex flex-wrap gap-2">
                {cards.map((p) => (
                  <ProductRow key={p.slug} product={p} className="w-full max-w-[320px] sm:w-[320px]" />
                ))}
              </div>
            </div>
          )}

          {article.cta_href && (
            <Link
              href={article.cta_href}
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800 hover:text-brand-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
            >
              {article.cta_label ?? "ดูสินค้าทั้งหมด"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}

          {/* Where to read next, where reading ends. In the rail it was
              taller than the answer itself — most answers here are a
              paragraph, and a sidebar that outweighs the page is the same
              mistake as the empty half it replaced. */}
          {related.length > 0 && (
            <section className="mt-8 border-t border-surface-line pt-5">
              <h2 className="text-sm font-semibold text-brand-ink">คำถามที่เกี่ยวข้อง</h2>
              <ul className="mt-1 sm:grid sm:grid-cols-2 sm:gap-x-6">
                {related.map((r) => (
                  <li key={r.public_slug} className="border-b border-slate-100 last:border-0 sm:[&:nth-last-child(2):nth-child(odd)]:border-0">
                    <Link
                      href={`/faq/${encodeURIComponent(r.public_slug)}`}
                      className="block py-2.5 text-sm text-slate-600 transition-colors hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                    >
                      {r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="mt-10 flex flex-col gap-3 lg:sticky lg:top-[calc(var(--app-header-h,0px)+1rem)] lg:mt-0">
          {/* No heading over it: FaqFeedback asks "มีประโยชน์ไหม" itself, and
              a title above it asked the same question twice. */}
          <div className="rounded-xl2 bg-surface-soft p-4">
            <FaqFeedback articleId={article.id} />
          </div>

          <a
            href={`/chat?q=${encodeURIComponent(article.title)}`}
            className="flex items-center gap-2 rounded-xl2 p-4 text-sm font-semibold text-brand-800 ring-1 ring-surface-line transition-colors hover:ring-brand-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          >
            <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
            ยังไม่ตรงที่อยากรู้? ถามน้อง Smoothie
          </a>

          <Link
            href="/faq"
            className="inline-flex h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-semibold text-brand-800 ring-1 ring-surface-line hover:ring-brand-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          >
            ดูคำถามทั้งหมด
          </Link>
        </aside>
      </div>
    </div>
  );
}
