// With the extension, so the unit tests can load this file without a bundler.
import { type PageDoc } from "../doc.ts";
import { doc } from "./build.ts";

// The pages of wave 2, written as documents.
//
// Same rule as wave 1: each of these is the page already on the site, section
// by section, with the same words and the same marks. If something here
// differs from the hand-written page it is a mistake in here, not an
// improvement — the check that the page did not move is only possible while
// there is something to compare it against.
//
// Wave 2 is the listing side of the shop (/shop, /collections, /concern,
// /brands, /search) and the knowledge library. This file fills in as those
// pages move over; the registry in system-pages.ts lists them all, and the
// admin only offers the ones that have a document here.

/** A listing page's header: the title, one line under it, and nothing else.
 *  Four of the knowledge pages are exactly this plus their grid.
 *
 *  `layout: "document"` rather than "page" is the right one here and it is
 *  worth saying why: it puts the title 8px above its summary and sets the
 *  summary in the quieter grey with room under it, which is what these pages
 *  are already written as. "page" would set the summary a shade darker and in
 *  a narrower column — a visible change on the day the page moved. */
const listingHeader = (title: string, intro: string) => ({
  type: "page_header",
  v: 1,
  settings: {
    eyebrow: "",
    title,
    intro,
    image: "",
    align: "left",
    background: "page",
    layout: "document",
    mascot: "",
    eyebrowIcon: "",
  },
});

/** A page that is a header and one grid of guides, filtered to one kind. */
const guideIndex = (title: string, intro: string, category: string): PageDoc =>
  doc([
    listingHeader(title, intro),
    {
      type: "article_grid",
      v: 1,
      settings: { heading: "", headingSize: "base", source: "static", category, limit: 24, room: "end" },
    },
  ]);

/**
 * The knowledge hub: the title, the four ways in, the blog, the guides.
 *
 * The one adjusted gap on the page is the pills' `space.top`. The header's
 * document layout leaves 32px under its summary and this page has always had
 * 24px, so the row is nudged up one 8px step. Doing it here, where it shows
 * in the editor as "ชิดขึ้น", beats adding a third header layout that nobody
 * could describe the difference of.
 */
const knowledge = (): PageDoc =>
  doc([
    listingHeader("Beauty Knowledge", "คลังความรู้เรื่องผิวพรรณจากผู้เชี่ยวชาญ พร้อมแหล่งอ้างอิงที่น่าเชื่อถือ"),
    {
      type: "link_pills",
      v: 1,
      common: { space: { top: "-1" } },
      settings: {
        heading: "",
        room: "under_header",
        items: [
          { label: "Ingredient Library", href: "/knowledge/ingredients" },
          { label: "Routine Guides", href: "/knowledge/routines" },
          { label: "Question Hub", href: "/knowledge/questions" },
          { label: "Video and How-to", href: "/knowledge/videos" },
        ],
      },
    },
    {
      type: "article_grid",
      v: 1,
      settings: {
        heading: "บทความล่าสุด",
        headingSize: "base",
        source: "shopify",
        category: "",
        limit: 24,
        room: "between",
      },
    },
    {
      type: "article_grid",
      v: 1,
      settings: {
        heading: "Expert Guides",
        headingSize: "base",
        source: "static",
        category: "",
        limit: 24,
        room: "end",
      },
    },
  ]);

const knowledgeIngredients = (): PageDoc =>
  guideIndex("Ingredient Library", "ทำความรู้จักส่วนผสมสำคัญในผลิตภัณฑ์ดูแลผิว", "ingredient");

const knowledgeRoutines = (): PageDoc =>
  guideIndex("Routine Guides", "คู่มือจัดรูทีนดูแลผิวสำหรับทุกสภาพผิว", "routine");

const knowledgeVideos = (): PageDoc =>
  guideIndex("Video and How-to", "วิดีโอสาธิตวิธีใช้ผลิตภัณฑ์อย่างถูกต้อง", "video");

/** Merged into SYSTEM_DEFAULT_DOCS. Keyed by the registry's page key, and a
 *  page with no entry here is simply not offered in the admin yet. */
export const WAVE2_DEFAULT_DOCS: Record<string, () => PageDoc> = {
  knowledge,
  "knowledge-ingredients": knowledgeIngredients,
  "knowledge-routines": knowledgeRoutines,
  "knowledge-videos": knowledgeVideos,
};
