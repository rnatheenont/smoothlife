import type { EntityType, PageKind } from "./types";

// The closed list of pages the shop already has.
//
// A `page` (/p/<slug>) is something the team invents: they choose the address
// and the system had never heard of it before. A `system` page is the
// opposite — /about and /shop exist in the code whether or not anybody opens
// the editor, and what the editor does is take over their contents. So the
// list of them is not data an admin can add to; it is written here, next to
// the code that owns those routes, and a slug that is not in it gets a 404
// rather than a blank page at an address nobody serves.
//
// Three registries, because the three new kinds answer different questions:
//   SYSTEM_PAGES  — one document, one fixed address
//   TEMPLATES     — one document, every item of a type (Shopify's product.json)
//   GLOBALS       — one document, no address at all; it is on every page
//
// `wave` is the order the plan moves them over in, and it is also the switch:
// nothing is served from a document until its wave is turned on, so a wave
// can be built, reviewed and reverted without touching the ones before it.

/**
 * Every kind the admin accepts in a URL.
 *
 * One list, imported by the four routes that used to keep their own copy.
 * Four copies of a list that must agree is three chances for an address to
 * work in the editor and 404 in the preview beside it.
 */
export const PAGE_KINDS: PageKind[] = ["home", "page", "campaign", "brand", "system", "template", "global"];

export type Wave = 1 | 2 | 3 | 4 | 5;

export type SystemPage = {
  /** The admin address: /admin/pages/system/<key>. */
  key: string;
  /** Where it is on the shop. Null for the 404, which has no address of its
   *  own — it is what every address that is not one of these shows. */
  path: string | null;
  /** What the admin list calls it. */
  title: string;
  /**
   * The shorter name for the breadcrumb, when the admin list's name is too
   * long to stand in a trail.
   *
   * Two steps of the same trail reading "คอลเลกชันทั้งหมด" and then the same
   * words again as the h1 is a trail that repeats the page instead of placing
   * it. This is the one place to shorten it, so the trail stays worked out
   * from the address — a trail typed into each page is a copy of the site's
   * structure that nobody updates.
   */
  crumb?: string;
  /** How the admin list groups it. */
  group: string;
  wave: Wave;
};

export type TemplatePage = {
  /** The entity type this template draws, which is also its slug. */
  key: EntityType;
  /** The route pattern, for the admin list — not a link. */
  pattern: string;
  title: string;
  /** Roughly how many pages one publish affects. Shown in the editor's
   *  publish dialog, because "this changes 991 pages" is the one thing about
   *  a template that is not obvious from looking at it. */
  scale: string;
  wave: Wave;
};

export type GlobalDoc = {
  key: string;
  title: string;
  /** Where it shows up, in words, for the editor's header. */
  shownOn: string;
  wave: Wave;
};

const SYSTEM_LIST: SystemPage[] = [
  // Wave 1 — content pages. Nothing on them is machinery; every one of them
  // is words and pictures that currently need a deploy to change.
  { key: "about", path: "/about", title: "เกี่ยวกับเรา", group: "เกี่ยวกับเรา", wave: 1 },
  { key: "about-quality", path: "/about/quality", title: "คุณภาพและมาตรฐาน", group: "เกี่ยวกับเรา", wave: 1 },
  { key: "about-experts", path: "/about/experts", title: "ทีมผู้เชี่ยวชาญ", group: "เกี่ยวกับเรา", wave: 1 },
  { key: "about-sustainability", path: "/about/sustainability", title: "ความยั่งยืน", group: "เกี่ยวกับเรา", wave: 1 },
  { key: "promotions", path: "/promotions", title: "โปรโมชั่น", group: "การตลาด", wave: 1 },
  { key: "stores", path: "/stores", title: "สาขาและช่องทางติดต่อ", group: "เกี่ยวกับเรา", wave: 1 },
  { key: "help", path: "/help", title: "ศูนย์ช่วยเหลือ", group: "ช่วยเหลือ", wave: 1 },
  { key: "help-delivery", path: "/help/delivery", title: "การจัดส่ง", group: "ช่วยเหลือ", wave: 1 },
  { key: "help-payment", path: "/help/payment", title: "การชำระเงิน", group: "ช่วยเหลือ", wave: 1 },
  { key: "help-contact", path: "/help/contact", title: "ติดต่อเรา", group: "ช่วยเหลือ", wave: 1 },
  { key: "loyalty", path: "/loyalty", title: "สมาชิกและคะแนน", group: "การตลาด", wave: 1 },
  { key: "privacy", path: "/privacy", title: "นโยบายความเป็นส่วนตัว", group: "กฎหมาย", wave: 1 },
  { key: "terms", path: "/terms", title: "เงื่อนไขการใช้บริการ", group: "กฎหมาย", wave: 1 },
  { key: "ai-assistant", path: "/ai-assistant", title: "ผู้ช่วย AI", group: "เครื่องมือ", wave: 1 },
  { key: "offline", path: "/offline", title: "หน้าออฟไลน์", group: "ระบบ", wave: 1 },
  // The 404 has to draw when the database is unreachable — that is often the
  // reason somebody is looking at it — so its document is a fallback, never
  // a requirement. See the default doc for how that is arranged.
  { key: "not-found", path: null, title: "หน้าไม่พบ (404)", group: "ระบบ", wave: 1 },

  // Wave 2 — listing pages and hubs. Each of these keeps its machinery as a
  // locked section; what opens up is the copy around it.
  { key: "shop", path: "/shop", title: "ช้อปทั้งหมด", crumb: "ช้อป", group: "รายการสินค้า", wave: 2 },
  { key: "collections", path: "/collections", title: "คอลเลกชันทั้งหมด", crumb: "คอลเลกชัน", group: "รายการสินค้า", wave: 2 },
  { key: "concern-hub", path: "/concern", title: "ปัญหาผิวทั้งหมด", crumb: "ปัญหาผิวที่กังวล", group: "รายการสินค้า", wave: 2 },
  { key: "brands", path: "/brands", title: "แบรนด์ทั้งหมด", group: "รายการสินค้า", wave: 2 },
  { key: "search", path: "/search", title: "ค้นหา", group: "รายการสินค้า", wave: 2 },
  { key: "knowledge", path: "/knowledge", title: "ความรู้", crumb: "ความรู้เรื่องผิวและสุขภาพ", group: "ความรู้", wave: 2 },
  { key: "knowledge-ingredients", path: "/knowledge/ingredients", title: "ส่วนผสม", group: "ความรู้", wave: 2 },
  { key: "knowledge-routines", path: "/knowledge/routines", title: "รูทีน", group: "ความรู้", wave: 2 },
  { key: "knowledge-videos", path: "/knowledge/videos", title: "วิดีโอ", group: "ความรู้", wave: 2 },
  { key: "questions", path: "/knowledge/questions", title: "คำถามที่พบบ่อย", group: "ความรู้", wave: 2 },

  // Wave 4 — tools and the marketing slots inside pages that are mostly
  // machinery. Wave 3 is templates only, which is why it is missing here.
  { key: "advisor", path: "/advisor", title: "ที่ปรึกษาผิว", group: "เครื่องมือ", wave: 4 },
  { key: "supplement-advisor", path: "/supplement-advisor", title: "ที่ปรึกษาอาหารเสริม", group: "เครื่องมือ", wave: 4 },
  { key: "oral-care-advisor", path: "/oral-care-advisor", title: "ที่ปรึกษาช่องปาก", group: "เครื่องมือ", wave: 4 },
  { key: "subscription", path: "/subscription", title: "สมัครสมาชิกรายเดือน", group: "เครื่องมือ", wave: 4 },
  { key: "cart", path: "/cart", title: "ตะกร้าสินค้า", group: "บัญชีและตะกร้า", wave: 4 },
  { key: "account-login", path: "/account/login", title: "เข้าสู่ระบบ", group: "บัญชีและตะกร้า", wave: 4 },
  { key: "account-referral", path: "/account/referral", title: "ชวนเพื่อน", group: "บัญชีและตะกร้า", wave: 4 },
  { key: "account-points", path: "/account/points", title: "คะแนนสะสม", group: "บัญชีและตะกร้า", wave: 4 },
];

