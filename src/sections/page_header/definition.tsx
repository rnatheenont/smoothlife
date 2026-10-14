import Image from "next/image";
import { z } from "zod";
import { CONTENT_ICON_KEYS, contentIcon } from "../shared/content-icons";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";

// The top of a content page: a line above, the page's name, a sentence under
// it, and sometimes a picture.
//
// It replaces the header block that ContentPage draws for /about, /help and
// the rest — same markup, same spacing — so a page moved into the system
// looks like the page it replaced on the first day and only changes when
// somebody decides it should.
//
// This section owns the page's <h1>. That is the reason it exists as its own
// block rather than as a setting on something else: a page has exactly one
// h1, every content page needs one, and the pre-publish check can only say
// "this page has none" if there is one section whose job it is.

const schema = z.object({
  eyebrow: z.string().max(60).default(""),
  title: z.string().max(120).default(""),
  intro: z.string().max(600).default(""),
  /** A wide picture under the header, as /about has. */
  image: z.string().default(""),
  align: z.enum(["left", "center"]).default("left"),
  background: z.enum(["page", "white", "soft"]).default("page"),
  /**
   * The header's rhythm: a marketing page or a document.
   *
   * "page" keeps the header in its own 2xl column with room under it, which
   * is what every page built on ContentPage does. "document" is the policy
   * pages: the title sits closer to its summary and the summary is set in
   * the quieter grey, with no column of its own.
   *
   * Note for whoever widens this later: the policy pages carry a `max-w-3xl`
   * that has never done anything — `.container-page` is declared outside any
   * cascade layer in globals.css, so it beats every Tailwind utility,
   * `max-w-*` included. Those pages are full width today and this reproduces
   * that. Narrowing them is a change to the pages, not a fix to this file.
   */
  layout: z.enum(["page", "document", "listing"]).default("page"),
  /**
   * Whether this header owns the top of the page.
   *
   * "page" is the top padding every content page has. "none" is for a page
   * whose top is already paid for by something above — /collections has a
   * breadcrumb row there, and two blocks each adding their own top padding
   * would push the title down by the sum of both.
   */
  topRoom: z.enum(["page", "none"]).default("page"),
  /** A picture beside the title rather than under it — the mascot on the
   *  assistant page. Set, the header becomes a row; empty, nothing changes. */
  mascot: z.string().default(""),
  /** A mark before the eyebrow. Only drawn when there is an eyebrow to mark. */
  eyebrowIcon: z.string().default(""),
});

/**
 * The three rhythms, as one table rather than three conditionals.
 *
 * "page" is ContentPage's: the header in its own 2xl column with room under
 * it. "document" is the policy pages, where the title sits close to its
 * summary and the summary is the quieter grey. "listing" is the hubs — the
 * shop's indexes and the knowledge library — where the summary is one line
 * of counted facts rather than a paragraph, so it sits closer still.
 *
 * Written out literally, and the reason is the same one as everywhere else in
 * this codebase: a Tailwind class built at runtime is a class Tailwind never
 * generated, and the result is a header with no spacing rather than the
 * spacing that was asked for.
 */
const LAYOUT: Record<string, { wrap: string; h1: string; intro: string }> = {
  page: { wrap: "mb-8 max-w-2xl", h1: "mb-3", intro: "text-slate-600" },
  document: { wrap: "", h1: "mb-2", intro: "mb-8 text-slate-500" },
  listing: { wrap: "", h1: "mb-1", intro: "mb-6 text-slate-500" },
};

const TOP_ROOM: Record<string, string> = { page: "pt-8 md:pt-10", none: "" };

