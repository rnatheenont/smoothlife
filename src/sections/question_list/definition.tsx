import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import { categoryLabel, excerptOf, getPublicQuestions, type PublicQuestion } from "@/lib/kb-public";
import { faqPageJsonLd, jsonLdScript } from "@/lib/json-ld";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The answers the team published, as cards.
//
// Locked, and that is not caution for its own sake: the content of this block
// is written one answer at a time in /admin/knowledge-base, so there is
// nothing here for the page editor to edit. Being able to delete it from the
// page, on the other hand, would quietly turn the question hub into a page
// with no questions on it.
//
// It also emits the FAQPage data that search engines read, for the answers
// whose text is actually on the page — ten of them, the same ten the
// hand-written page declared. Claiming an answer in the structured data that
// a visitor cannot find is the one mistake in this area that gets a site
// penalised rather than ignored.

const schema = z.object({});

const FAQ_IN_SCHEMA = 10;

async function load(): Promise<PublicQuestion[]> {
  return getPublicQuestions();
}

function Component({ data }: SectionProps<z.output<typeof schema>, PublicQuestion[]>) {
  const questions = data ?? [];
  // Empty until somebody publishes the first answer, and then the page is the
  // header and the guides — which is exactly what it was before.
  if (questions.length === 0) return null;

  return (
    <section className="container-page pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            faqPageJsonLd(
              questions
                .slice(0, FAQ_IN_SCHEMA)
                .map((q) => ({ question: q.title, answer: excerptOf(q.content, 300) }))
            )
          ),
        }}
      />
      <ul className="grid gap-3 md:grid-cols-2">
        {questions.map((q) => (
          <li key={q.public_slug}>
            <Link
              href={`/faq/${encodeURIComponent(q.public_slug)}`}
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
    </section>
  );
}

export const questionList: SectionDefinition<typeof schema> = {
  type: "question_list",
  version: 1,
  label: "คำถามที่เผยแพร่แล้ว",
  description: "การ์ดคำถาม-คำตอบที่ทีมงานเผยแพร่จากหลังบ้าน — เนื้อหาแก้ที่คลังความรู้ ไม่ใช่ที่นี่",
  category: "content",
  schema,
  defaults: {},
  fields: [],
  enabledOn: ["system"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};