const TEMPLATE_LIST: TemplatePage[] = [
  { key: "category", pattern: "/shop/[category]", title: "หน้าหมวดสินค้า", scale: "ทุกหมวด", wave: 2 },
  { key: "collection", pattern: "/collections/[handle]", title: "หน้าคอลเลกชัน", scale: "ทุกคอลเลกชัน", wave: 2 },
  { key: "concern", pattern: "/concern/[slug]", title: "หน้าปัญหาผิว", scale: "ทุกปัญหาผิว", wave: 2 },
  { key: "product", pattern: "/product/[slug]", title: "หน้าสินค้า", scale: "สินค้าทุกตัวในร้าน", wave: 3 },
  { key: "article", pattern: "/knowledge/article/[slug]", title: "หน้าบทความ", scale: "ทุกบทความ", wave: 3 },
  { key: "question", pattern: "/knowledge/questions/[slug]", title: "หน้าคำถาม", scale: "ทุกคำถาม", wave: 3 },
];

const GLOBAL_LIST: GlobalDoc[] = [
  { key: "contact", title: "ข้อมูลติดต่อ", shownOn: "Footer, /stores, /help/contact, หน้าแคมเปญ และ JSON-LD", wave: 5 },
  { key: "header", title: "แถบบนสุด", shownOn: "ทุกหน้า", wave: 5 },
  { key: "footer", title: "ท้ายเว็บ", shownOn: "ทุกหน้า", wave: 5 },
  { key: "announcement", title: "แถบประกาศ", shownOn: "ทุกหน้า", wave: 5 },
  { key: "mobile_tabs", title: "แท็บล่าง (มือถือ)", shownOn: "ทุกหน้าบนมือถือ", wave: 5 },
];

const byKey = <T extends { key: string }>(list: T[]): Record<string, T> =>
  Object.fromEntries(list.map((item) => [item.key, item]));

export const SYSTEM_PAGES: Record<string, SystemPage> = byKey(SYSTEM_LIST);
export const TEMPLATES: Record<string, TemplatePage> = byKey(TEMPLATE_LIST);
export const GLOBALS: Record<string, GlobalDoc> = byKey(GLOBAL_LIST);

export const SYSTEM_PAGE_LIST = SYSTEM_LIST;
export const TEMPLATE_LIST_ALL = TEMPLATE_LIST;
export const GLOBAL_LIST_ALL = GLOBAL_LIST;

/**
 * The first segment of every system page's address.
 *
 * The create endpoint refuses these as slugs for a /p/ page: a team that
 * makes /p/about ends up with two pages competing to be the one about the
 * company, and only one of them is the one in the menu. Derived from the
 * registry rather than typed out again, so adding a system page closes its
 * address at the same moment.
 */
export function reservedTopLevelSegments(): string[] {
  const out = new Set<string>();
  for (const page of SYSTEM_LIST) {
    const first = page.path?.split("/")[1];
    if (first) out.add(first);
  }
  return [...out].sort();
}
