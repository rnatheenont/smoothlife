import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import { getPublicQuestions } from "@/lib/kb-public";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The other answers, as a list to keep reading.
//
// Every other published answer, newest first, minus this one — not "related"
// by any measure, because there is nothing in the knowledge base that says
// which answers belong together and a list that claimed otherwise would be
// guessing.

const schema = z.object({
  heading: z.string().max(120).default(""),
  count: z.number().int().min(2).max(12).default(6),
});

type Item = { slug: string; title: string };

async function load(
  settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; slug?: string } }
): Promise<Item[]> {
  const slug = ctx.entity?.slug;
  const all = await getPublicQuestions();
  return all
    .filter((q) => q.public_slug !== slug)
    .slice(0, settings.count)
    .map((q) => ({ slug: q.public_slug, title: q.title }));
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Item[]>) {
  const items = data ?? [];
  if (items.length === 0) return null;

  return (
    <section className="container-page">
      <div className="mt-12">
        {settings.heading && (
          <h2 className="mb-4 text-lg font-bold text-brand-ink md:text-xl">{settings.heading}</h2>
        )}
        <ul className="grid gap-2 md:grid-cols-2">
          {items.map((q) => (
            <li key={q.slug}>
              <Link
                href={`/faq/${encodeURIComponent(q.slug)}`}
                className="flex items-center justify-between gap-3 rounded-xl2 bg-white p-4 ring-1 ring-surface-line transition-colors hover:ring-brand-action/40"
              >
                <span className="min-w-0 text-sm font-medium text-brand-ink">{q.title}</span>
                <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export const relatedQuestions: SectionDefinition<typeof schema> = {
  type: "related_questions",
  version: 1,
  label: "คำถามอื่น",
  description: "รายการคำถามอื่นที่เผยแพร่แล้ว ใหม่สุดก่อน",
  category: "content",
  schema,
  defaults: { heading: "คำถามอื่นที่คนถามบ่อย", count: 6 },
  fields: [
    { key: "heading", type: "text", label: "หัวข้อ" },
    { key: "count", type: "number", label: "จำนวนคำถาม", min: 2, max: 12 },
  ],
  enabledOn: ["template"],
  requiresEntity: ["question"],
  locked: true,
  maxPerPage: 1,
  load,
  Component,
};
