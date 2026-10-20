import Link from "next/link";
import { ChevronDown, ArrowRight, MessageCircle } from "lucide-react";
import ProductRow from "@/components/ProductRow";
import { answerParagraphs, faqProductCards, type FaqArticle } from "@/lib/faq-public";
import FaqFeedback from "@/components/faq/FaqFeedback";

// One question and its answer, rendered on the server.
//
// A native <details> rather than an accordion component, for one reason that
// outranks consistency with the rest of the site: <details> keeps its content
// in the document when closed. A JavaScript accordion that mounts the answer
// on open leaves this page looking empty to an AI crawler and to anyone
// reading view-source, which is the whole point of having the page. It also
// opens and closes with no JavaScript at all, so the page works while the
// bundle is still downloading.
//
// `data-faq-slug` is the handle FaqBrowser filters on; `data-faq-title` marks
// the text it is allowed to highlight.

export default function FaqItem({
  article,
  topicLabel,
  headingLevel = "h2",
}: {
  article: FaqArticle;
  topicLabel?: string;
  headingLevel?: "h2" | "h3";
}) {
  const paragraphs = answerParagraphs(article.content);
  const cards = faqProductCards(article.product_tags);
  const Heading = headingLevel;

  return (
    <details
      data-faq-slug={article.public_slug}
      id={article.public_slug}
      className="group scroll-mt-40 md:scroll-mt-28 rounded-xl2 bg-white ring-1 ring-surface-line open:ring-brand-800/30"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 rounded-xl2 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 md:p-5 [&::-webkit-details-marker]:hidden">
        <Heading className="min-w-0 flex-1 text-base font-semibold text-brand-ink md:text-[17px]">
          <span data-faq-title="">{article.title}</span>
        </Heading>
        <ChevronDown
          aria-hidden
          className="mt-0.5 h-5 w-5 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="px-4 pb-5 md:px-5">
        {topicLabel && <p className="mb-2 text-xs text-slate-500">{topicLabel}</p>}

        <div className="space-y-2 text-sm leading-relaxed text-slate-600 md:text-[15px]">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {cards.length > 0 && (
          // A horizontal rail on a phone and a grid from tablet up. The rail
          // is -mx-4 so the cards reach the screen edge the way every other
          // scrolling row on the site does, and px-4 puts the padding back
          // inside so the first card is not clipped.
          <div className="mt-4 flex flex-wrap gap-2">
            {cards.map((p) => (
              <ProductRow key={p.slug} product={p} className="w-full max-w-[280px] sm:w-[280px]" />
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
          {article.cta_href && (
            <Link
              href={article.cta_href}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800 hover:text-brand-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
            >
              {article.cta_label ?? "ดูสินค้าทั้งหมด"}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
          <Link
            href={`/faq/${encodeURIComponent(article.public_slug)}`}
            className="text-sm text-slate-500 underline-offset-4 hover:text-brand-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          >
            เปิดหน้าคำถามนี้
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-surface-line pt-3">
          <FaqFeedback articleId={article.id} />
          <a
            href={`/chat?q=${encodeURIComponent(article.title)}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:text-brand-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            ถามน้อง Smoothie ต่อ
          </a>
        </div>
      </div>
    </details>
  );
}
