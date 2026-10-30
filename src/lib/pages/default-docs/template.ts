// With the extension, so the unit tests can load this file without a bundler.
import { type PageDoc } from "../doc.ts";
import { doc } from "./build.ts";

// The templates, written as documents.
//
// Same rule as the system pages: each of these draws the page already on the
// site. The difference is how much rides on it — one of these documents is
// every concern page, every collection page, every category page. A mistake
// here is not one page looking wrong, it is a section of the shop.
//
// The first of them was the concern page, the one with the fewest moving
// parts. Its recommended routine — three sentences, the same for every skin
// concern — was taken off by request on 28 Oct 2026; the routine_steps section
// still exists for anyone who wants to put a real one back in the editor.

/** The item's own hub trail, as data only. None of these pages drew a visible
 *  breadcrumb row — they only declared the BreadcrumbList — so turning the row
 *  on is a decision for later, not a side effect of moving. */
const trailData = { type: "breadcrumb", v: 1, settings: { showHome: true, display: "data_only", room: "compact" } };

const concern = (): PageDoc =>
  doc([
    trailData,
    { type: "entity_header", v: 1, settings: { height: "tall", showDescription: true } },
    {
      type: "concern_products",
      v: 1,
      settings: { heading: "สินค้าแนะนำ", emptyText: "เร็วๆ นี้จะมีสินค้าเพิ่มเติมสำหรับหมวดนี้" },
    },
    {
      type: "faq",
      v: 1,
      settings: { heading: "คำถามที่พบบ่อยเรื่องนี้", source: "kb", kbMode: "auto", kbValue: "", kbLimit: 5, items: [] },
    },
  ]);

/**
 * A collection page: back out, the trail, the collection, its products.
 *
 * The breadcrumb row is visible here because it always was — this is one of
 * the two templates that drew one — and it brings the "กลับ" button with it.
 * The two belong together: both answer "where am I and how do I get out", the
 * button hides from lg where the trail is enough on its own, and splitting
 * them would let somebody leave a back button on a page with no trail.
 */
const collection = (): PageDoc =>
  doc([
    {
      type: "breadcrumb",
      v: 1,
      settings: {
        showHome: true,
        display: "row",
        room: "page",
        back: "above",
        backHref: "/collections",
      },
    },
    { type: "collection_header", v: 1, settings: { showDescription: true, countSuffix: "รายการ" } },
    { type: "collection_products", v: 1, settings: {} },
  ]);

/**
 * A category page: back out, the trail, the other categories, this one, the
 * way in to an advisor, and the products.
 *
 * Six categories, one document. The advisor card is the editable part and the
 * reason this template is worth having: the two entries that exist today are
 * a map hard-coded in the route, so adding one for skincare is a deploy.
 *
 * The trail and the "กลับ" button share a line here — "beside" — which is
 * what the hand-written page did, and the room above is the tighter one
 * (12px on a phone against 40 on a desktop) for the same reason.
 *
 * The trail sits under the banner rather than over it. Above, it was the
 * first thing on the page and it pushed the banner down off the fold; the
 * banner is what says where you are, so it goes first and the trail says
 * how you got there underneath it. This is also the order the hand-written
 * route has always used, so the flag no longer changes the layout.
 */
const category = (): PageDoc =>
  doc([
    { type: "category_chips", v: 1, settings: {} },
    { type: "category_header", v: 1, settings: { countSuffix: "รายการ" } },
    {
      type: "breadcrumb",
      v: 1,
      settings: {
        showHome: true,
        display: "row",
        // "compact", not "page_tight": page_tight is 40px of air on a
        // desktop, which is what a trail needs when it is the first thing
        // under the header. This one sits under the banner now, and 40px
        // there is a hole between two things that belong together.
        room: "compact",
        back: "beside",
        backHref: "/shop",
      },
    },
    {
      type: "advisor_entry",
      v: 1,
      settings: {
        image: "/mascot/smoothie-hi.png",
        items: [
          {
            category: "oral-care",
            href: "/oral-care-advisor",
            title: "ไม่รู้จะเริ่มจากตัวไหนดี?",
            subtitle: "ตอบ 3 คำถาม ให้น้อง Smoothie จัดเซ็ตดูแลช่องปากที่ใช่สำหรับคุณ",
          },
          {
            category: "wellness",
            href: "/supplement-advisor",
            title: "อาหารเสริมเยอะจนเลือกไม่ถูก?",
            subtitle: "ตอบ 5 คำถาม ให้น้อง Smoothie ช่วยหาแพลนที่ตรงเป้าหมายและงบของคุณ",
          },
        ],
      },
    },
    { type: "category_listing", v: 1, settings: { emptyText: "ไม่พบสินค้าในหมวดนี้" } },
  ]);

