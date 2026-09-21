import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { articles } from "@/data/articles";
import ArticleGrid from "@/components/ArticleGrid";
import { breadcrumbJsonLd, faqPageJsonLd, jsonLdScript } from "@/lib/json-ld";
import { categoryLabel, excerptOf, getPublicQuestions } from "@/lib/kb-public";

export const revalidate = 900;

export const metadata = {
  title: "คำถามที่พบบ่อย | Smoothlife.com",
  description: "คำถามที่ลูกค้าถามเข้ามาจริง พร้อมคำตอบจากทีมงาน Smoothlife.com",
  alternates: { canonical: "/knowledge/questions" },
};

export default async function QuestionsPage() {
  const guides = articles.filter((a) => a.category === "qa");
  // Answers the team wrote for real customers, published one at a time from
  // /admin/knowledge-base. Empty until someone publishes the first one.
  const questions = await getPublicQuestions();

  return (
    <div className="container-page py-8 md:py-10">
      {questions.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLdScript(
              // Only the questions whose answer is printed below in full.
              faqPageJsonLd(questions.slice(0, 10).map((q) => ({ question: q.title, answer: excerptOf(q.content, 300) })))
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
              { label: "ความรู้เรื่องผิวและสุขภาพ", href: "/knowledge" },
              { label: "คำถามที่พบบ่อย" },
            ])
          ),
        }}
      />

      <h1 className="mb-2 text-2xl font-bold text-brand-ink md:text-3xl">คำถามที่พบบ่อย</h1>
      <p className="mb-8 text-sm text-slate-500">คำถามที่ลูกค้าถามเข้ามาจริง พร้อมคำตอบจากทีมงาน</p>

      {questions.length > 0 && (
        <ul className="mb-12 grid gap-3 md:grid-cols-2">
          {questions.map((q) => (
            <li key={q.public_slug}>
              <Link
                href={`/knowledge/questions/${encodeURIComponent(q.public_slug)}`}
                className="group flex h-full items-start justify-between gap-3 rounded-xl2 bg-white p-5 ring-1 ring-surface-line transition-colors hover:ring-brand-action/40"
              >
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-brand-800">{categoryLabel(q.category)}</span>
                  <span className="mt-1 block font-semibold text-brand-ink group-hover:text-brand-800">{q.title}</span>
                  <span className="mt-1 block line-clamp-2 text-sm text-slate-500">{excerptOf(q.content, 120)}</span>
                </span>
                <ChevronRight size={16} className="mt-1 shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {guides.length > 0 && (
        <>
          <h2 className="mb-4 text-lg font-bold text-brand-ink md:text-xl">บทความตอบคำถาม</h2>
          <ArticleGrid articles={guides} />
        </>
      )}
    </div>
  );
}
