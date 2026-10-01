import { pgValue, supabaseConfigured, supabaseRestCached } from "@/lib/supabase-server";

// The free-form, bilingual content blocks that overlay a product's page —
// same idea as seo-overrides.ts (a Supabase row overlaying the generated
// catalogue), for the parts of a product page Shopify's own metafields never
// got filled in for (see the plan this came out of: 0.2% of 1,086 products
// had anything in Shopify's "Tab 1/Tab 2" fields).
//
// Keyed by `variant_id` (a Shopify GID), not by slug or SKU — see the
// comment on `ProductVariant.sku` in data/types.ts for why: a slug can
// change on a handle collision, and a SKU is hand-typed and not guaranteed
// unique. `variant_id` is the one thing Shopify guarantees won't move.

export type ContentBlock =
  | {
      type: "paragraph";
      headingTh?: string;
      headingEn?: string;
      bodyTh: string;
      bodyEn: string;
      hasVerifiedSource?: boolean;
    }
  | {
      type: "bullet_list";
      headingTh?: string;
      headingEn?: string;
      itemsTh: string[];
      itemsEn: string[];
      hasVerifiedSource?: boolean;
    }
  | {
      type: "ingredients";
      itemsTh: string[];
      itemsEn: string[];
      hasVerifiedSource?: boolean;
    }
  | {
      type: "image_text";
      imageUrl: string;
      headingTh?: string;
      headingEn?: string;
      bodyTh: string;
      bodyEn: string;
      hasVerifiedSource?: boolean;
    }
  | {
      type: "spec_table";
      rows: { labelTh: string; labelEn: string; valueTh: string; valueEn: string }[];
      hasVerifiedSource?: boolean;
    };

export const BLOCK_TYPES: { key: ContentBlock["type"]; label: string }[] = [
  { key: "paragraph", label: "ย่อหน้า" },
  { key: "bullet_list", label: "รายการหัวข้อย่อย" },
  { key: "ingredients", label: "ส่วนผสม" },
  { key: "image_text", label: "รูปภาพ + คำอธิบาย" },
  { key: "spec_table", label: "ตารางสเปค" },
];

export type ProductContentOverride = {
  id: string;
  variant_id: string;
  sku: string | null;
  slug: string | null;
  blocks: ContentBlock[];
  published: boolean;
  updated_at: string;
};

export const PRODUCT_CONTENT_COLUMNS = "id,variant_id,sku,slug,blocks,published,updated_at";

export function productContentTag(variantId: string) {
  return `product-content:${variantId}`;
}

/**
 * What a product's page should show beyond the generated defaults, or null
 * if nobody has written anything yet. Read through the Next cache and
 * tagged, same pattern as getSeoOverride — never throws, since missing
 * content is not worth failing a page render over.
 */
export async function getProductContentOverride(variantId: string): Promise<ProductContentOverride | null> {
  if (!supabaseConfigured()) return null;
  try {
    const rows = await supabaseRestCached<ProductContentOverride[]>(
      `product_content_overrides?variant_id=eq.${pgValue(variantId)}&select=${PRODUCT_CONTENT_COLUMNS}&limit=1`,
      { revalidate: 3600, tags: [productContentTag(variantId), "product-content-overrides"] }
    );
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/** A block is only worth showing/publishing once it actually has text in
 *  both languages — an admin mid-edit shouldn't be able to publish a block
 *  that's still half-written in one language. */
export function isBlockComplete(block: ContentBlock): boolean {
  switch (block.type) {
    case "paragraph":
    case "image_text":
      return Boolean(block.bodyTh.trim() && block.bodyEn.trim());
    case "bullet_list":
    case "ingredients":
      return (
        block.itemsTh.filter((s) => s.trim()).length > 0 && block.itemsEn.filter((s) => s.trim()).length > 0
      );
    case "spec_table":
      return block.rows.length > 0 && block.rows.every((r) => r.labelTh.trim() && r.labelEn.trim());
  }
}
