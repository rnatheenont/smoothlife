import { z } from "zod";
import { pgValue, supabaseConfigured, supabaseRest, supabaseRestCached } from "@/lib/supabase-server";

// What the team writes about a brand, on top of what the catalogue says.
//
// The catalogue already knows a brand's name, logo, products, prices and
// reviews, and the brand page has always been built from that alone. This is
// the part it cannot know: a picture for the top of the page, a paragraph on
// who the brand is, the few things it is proud of, and which products to put
// first. A brand with no row here keeps the page it always had.
//
// Kept apart from the page documents on purpose. A brand page the team lays
// out by hand in the editor still reads its story and hero picture from here,
// so there is one place to change them whichever way the page is built.

export const USP_MAX = 4;
export const FEATURED_MAX = 10;
export const STORY_MAX = 1500;

export const brandProfileSchema = z.object({
  hero_image: z.string().max(500).default(""),
  hero_image_mobile: z.string().max(500).default(""),
  hero_alt: z.string().max(200).default(""),
  story: z.string().max(STORY_MAX).default(""),
  usp: z
    .array(z.object({ title: z.string().trim().min(1).max(40), text: z.string().trim().max(120).default("") }))
    .max(USP_MAX)
    .default([]),
  featured_slugs: z.array(z.string().min(1)).max(FEATURED_MAX).default([]),
});

export type BrandProfileInput = z.output<typeof brandProfileSchema>;

export type BrandProfile = BrandProfileInput & {
  slug: string;
  updated_by: string | null;
  updated_at: string;
};

export const BRAND_PROFILE_COLUMNS =
  "slug,hero_image,hero_image_mobile,hero_alt,story,usp,featured_slugs,updated_by,updated_at";

export function brandProfileTag(slug: string) {
  return `brand-profile:${slug}`;
}

/** Problems that would put something broken in front of a customer. The
 *  schema covers shape; this covers sense. */
export function profileIssues(profile: BrandProfileInput): string[] {
  const issues: string[] = [];
  // A picture with no description is a hole in the page for anyone using a
  // screen reader, and nobody notices because it looks finished.
  if (profile.hero_image && !profile.hero_alt.trim()) issues.push("รูปหัวยังไม่มีคำบรรยายรูป (alt)");
  if (profile.hero_image_mobile && !profile.hero_image) issues.push("ใส่รูปมือถืออย่างเดียวไม่ได้ ต้องมีรูปหลักด้วย");
  return issues;
}

/** True when the profile has nothing in it a page would draw. */
export function isEmptyProfile(profile: BrandProfileInput | null): boolean {
  if (!profile) return true;
  return !profile.hero_image && !profile.story.trim() && profile.usp.length === 0 && profile.featured_slugs.length === 0;
}

/**
 * The profile for one brand, or null.
 *
 * Read through the Next cache and tagged; saving in the admin revalidates the
 * tag, so an edit shows on the next request rather than an hour later. Never
 * throws — a brand page without its story is still a brand page, and a page
 * that 500s because a paragraph could not be fetched is not.
 */
export async function getBrandProfile(slug: string, useDraft = false): Promise<BrandProfile | null> {
  if (!supabaseConfigured()) return null;
  try {
    // The draft is read fresh and never cached: it changes while somebody is
    // typing, and the only thing that reads it is the admin preview, which
    // is dynamic anyway. The published profile keeps its long cache.
    const rows = useDraft
      ? await supabaseRest<(BrandProfile & { draft: unknown })[]>(
          `brand_profiles?select=${BRAND_PROFILE_COLUMNS},draft&slug=eq.${pgValue(slug)}&limit=1`
        )
      : await supabaseRestCached<BrandProfile[]>(
          `brand_profiles?select=${BRAND_PROFILE_COLUMNS}&slug=eq.${pgValue(slug)}&limit=1`,
          { revalidate: 3600, tags: [brandProfileTag(slug), "brand-profiles"] }
        );
    const row = rows[0];
    if (!row) return null;

    if (useDraft) {
      const draft = (row as { draft?: unknown }).draft;
      // A draft that no longer parses is ignored rather than shown: the
      // preview exists to answer "does this look right", and drawing
      // something the real page could never render answers a different
      // question.
      const parsedDraft = draft ? brandProfileSchema.safeParse(draft) : null;
      if (parsedDraft?.success) {
        return { ...parsedDraft.data, slug: row.slug, updated_by: row.updated_by, updated_at: row.updated_at };
      }
    }
    // Parsed on the way out as well as on the way in: a row edited by hand in
    // the dashboard should degrade to "no profile", not to a crash in a
    // component that trusted its shape.
    const parsed = brandProfileSchema.safeParse(row);
    return parsed.success ? { ...parsed.data, slug: row.slug, updated_by: row.updated_by, updated_at: row.updated_at } : null;
  } catch (err) {
    console.error(`[brand-profiles] could not read ${slug}`, err);
    return null;
  }
}
