import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { z } from "zod";
import { categoryLabel, getPublicQuestion, type PublicQuestion } from "@/lib/kb-public";
import { faqPageJsonLd, jsonLdScript } from "@/lib/json-ld";
import { thaiDate } from "@/lib/storefront-articles";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// One answer, in full.
//
// Locked, because the answer is written in /admin/knowledge-base and this is
// only where it is shown. The editable part is the line underneath it — the
// way out for somebody whose question this did not answer — which is a real
// decision about where support wants those people to go.
//
// The whole answer is on this page, which is what lets the markup claim it:
// a FAQPage whose answer lives somewhere else is the kind Google drops.

const schema = z.object({
  helpText: z.string().max(200).default(""),
  helpLinkLabel: z.string().max(80).default(""),
  helpHref: z.string().default(""),
});

async function load(
  _settings: z.output<typeof schema>,
  ctx: { entity?: { type: string; slug?: string } }
): Promise<PublicQuestion | null> {
  const slug = ctx.entity?.slug;
  return slug ? getPublicQuestion(slug) : null;
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, PublicQuestion | null>) {
  if (!data) return null;
  const paragraphs = data.content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section className="container-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdScript(
            faqPageJsonLd([{ question: data.title, answer: data.content, dateModified: data.updated_at }])
          ),
        }}
      />
      <article className="mx-auto max-w-2xl lg:mx-0">
        <span className="text-xs font-semibold text-brand-800">{categoryLabel(data.category)}</span>
        <h1 className="mt-2 text-2xl font-extrabold leading-snug text-brand-ink md:text-4xl md:leading-tight">
          {data.title}
        </h1>
        <p className="mt-2 text-xs text-slate-400">
          อัปเดตล่าสุด <time dateTime={data.updated_at}>{thaiDate(data.updated_at)}</time>
        </p>
        <div className="article-body mt-6">
          {paragraphs.map((p, i) => (
            <p key={i} className="whitespace-pre-line">
              {p}
            </p>
          ))}
        </div>

        {settings.helpText && (
          <div className="mt-8 flex items-center gap-2 rounded-xl2 bg-surface-soft p-4 text-sm text-slate-600">
            <MessageCircle size={18} className="shrink-0 text-brand-800" aria-hidden="true" />
            <span>
              {settings.helpText}{" "}
              {settings.helpLinkLabel && settings.helpHref && (
                <Link href={settings.helpHref} className="font-semibold text-brand-800 hover:underline">
                  {settings.helpLinkLabel}
                </Link>
              )}
            </span>
          </div>
        )}
      </article>
    </section>
  );
}

export const questionArticle: SectionDefinition<typeof schema> = {
  type: "question_article",
  version: 1,
  label: "ตัวคำตอบ",
  description: "คำถามและคำตอบเต็มที่หน้านี้แสดง — แก้ได้เฉพาะบรรทัดชวนติดต่อทีมงานใต้คำตอบ",
  category: "content",
  schema,
  defaults: {
    helpText: "ยังไม่ได้คำตอบที่ต้องการ?",
    helpLinkLabel: "ทักทีมงานได้เลย",
    helpHref: "/help/contact",
  },
  fields: [
    { key: "helpText", type: "text", label: "ข้อความชวน" },
    { key: "helpLinkLabel", type: "text", label: "ข้อความลิงก์" },
    { key: "helpHref", type: "text", label: "ลิงก์" },
  ],
  enabledOn: ["template"],
  requiresEntity: ["question"],
  locked: true,
  maxPerPage: 1,
  isLcpCandidate: true,
  load,
  Component,
};
