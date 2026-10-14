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

/** Keyed by the registry's template key. A template with no entry here is not
 *  offered in the admin yet. */
export const TEMPLATE_DEFAULT_DOCS: Record<string, () => PageDoc> = {
  concern,
  collection,
};
