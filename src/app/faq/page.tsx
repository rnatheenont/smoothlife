import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/json-ld";
import { excerptOf } from "@/lib/kb-public";
import {
  getFaqArticles,
  getFaqTopics,
  faqSearchIndex,
  type FaqTopic,
} from "@/lib/faq-public";
import FaqBrowser from "@/components/faq/FaqBrowser";
import FaqItem from "@/components/faq/FaqItem";

// The FAQ centre.
//
// Every published answer is in this page's HTML, in full, before any
// JavaScript runs — collapsed inside <details>, which keeps its contents in
// the document. Searching and filtering happen in the browser over those same
// nodes (see FaqBrowser), so the page a crawler reads and the page a customer
// filters are one page rather than two implementations of it.
//
// ISR at fifteen minutes, with the `kb-public` tag the admin save routes
// already revalidate: publishing an answer reaches this page without anyone
// clearing a cache.
export const revalidate = 900;

const TITLE = "คำถามที่พบบ่อย";
const DESCRIPTION =
  "ค้นหาคำตอบเรื่องสินค้า ปัญหาผิว ช่องปาก เส้นผม อาหารเสริม และการสั่งซื้อ จากคำถามที่ลูกค้าถามเข้ามาจริง";

// Shown as "ยอดนิยม" under the search box. Short, in the words customers
// type, and each one is a term the index actually matches — a suggested
// search that finds nothing is worse than no suggestion.
const POPULAR = ["เสียวฟัน", "ผมร่วง", "นอนไม่หลับ", "หน้ามัน", "กันแดด"];

export const metadata = {
  title: `${TITLE} | Smoothlife.com`,
  description: DESCRIPTION,
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const [articles, topics] = await Promise.all([
    getFaqArticles(),
    getFaqTopics(),
  ]);
  const sections = topics.filter((t): t is FaqTopic => t.kind === "section");
  const concerns = topics.filter((t): t is FaqTopic => t.kind === "concern");
  const index = faqSearchIndex(articles);
  const sectionLabel = new Map(sections.map((s) => [s.slug, s.label_th]));

  return (
    <div className="pb-10">
      {/* One FAQPage block for the page, listing the questions whose answers
          are printed here in full. /help carries its own; a second block on
          the same URL is what duplicates a listing, not a block per page. */}
      {articles.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              faqPageJsonLd(
                articles.map((a) => ({
                  question: a.title,
                  answer: excerptOf(a.content, 300),
                  dateModified: a.updated_at,
                })),
              ),
            ),
          }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            breadcrumbJsonLd([
              { label: "หน้าแรก", href: "/" },
              { label: TITLE },
            ]),
          ),
        }}
      />

      {articles.length === 0 ? (
        <div className="container-page mt-6 rounded-xl2 bg-white p-6 text-center ring-1 ring-surface-line">
          <p className="text-base font-semibold text-brand-ink">
            ยังไม่มีคำถามที่เผยแพร่
          </p>
          <p className="mt-1 text-sm text-slate-500">
            ถามน้อง Smoothie ได้เลย ตอบได้ทันทีตลอด 24 ชั่วโมง
          </p>
          <Link
            href="/chat"
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-1000"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            ถามน้อง Smoothie
          </Link>
        </div>
      ) : (
        <>
          <FaqBrowser
            index={index}
            sections={sections}
            concerns={concerns}
            popular={POPULAR}
            title={TITLE}
            description={DESCRIPTION}
          >
            {articles.map((a) => (
              <FaqItem
                key={a.public_slug}
                article={a}
                topicLabel={a.topic ? sectionLabel.get(a.topic) : undefined}
              />
            ))}
          </FaqBrowser>

          <aside className="container-page mt-8 rounded-xl2 bg-surface-soft p-5 text-center ring-1 ring-surface-line md:p-6">
            <p className="text-base font-semibold text-brand-ink">
              ไม่เจอคำตอบที่ต้องการ
            </p>
            <p className="mt-1 text-sm text-slate-500">
              ถามน้อง Smoothie ได้ตลอด 24 ชั่วโมง หรือคุยกับทีมงานทาง LINE
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/chat"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-brand-800 px-5 text-sm font-semibold text-white hover:bg-brand-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                ถามน้อง Smoothie
              </Link>
              <Link
                href="/help"
                className="inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-semibold text-brand-800 ring-1 ring-surface-line hover:ring-brand-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
              >
                ศูนย์ช่วยเหลือ
              </Link>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