const BACKGROUND: Record<string, string> = {
  page: "",
  white: "bg-white",
  soft: "bg-surface-soft",
};

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const centered = settings.align === "center";
  const rhythm = LAYOUT[settings.layout] ?? LAYOUT.page;
  const top = TOP_ROOM[settings.topRoom] ?? TOP_ROOM.page;
  const EyebrowIcon = contentIcon(settings.eyebrowIcon);
  if (!settings.title && !settings.intro && !settings.image) return null;

  // With a mascot the header is a row: picture on the left, the three lines
  // on the right. It is a different shape rather than an extra element, so
  // it gets its own branch instead of a conditional inside the other one.
  if (settings.mascot) {
    return (
      <section className={BACKGROUND[settings.background] ?? ""}>
        <div className={`container-page max-w-3xl ${top}`.trimEnd()}>
          <div className="mb-8 flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0 md:h-16 md:w-16">
              <Image src={settings.mascot} alt="" fill sizes="64px" className="object-contain" priority />
            </div>
            <div>
              {settings.eyebrow && (
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-brand-800">
                  {EyebrowIcon && <EyebrowIcon size={16} />} {settings.eyebrow}
                </div>
              )}
              {settings.title && (
                <h1 className="text-2xl font-bold text-brand-ink md:text-3xl">{settings.title}</h1>
              )}
              {settings.intro && <p className="mt-1 text-sm text-slate-500">{settings.intro}</p>}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className={BACKGROUND[settings.background] ?? ""}>
      {/* Top padding only. The header's own mb-8 is the gap to whatever comes
          next, and the page's bottom padding belongs to the last section —
          the two together add up to exactly what ContentPage drew. */}
      <div className={`container-page ${top}`.trimEnd()}>
        <div className={`${rhythm.wrap} ${centered ? "mx-auto text-center" : ""}`.trim()}>
          {settings.eyebrow && <p className="mb-2 text-xs font-bold text-brand-800">{settings.eyebrow}</p>}
          {settings.title && (
            <h1 className={`text-2xl font-bold text-brand-ink md:text-3xl ${rhythm.h1}`}>
              {settings.title}
            </h1>
          )}
          {settings.intro && (
            <p className={`text-sm ${rhythm.intro}`}>{settings.intro}</p>
          )}
        </div>
        {settings.image && (
          // The ratio is fixed and the box is reserved before the file
          // arrives, so the rest of the page does not jump down when it does.
          <div className="relative mb-10 aspect-21/9 overflow-hidden rounded-xl2">
            <Image src={settings.image} alt={settings.title} fill className="object-cover" priority />
          </div>
        )}
      </div>
    </section>
  );
}

export const pageHeader: SectionDefinition<typeof schema> = {
  type: "page_header",
  version: 1,
  label: "หัวหน้า",
  description: "คำนำ หัวข้อหลัก (h1) คำโปรย และรูปกว้าง — หัวของหน้าเนื้อหา",
  category: "content",
  schema,
  defaults: {
    eyebrow: "",
    title: "หัวข้อหน้า",
    intro: "",
    image: "",
    align: "left",
    background: "page",
    layout: "page",
    topRoom: "page",
    mascot: "",
    eyebrowIcon: "",
  },
  fields: [
    { key: "eyebrow", type: "text", label: "คำนำหัวข้อ", help: "บรรทัดเล็กเหนือหัวข้อ" },
    { key: "title", type: "text", label: "หัวข้อหลัก (h1)", help: "ชื่อของหน้านี้ — มีได้หน้าละอันเดียว" },
    { key: "intro", type: "textarea", label: "คำโปรย" },
    { key: "image", type: "image", label: "รูปกว้างใต้หัวข้อ" },
    { key: "mascot", type: "image", label: "รูปข้างหัวข้อ", help: "ใส่แล้วหัวหน้าจะเรียงเป็นแถว รูปอยู่ซ้าย" },
    { key: "eyebrowIcon", type: "text", label: "ไอคอนหน้าคำนำ", help: `เลือกได้: ${CONTENT_ICON_KEYS.join(", ")}` },
    { key: "align", type: "select", label: "การจัดวาง", options: [["left", "ชิดซ้าย"], ["center", "กึ่งกลาง"]] },
    {
      key: "layout",
      type: "select",
      label: "รูปแบบหน้า",
      options: [
        ["page", "หน้าทั่วไป (เนื้อหาเต็มความกว้าง)"],
        ["document", "เอกสารยาว"],
        ["listing", "หน้ารายการ (คำโปรยชิดหัวข้อ)"],
      ],
    },
    {
      key: "topRoom",
      type: "select",
      label: "ระยะเหนือหัวข้อ",
      options: [
        ["page", "เว้นเป็นหัวของหน้า"],
        ["none", "ไม่เว้น (มีบล็อกอยู่เหนือแล้ว)"],
      ],
    },
    {
      key: "background",
      type: "select",
      label: "พื้นหลัง",
      options: [["page", "ตามพื้นหน้า"], ["white", "ขาว"], ["soft", "เขียวอ่อน"]],
    },
  ],
  enabledOn: ["page", "campaign", "system", "template"],
  // One h1 per page, so one of these per page. Not pinned, though: a
  // campaign page may well want a banner above its title, and the plan only
  // asks for the breadcrumb to be welded to the top.
  maxPerPage: 1,
  isLcpCandidate: true,
  Component,
};
