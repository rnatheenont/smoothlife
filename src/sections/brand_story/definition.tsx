import { z } from "zod";
import { renderRichText } from "@/lib/rich-text";
import { brandPageData } from "@/lib/brand-page";
import type { BrandProfile } from "@/lib/brand-profiles";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// Who the brand is, in the team's words, and the few things it stands on.
//
// The words live on the brand's profile rather than in this section's
// settings: the same story belongs on the automatic brand page and on one the
// team lays out by hand, and two copies of a paragraph are two paragraphs
// that disagree by next month. This section only decides whether and how to
// show it.
//
// A brand with no story and no promises gets nothing — not an empty heading.

const schema = z.object({
  title: z.string().max(80).default(""),
  layout: z.enum(["side", "stacked"]).default("side"),
});

type Data = { brandName: string; profile: BrandProfile | null };

async function load(_settings: z.output<typeof schema>, ctx: { slug: string; draftProfile?: boolean }): Promise<Data | null> {
  const page = await brandPageData(ctx.slug, ctx.draftProfile);
  return page ? { brandName: page.brand.name, profile: page.profile } : null;
}

function Component({ settings, data }: SectionProps<z.output<typeof schema>, Data | null>) {
  const profile = data?.profile;
  const story = profile?.story.trim() ?? "";
  const usp = profile?.usp ?? [];
  if (!data || (!story && usp.length === 0)) return null;

  const side = settings.layout === "side" && story && usp.length > 0;

  return (
    <section className="container-page mt-10">
      <div className="rounded-xl2 border border-surface-line bg-white p-5 md:p-8">
        <h2 className="text-lg font-bold text-brand-ink md:text-xl">
          {settings.title.trim() || (
            <>
              รู้จัก<span translate="no">{data.brandName}</span>
            </>
          )}
        </h2>
        <div className={side ? "mt-4 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-10" : "mt-4"}>
          {story && (
            <div className="max-w-prose text-sm leading-relaxed text-slate-600 md:text-base">{renderRichText(story)}</div>
          )}
          {usp.length > 0 && (
            <ul className={`grid gap-3 ${side ? "" : "mt-5 sm:grid-cols-2"} ${!side && usp.length > 2 ? "lg:grid-cols-4" : ""}`}>
              {usp.map((item, i) => (
                <li key={`${item.title}-${i}`} className="rounded-xl bg-brand-gradient-soft px-4 py-3">
                  <p className="text-sm font-bold text-brand-ink">{item.title}</p>
                  {item.text && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{item.text}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export const brandStory: SectionDefinition<typeof schema> = {
  type: "brand_story",
  version: 1,
  label: "เรื่องราวแบรนด์",
  description: "ข้อความแนะนำแบรนด์และจุดเด่น ดึงจากโปรไฟล์แบรนด์ (แก้ที่เมนู หน้าแบรนด์)",
  category: "brand",
  schema,
  defaults: { title: "", layout: "side" },
  fields: [
    { key: "title", type: "text", label: "หัวข้อ", help: "เว้นว่าง = รู้จัก + ชื่อแบรนด์" },
    {
      key: "layout",
      type: "select",
      label: "การจัดวาง",
      options: [
        ["side", "ข้อความซ้าย จุดเด่นขวา"],
        ["stacked", "ข้อความบน จุดเด่นล่าง"],
      ],
    },
  ],
  enabledOn: ["brand"],
  maxPerPage: 1,
  load,
  check: async (_settings, ctx) => {
    const page = await brandPageData(ctx.slug, ctx.draftProfile);
    const profile = page?.profile;
    if (!profile || (!profile.story.trim() && profile.usp.length === 0)) {
      return [{ level: "warning", message: "แบรนด์นี้ยังไม่ได้เขียนเรื่องราว/จุดเด่นในโปรไฟล์ section นี้จะไม่แสดง" }];
    }
    return [];
  },
  Component,
};
