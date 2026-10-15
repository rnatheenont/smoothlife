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
// Which is also the reason the first of them is the concern page: it is the
// one with something genuinely worth editing on it (the recommended routine,
// which today is three sentences hard-coded for every skin concern there is)
// and the one with the fewest moving parts.

/** The item's own hub trail, as data only. None of these pages drew a visible
 *  breadcrumb row — they only declared the BreadcrumbList — so turning the row
 *  on is a decision for later, not a side effect of moving. */
const trailData = { type: "breadcrumb", v: 1, settings: { showHome: true, display: "data_only", room: "compact" } };

const concern = (): PageDoc =>
  doc([
    trailData,
    { type: "entity_header", v: 1, settings: { height: "tall", showDescription: true } },
    {
      type: "routine_steps",
      v: 1,
      settings: {
        heading: "Routine แนะนำสำหรับปัญหานี้",
        steps: [
          { label: "ขั้นที่ 1", body: "ทำความสะอาดผิวด้วยผลิตภัณฑ์อ่อนโยน" },
          { label: "ขั้นที่ 2", body: "ใช้เซรั่มหรือทรีทเมนต์เฉพาะจุด" },
          { label: "ขั้นที่ 3", body: "ปิดท้ายด้วยมอยส์เจอร์ไรเซอร์และกันแดด" },
        ],
      },
    },
    {
      type: "concern_products",
      v: 1,
      settings: { heading: "สินค้าแนะนำ", emptyText: "เร็วๆ นี้จะมีสินค้าเพิ่มเติมสำหรับหมวดนี้" },
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
 */
const category = (): PageDoc =>
  doc([
    {
      type: "breadcrumb",
      v: 1,
      settings: {
        showHome: true,
        display: "row",
        room: "page_tight",
        back: "beside",
        backHref: "/shop",
      },
    },
    { type: "category_chips", v: 1, settings: {} },
    { type: "category_header", v: 1, settings: { countSuffix: "รายการ" } },
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
    {
      type: "related_products",
      v: 1,
      settings: { title: "สินค้าที่เกี่ยวข้อง", subtitle: "You may also like", count: 4 },
    },
    { type: "recently_viewed", v: 1, settings: {} },
  ]);

/** Keyed by the registry's template key. A template with no entry here is not
 *  offered in the admin yet. */
export const TEMPLATE_DEFAULT_DOCS: Record<string, () => PageDoc> = {
  concern,
  collection,
  category,
  product,
};
