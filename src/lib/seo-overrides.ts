import { pgValue, supabaseConfigured, supabaseRestCached } from "@/lib/supabase-server";

// The editable layer over generated page metadata.
//
// Titles and descriptions for products, categories and concerns are derived
// from the catalogue, which is written into a file at build time — so there
// is nowhere in it for a person to put a better title that survives the next
// deploy. A row here overrides the generated one; no row means the generated
// one stands, which is the case for almost every page and has to stay cheap.
export type SeoPageType = "product" | "category" | "concern" | "campaign";

export type SeoOverride = {
  id: string;
  page_type: SeoPageType;
  page_key: string;
  meta_title: string | null;
  meta_description: string | null;
  ai_suggestions: SeoSuggestion[] | null;
  updated_at: string;
};

export type SeoSuggestion = { title: string; description: string };

export const SEO_PAGE_TYPES: { key: SeoPageType; label: string }[] = [
  { key: "product", label: "สินค้า" },
  { key: "category", label: "หมวดหมู่" },
  { key: "concern", label: "ปัญหาผิว" },
  { key: "campaign", label: "แคมเปญ" },
];

/** Google truncates around here; past it the tail is written for nobody. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

export const SEO_COLUMNS = "id,page_type,page_key,meta_title,meta_description,ai_suggestions,updated_at";

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
