import Link from "next/link";
import BackButton from "@/components/BackButton";
import { ChevronRight } from "lucide-react";
import { z } from "zod";
import type { SectionDefinition, SectionProps } from "@/lib/pages/types";
import { crumbsFor, type Crumb } from "./trail";
import { SITE_URL } from "@/lib/site-url";
import { jsonLdScript } from "@/lib/json-ld";

// Where this page sits, and how to go back up.
//
// The trail is worked out from the page itself rather than typed in, because
// a typed one is a copy of the site's structure that nobody updates: the day
// /help/delivery moves, the breadcrumb on it still says where it used to be.
// So the only setting is whether to show it at all.
//
// It also emits the BreadcrumbList that search engines read. That is the
// other half of why this is a section and not a line of markup in a layout —
// the structured data and the thing on the screen are built from one list, so
// they cannot drift apart.

const schema = z.object({
  /** Whether the first step says "หน้าแรก". Off for pages that are one step
   *  from home, where it would be the entire trail. */
  showHome: z.boolean().default(true),
  /**
   * The row, or only the data search engines read.
   *
   * "data_only" exists for pages that already declared a BreadcrumbList
   * without ever showing a trail — /knowledge/questions is one. Showing the
   * row there would be a change to the page on the day it moved into the
   * system, and the trail is worth keeping either way: it is how a search
   * result shows where a page sits.
   */
  display: z.enum(["row", "data_only"]).default("row"),
  /**
   * How much room the row sits in.
   *
   * "compact" is the original: a thin strip above a header that pays for the
   * page's own top padding. "page" is for a page where the breadcrumb *is*
   * the top of the page — /collections starts with it — so it carries the
   * page's top padding and the gap down to the title.
   */
  room: z.enum(["compact", "page", "page_tight", "none"]).default("compact"),
  /**
   * A "back" button with the trail.
   *
   * It is here rather than being its own section because the two are one
   * piece of furniture: both answer "where am I and how do I get out", the
   * button is hidden from lg where the trail is enough on its own, and on
   * the category pages they share a line. A separate section would let
   * somebody leave the button on a page with no trail, which is a button
   * that says nothing.
   *
   * "above" puts it on its own line over the trail (the collection pages),
   * "beside" puts the two on one line (the category pages).
   */
  back: z.enum(["none", "above", "beside"]).default("none"),
  /**
   * Where "back" goes when there is no history to go back to — a visit that
   * started on this page, from a shared link.
   *
   * Empty means "one step up the trail", which is the right answer often
   * enough to be the default: a product's is its category, a collection
   * page's is the collection index. Fill it in only to send people somewhere
   * the trail does not go.
   */
  backHref: z.string().default(""),
});

const ROOM: Record<string, string> = {
  compact: "pt-4",
  page: "pt-6 pb-4 md:pt-8",
  page_tight: "pt-3 md:pt-10",
  // For a page whose own top and bottom padding is on the wrapper the route
  // draws, rather than on the first and last sections — see the note in the
  // product template about why that page is built that way.
  none: "",
};

function Component({ settings, ctx }: SectionProps<z.output<typeof schema>>) {
  const trail = crumbsFor(ctx);
  if (trail.length === 0) return null;

  const items: Crumb[] = settings.showHome ? [{ label: "หน้าแรก", href: "/" }, ...trail] : trail;
  // One step is not a trail — it is the name of the page you are looking at.
  if (items.length < 2) return null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_URL}${item.href}` } : {}),
    })),
  };

  const script = <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(jsonLd) }} />;
  if (settings.display === "data_only") return script;

  const room = ROOM[settings.room] ?? ROOM.compact;
  const list = (
    <ol className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-xs text-slate-500 scrollbar-none">
      {items.map((item, i) => (
        <li key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} className="shrink-0 text-slate-300" />}
          {item.href && i < items.length - 1 ? (
            <Link href={item.href} className="transition-colors hover:text-brand-800">
              {item.label}
            </Link>
          ) : (
            <span className={i === items.length - 1 ? "font-medium text-brand-ink" : ""}>{item.label}</span>
          )}
        </li>
      ))}
    </ol>
  );

  // No back button: the nav is the whole block, exactly as it was before the
  // button existed as an option. Kept as its own branch rather than wrapping
  // everything in a div, so the pages already drawing this do not gain an
  // element on the day the option arrives.
  if (settings.back === "none") {
    return (
      <nav aria-label="Breadcrumb" className={`container-page ${room}`.trimEnd()}>
        {script}
        {list}
      </nav>
    );
  }

  // One step up the trail: the last step that is a link, which is the step
  // before this page. Written as a fallback for the setting rather than
  // instead of it, so a page that wants somewhere else still gets it.
  const upOneStep = [...items].reverse().find((i) => i.href)?.href;
  const back = <BackButton fallbackHref={settings.backHref || upOneStep || "/"} />;

  if (settings.back === "beside") {
    return (
      <div className={`container-page ${room}`.trimEnd()}>
        {script}
        <div className="mb-4 flex items-center gap-3">
          {back}
          <nav aria-label="Breadcrumb" className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
            {list}
          </nav>
        </div>
      </div>
    );
  }

  return (
    <div className={`container-page ${room}`.trimEnd()}>
      {script}
      {back}
      <nav aria-label="Breadcrumb" className="min-w-0 overflow-x-auto scrollbar-none">
        {list}
      </nav>
    </div>
  );
}

export const breadcrumb: SectionDefinition<typeof schema> = {
  type: "breadcrumb",
  version: 1,
  label: "เส้นทางหน้า (breadcrumb)",
  description: "แถวบอกตำแหน่งของหน้านี้ สร้างอัตโนมัติจากที่อยู่ — ตั้งได้แค่ว่าจะแสดงหรือส่งให้ search engine เท่านั้น",
  category: "layout",
  schema,
  defaults: { showHome: true, display: "row", room: "compact", back: "none", backHref: "" },
  fields: [
    { key: "showHome", type: "toggle", label: 'เริ่มด้วย "หน้าแรก"' },
    {
      key: "room",
      type: "select",
      label: "ระยะรอบแถว",
      options: [
        ["compact", "แถวบางเหนือหัวข้อ"],
        ["page", "เป็นบล็อกบนสุดของหน้า"],
        ["page_tight", "บนสุดของหน้า แบบชิด"],
        ["none", "ไม่เว้นเลย (หน้าเว้นระยะเอง)"],
      ],
    },
    {
      key: "back",
      type: "select",
      label: 'ปุ่ม "กลับ"',
      help: "ปุ่มนี้ซ่อนบนจอใหญ่ เพราะที่นั่นเส้นทางพาออกได้เอง",
      options: [
        ["none", "ไม่มี"],
        ["above", "อยู่บรรทัดเหนือเส้นทาง"],
        ["beside", "อยู่บรรทัดเดียวกับเส้นทาง"],
      ],
    },
    { key: "backHref", type: "text", label: 'ปลายทางของปุ่ม "กลับ" เมื่อไม่มีประวัติ' },
    {
      key: "display",
      type: "select",
      label: "การแสดงผล",
      options: [
        ["row", "แสดงแถวเส้นทาง"],
        ["data_only", "ไม่แสดง ส่งให้ search engine เท่านั้น"],
      ],
    },
  ],
  enabledOn: ["system", "template"],
  maxPerPage: 1,
  pinned: "top",
  Component,
};
