import {
  pgValue,
  supabaseConfigured,
  supabaseRestCached,
} from "@/lib/supabase-server";
import { productContentTag, type ContentBlock } from "@/lib/product-content";

// The storefront's half of the product-content feature.
//
// Separate from product-content.ts on purpose, and not because the two want to
// be apart: that file is being written in another session at the same time as
// this one, and two agents editing one module overwrite each other. Worth
// folding back together once both halves have landed — this file is small and
// has no reason of its own to exist.
//
// It is not simply a wrapper, though. getProductContentOverride() there reads
// a row whether or not it is published, which is right for the editor loading
// a draft and wrong for a product page: an unpublished draft must not appear
// on the live site. This asks for published rows only.

/** Tagged by slug: the page makes one lookup for the whole product, so that is
 *  the unit a save has to invalidate. */
export function productContentPageTag(slug: string) {
  return `product-content-page:${slug}`;
}

/**
 * The published blocks for a product, or null when nobody has written any —
 * which is the case for almost all 1,086 products and has to stay cheap.
 *
 * Takes every one of the product's variant ids rather than one. The row is
 * keyed on a single variant, and a product's variant set changes whenever a
 * size is added or retired; matching on any of them keeps copy attached to the
 * product it was written for instead of to a bottle size. Read through the
 * Next cache, and never throws — a product page is worth more than its last
 * tab.
 */
export async function getPublishedProductContent(
  slug: string,
  variantIds: string[],
): Promise<ContentBlock[] | null> {
  if (!supabaseConfigured() || variantIds.length === 0) return null;
  try {
    const list = variantIds.map((id) => pgValue(id)).join(",");
    const rows = await supabaseRestCached<{ blocks: ContentBlock[] }[]>(
      `product_content_overrides?variant_id=in.(${list})&published=is.true&select=blocks&limit=1`,
      {
        revalidate: 3600,
        // Tagged with every one of the product's variants as well as the page
        // itself. The admin save route revalidates product-content:<variantId>
        // for the one variant the row is keyed on, and this read does not know
        // which that is — tagging all of them means a publish shows up here
        // whichever one the editor wrote to, with nothing to change at that end.
        tags: [
          productContentPageTag(slug),
          ...variantIds.map(productContentTag),
          "product-content",
        ],
      },
    );
    const blocks = rows[0]?.blocks;
    return Array.isArray(blocks) && blocks.length > 0 ? blocks : null;
  } catch {
    return null;
  }
}
