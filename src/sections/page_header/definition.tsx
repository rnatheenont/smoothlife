import Image from "next/image";
import { z } from "zod";
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
});

const BACKGROUND: Record<string, string> = {
  page: "",
  white: "bg-white",
  soft: "bg-surface-soft",
};

function Component({ settings }: SectionProps<z.output<typeof schema>>) {
  const centered = settings.align === "center";
  if (!settings.title && !settings.intro && !settings.image) return null;

  return (
    <section className={BACKGROUND[settings.background] ?? ""}>
      <div className="container-page py-8 md:py-10">
        <div className={`mb-8 max-w-2xl ${centered ? "mx-auto text-center" : ""}`}>
          {settings.eyebrow && <p className="mb-2 text-xs font-bold text-brand-800">{settings.eyebrow}</p>}
          {settings.title && (
            <h1 className="mb-3 text-2xl font-bold text-brand-ink md:text-3xl">{settings.title}</h1>
          )}
          {settings.intro && <p className="text-sm text-slate-600">{settings.intro}</p>}
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
  defaults: { eyebrow: "", title: "หัวข้อหน้า", intro: "", image: "", align: "left", background: "page" },
  fields: [
    { key: "eyebrow", type: "text", label: "คำนำหัวข้อ", help: "บรรทัดเล็กเหนือหัวข้อ" },
    { key: "title", type: "text", label: "หัวข้อหลัก (h1)", help: "ชื่อของหน้านี้ — มีได้หน้าละอันเดียว" },
    { key: "intro", type: "textarea", label: "คำโปรย" },
    { key: "image", type: "image", label: "รูปกว้างใต้หัวข้อ" },
    { key: "align", type: "select", label: "การจัดวาง", options: [["left", "ชิดซ้าย"], ["center", "กึ่งกลาง"]] },
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
