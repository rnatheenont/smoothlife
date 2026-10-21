import { pgValue, supabaseConfigured, supabaseRestCached } from "@/lib/supabase-server";

// The editable layer over generated page metadata.
//
// Titles and descriptions for products, categories and concerns are derived
// from the catalogue, which is written into a file at build time — so there
// is nowhere in it for a person to put a better title that survives the next
// deploy. A row here overrides the generated one; no row means the generated
// one stands, which is the case for almost every page and has to stay cheap.
export type SeoPageType =
  | "product"
  | "category"
  | "concern"
  | "campaign"
  | "article"
  | "collection"
  | "brand"
  | "page";

export type SeoOverride = {
  id: string;
  page_type: SeoPageType;
  page_key: string;
  meta_title: string | null;
  meta_description: string | null;
  /** Absolute https URL of the picture a shared link shows. */
  og_image: string | null;
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
  { key: "brand", label: "แบรนด์" },
  { key: "page", label: "หน้าหลัก" },
];

/** Google truncates around here; past it the tail is written for nobody. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;

export const SEO_COLUMNS =
  "id,page_type,page_key,meta_title,meta_description,og_image,keywords,ai_suggestions,updated_at";

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
): Promise<{ title: string | null; description: string | null; image: string | null } | null> {
  if (!supabaseConfigured()) return null;
  try {
    const rows = await supabaseRestCached<SeoOverride[]>(
      `seo_overrides?page_type=eq.${pgValue(pageType)}&page_key=eq.${pgValue(pageKey)}` +
        `&select=meta_title,meta_description,og_image&limit=1`,
      { revalidate: 3600, tags: [seoTag(pageType, pageKey), "seo-overrides"] }
    );
    const row = rows[0];
    if (!row) return null;
    return {
      title: row.meta_title?.trim() || null,
      description: row.meta_description?.trim() || null,
      image: row.og_image?.trim() || null,
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
  generated: { title: string; description?: string; image?: string }
) {
  const override = await getSeoOverride(pageType, pageKey);
  return {
    title: override?.title ?? generated.title,
    description: override?.description ?? generated.description,
    image: override?.image ?? generated.image,
  };
}

/** The `openGraph.images` value for a page, or nothing when neither the
 *  override nor the page itself has a picture — an empty array would tell
 *  LINE and Facebook there is no image at all, which is worse than letting
 *  the site-wide default (src/app/opengraph-image.png) stand. */
export function ogImages(url: string | undefined) {
  return url ? { images: [{ url }] } : {};
}

/**
 * Both sets of tags a shared link is read from, written once.
 *
 * Pages used to set `openGraph` alone. Next does not copy those across to
 * the `twitter:` tags, and the root layout defines its own — so on every
 * page of this site the twitter tags still said "Smoothlife.com — สุขภาพ
 * และความงามครบวงจร", whatever the page was. Any app that prefers those
 * tags (several chat apps do) showed the site's front door for a link to a
 * product, a brand or a campaign.
 *
 * No `images` means no image key at all rather than an empty one, so the
 * opengraph-image file at the route — or the site default at the root —
 * supplies the picture for both.
 */
export function shareMeta({
  title,
  description,
  url,
  image,
  type = "website",
}: {
  title: string;
  description: string;
  url?: string;
  image?: string;
  type?: "website" | "article";
}) {
  return {
    openGraph: { title, description, type, ...(url ? { url } : {}), ...ogImages(image) },
    // Large: every picture this site hands a scraper is a 1200x630 card, and
    // "summary" shrinks it to a thumbnail beside the text.
    twitter: {
      card: "summary_large_image" as const,
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
