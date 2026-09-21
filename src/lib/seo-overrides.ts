import { pgValue, supabaseConfigured, supabaseRestCached } from "@/lib/supabase-server";

// The editable layer over generated page metadata.
//
// Titles and descriptions for products, categories and concerns are derived
// from the catalogue, which is written into a file at build time — so there
// is nowhere in it for a person to put a better title that survives the next
// deploy. A row here overrides the generated one; no row means the generated
// one stands, which is the case for almost every page and has to stay cheap.
export type SeoPageType = "product" | "category" | "concern" | "campaign" | "article" | "collection";

export type SeoOverride = {
  id: string;
  page_type: SeoPageType;
  page_key: string;
  meta_title: string | null;
  meta_description: string | null;
  keywords: string[];
  ai_suggestions: SeoSuggestion[] | null;
  updated_at: string;
};

export type SeoSuggestion = { title: string; description: string };

/** What an admin can ask the assistant to lead with. Each is a real editorial
 *  choice about the same page, not a tone setting — "ปัญหาที่แก้" and
 *  "ส่วนผสมและจุดเด่น" produce genuinely different titles. */
export const SEO_ANGLES: { key: string; label: string; instruction: string }[] = [
  { key: "brand", label: "ชื่อแบรนด์", instruction: "ใส่ชื่อแบรนด์ไว้ต้น title เพราะคนค้นหาด้วยชื่อแบรนด์" },
  { key: "problem", label: "ปัญหาที่ช่วยดูแล", instruction: "เน้นปัญหาที่สินค้านี้ช่วยดูแล ใช้คำที่คนไทยเรียกปัญหานั้นจริง ๆ" },
  { key: "ingredient", label: "ส่วนผสม/จุดเด่น", instruction: "เน้นส่วนผสมหรือเทคโนโลยีเด่นที่ระบุไว้ในข้อมูล" },
  { key: "price", label: "ราคา/ความคุ้ม", instruction: "พูดถึงราคาหรือความคุ้มค่า โดยไม่ต้องสัญญาส่วนลดที่ไม่มีข้อมูล" },
  { key: "authentic", label: "ของแท้/น่าเชื่อถือ", instruction: "เน้นว่าเป็นของแท้จากผู้จัดจำหน่ายโดยตรง" },
  { key: "howto", label: "วิธีใช้/ใครเหมาะ", instruction: "บอกว่าเหมาะกับใครและใช้อย่างไร" },
];

export const SEO_PAGE_TYPES: { key: SeoPageType; label: string }[] = [
  { key: "product", label: "สินค้า" },
  { key: "category", label: "หมวดหมู่" },
  { key: "concern", label: "ปัญหาผิว" },
  { key: "campaign", label: "แคมเปญ" },
  { key: "article", label: "บทความ" },
  { key: "collection", label: "คอลเลกชัน" },
];

/** Google truncates around here; past it the tail is written for nobody. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

export const SEO_COLUMNS = "id,page_type,page_key,meta_title,meta_description,keywords,ai_suggestions,updated_at";

export function seoTag(pageType: SeoPageType, pageKey: string) {
  return `seo:${pageType}:${pageKey}`;
}

/**
 * What a page should use, or null to keep its generated default.
 *
 * Read through the Next cache and tagged, so a page render costs nothing on
 * the common path and an edit in the admin screen shows up immediately
 * (the save route revalidates the tag) rather than waiting out the window.
 * Never throws: metadata is not worth failing a page render over.
 */
export async function getSeoOverride(
  pageType: SeoPageType,
  pageKey: string
): Promise<{ title: string | null; description: string | null } | null> {
  if (!supabaseConfigured()) return null;
  try {
    const rows = await supabaseRestCached<SeoOverride[]>(
      `seo_overrides?page_type=eq.${pgValue(pageType)}&page_key=eq.${pgValue(pageKey)}` +
        `&select=meta_title,meta_description&limit=1`,
      { revalidate: 3600, tags: [seoTag(pageType, pageKey), "seo-overrides"] }
    );
    const row = rows[0];
    if (!row) return null;
    return {
      title: row.meta_title?.trim() || null,
      description: row.meta_description?.trim() || null,
    };
  } catch {
    return null;
  }
}

/** Merges an override over generated values, field by field — a row that only
 *  sets a title keeps the generated description. */
export async function withSeoOverride(
  pageType: SeoPageType,
  pageKey: string,
  generated: { title: string; description?: string }
) {
  const override = await getSeoOverride(pageType, pageKey);
  return {
    title: override?.title ?? generated.title,
    description: override?.description ?? generated.description,
  };
}