/**
 * A product page: the trail, the buying part, then two shelves.
 *
 * Built differently from the other templates in one way, and on purpose. The
 * page's own top and bottom padding is on a wrapper the route draws, not on
 * the first and last sections — because the last two blocks here are allowed
 * to disappear. "สินค้าที่เกี่ยวข้อง" is empty for a product with no
 * neighbours, "ดูล่าสุด" is empty for a first-time visitor, and an admin may
 * hide either. Hang the bottom of the page on a block that can vanish and the
 * page loses its bottom on exactly the visits where it looks worst.
 *
 * §G7 of the plan asks for this shape: the buying part locked, the shelves
 * around it movable. product_detail is the lock — it is the gallery, the
 * price, the variants, the subscribe option and the add-to-cart button in one
 * component, because they share one piece of state. The other two can be
 * reordered, hidden, or have their headings rewritten.
 *
 * The trail's third step is the product's category, which the registry cannot
 * know: the route passes it as the item's `under`.
 */
const product = (): PageDoc =>
  doc([
    {
      type: "breadcrumb",
      v: 1,
      settings: { showHome: true, display: "row", room: "none", back: "beside", backHref: "" },
    },
    { type: "product_detail", v: 1, settings: {} },
    // Three questions this product is actually asked, written once in the FAQ
    // centre and read here. `auto` walks the cascade in §5: questions tagged
    // with this product, then its brand, then the concerns it is sold for —
    // so a product nobody has written about yet shows its brand's answers
    // rather than an empty box, and the section draws nothing at all when
    // even that comes back empty.
    {
      type: "faq",
      v: 1,
      settings: { heading: "คำถามที่พบบ่อยเกี่ยวกับสินค้านี้", source: "kb", kbMode: "auto", kbValue: "", kbLimit: 3, items: [] },
    },
    {
      type: "related_products",
      v: 1,
      settings: { title: "สินค้าที่เกี่ยวข้อง", subtitle: "You may also like", count: 5 },
    },
    { type: "recently_viewed", v: 1, settings: {} },
  ]);

/**
 * An article page: one block, and the words in its rail.
 *
 * The thinnest template of the set, and honestly so — the page is a grid with
 * a sticky rail, which cannot be cut into sections without the rail losing
 * the thing that makes it a rail (see the note in the article_page section).
 * What it gains is four sentences that used to be typed into a layout file.
 */
const article = (): PageDoc =>
  doc([
    {
      type: "article_page",
      v: 1,
      settings: {
        othersHeading: "บทความอื่น",
        othersCount: 4,
        othersCtaLabel: "ดูบทความทั้งหมด",
        othersCtaHref: "/knowledge",
        advisorTitle: "ยังไม่แน่ใจว่าเหมาะกับคุณไหม?",
        advisorBody: "ถามน้อง Smoothie ช่วยเลือกผลิตภัณฑ์ให้ตรงกับปัญหาของคุณ",
        advisorCtaLabel: "ปรึกษาน้อง Smoothie",
        advisorCtaHref: "/advisor",
      },
    },
  ]);

/**
 * A question page: the way back, the answer, the products, the other answers.
 *
 * The trail is one step rather than a row — a pill reading "← คำถามที่พบบ่อย"
 * — because the page's title is a sentence and a full trail beside it wraps.
 * The BreadcrumbList still declares all four steps, which is what the
 * hand-written page did too.
 *
 * Padding is on the route's wrapper for the same reason as the product page:
 * the last two blocks are empty for an answer with no product tags, or when
 * it is the only published answer, and the bottom of the page must not go
 * with them.
 */
const question = (): PageDoc =>
  doc([
    {
      type: "breadcrumb",
      v: 1,
      settings: { showHome: true, display: "back_link", room: "none", back: "none", backHref: "" },
    },
    {
      type: "question_article",
      v: 1,
      settings: {
        helpText: "ยังไม่ได้คำตอบที่ต้องการ?",
        helpLinkLabel: "ทักทีมงานได้เลย",
        helpHref: "/help/contact",
      },
    },
    { type: "question_products", v: 1, settings: { heading: "สินค้าที่เกี่ยวข้อง", count: 4 } },
    { type: "related_questions", v: 1, settings: { heading: "คำถามอื่นที่คนถามบ่อย", count: 6 } },
  ]);

/** Keyed by the registry's template key. A template with no entry here is not
 *  offered in the admin yet. */
export const TEMPLATE_DEFAULT_DOCS: Record<string, () => PageDoc> = {
  concern,
  collection,
  category,
  product,
  article,
  question,
};
