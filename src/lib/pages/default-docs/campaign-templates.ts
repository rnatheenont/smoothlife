import { SCHEMA_VERSION, type PageDoc } from "../doc";
import { SECTION_REGISTRY } from "@/sections/registry";

// The four campaign shapes from the plan (§6.6), as documents.
//
// Built from each section's own `defaults` rather than from settings written
// out here, for the same reason the home page's default document is: a
// default that lives in two places is a default that will disagree with
// itself the first time one of them is changed. What a template chooses is
// which sections, in which order, visible in which phases — not what is
// inside them.
//
// Ids are placeholders. Both saving and applying a template reissue them
// (see the templates route), because an id is what a preview link and an
// error report point at, so two pages must never share one.

type Row = { type: string; phases?: ("teaser" | "live" | "extended" | "ended")[]; hidden?: boolean };

function docOf(rows: Row[]): PageDoc {
  return {
    schemaVersion: SCHEMA_VERSION,
    sections: rows
      // A template naming a section that no longer exists would be a template
      // nobody can apply, so it is dropped here rather than failing later.
      .filter((row) => Boolean(SECTION_REGISTRY[row.type]))
      .map((row, i) => {
        const def = SECTION_REGISTRY[row.type];
        return {
          id: `t-${String(i + 1).padStart(2, "0")}`,
          type: row.type,
          v: def.version,
          settings: def.defaults,
          ...(row.phases || row.hidden ? { common: { ...(row.phases ? { phases: row.phases } : {}), ...(row.hidden ? { hidden: true } : {}) } } : {}),
        };
      }),
  };
}

export const CAMPAIGN_TEMPLATES: { name: string; description: string; doc: PageDoc }[] = [
  {
    name: "Double Day (9.9 / 10.10 / 11.11 / 12.12)",
    description: "แบนเนอร์ + นับถอยหลัง → คูปอง → flash sale → แท็บข้ามส่วน → แท็บหมวดสินค้า → แบรนด์ → เงื่อนไข",
    doc: docOf([
      { type: "campaign_hero" },
      { type: "countdown_banner" },
      // Coupons before products on purpose: a voucher collected is a reason
      // to carry on shopping, and the Shopee/Temu pattern the plan points at
      // puts them at the top for exactly that reason.
      { type: "voucher_strip" },
      { type: "flash_sale_shelf", phases: ["live", "extended"] },
      { type: "category_jump_tabs" },
      { type: "product_tabs" },
      { type: "brand_circles" },
      { type: "campaign_terms" },
      { type: "next_campaign", phases: ["ended"] },
    ]),
  },
  {
    name: "Payday",
    description: "แบนเนอร์ → คูปอง → ซื้อครบลดเพิ่ม → ชั้นสินค้าของใช้ประจำเดือน → เงื่อนไข",
    doc: docOf([
      { type: "campaign_hero" },
      { type: "voucher_strip" },
      { type: "deal_tiers" },
      { type: "product_grid" },
      { type: "campaign_terms" },
      { type: "next_campaign", phases: ["ended"] },
    ]),
  },
  {
    name: "แบรนด์เดย์",
    description: "แบนเนอร์แบรนด์ → เรื่องราว → ชั้นสินค้าของแบรนด์ → วิดีโอ → คูปองแบรนด์",
    doc: docOf([
      { type: "campaign_hero" },
      { type: "rich_text" },
      { type: "product_grid" },
      { type: "social_videos" },
      { type: "voucher_strip" },
      { type: "campaign_terms" },
    ]),
  },
  {
    name: "เปิดตัวสินค้าใหม่",
    description: "แบนเนอร์ → รูป+ข้อความ 3 ชุด → วิดีโอ → ชั้นสินค้า → เงื่อนไข",
    doc: docOf([
      { type: "campaign_hero" },
      { type: "image_banner" },
      { type: "rich_text" },
      { type: "image_banner" },
      { type: "social_videos" },
      { type: "product_grid" },
      { type: "campaign_terms" },
    ]),
  },
];
