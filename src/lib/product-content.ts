import {
  pgValue,
  supabaseConfigured,
  supabaseRestCached,
} from "@/lib/supabase-server";
import type { Product } from "@/data/types";

// The free-form, bilingual content blocks that overlay a product's page —
// same idea as seo-overrides.ts (a Supabase row overlaying the generated
// catalogue), for the parts of a product page Shopify's own metafields never
// got filled in for (see the plan this came out of: 0.2% of 1,086 products
// had anything in Shopify's "Tab 1/Tab 2" fields).
//
// Keyed by one specific variant's GID, not by slug or SKU — see the comment
// on `ProductVariant.sku` in data/types.ts for why: a slug can change on a
// handle collision, and a SKU is hand-typed and not guaranteed unique. A
// variant's own GID never moves — but `Product.variantId` is NOT that: it's
// recomputed on every catalogue build as whichever variant is currently
// cheapest-and-in-stock (see fetch-products.js), so it can point at a
// different variant the day a price changes or a size sells out. Content
// written against it would silently "vanish" on the page that moved.
// `stableContentVariantId()` below picks the variant whose GID sorts lowest
// instead — the one thing about a product's variant set that doesn't change
// unless that specific variant is deleted from Shopify.

/** A fixed anchor for a product's content, independent of pricing/stock. */
export function stableContentVariantId(
  product: Pick<Product, "variantId" | "variants">,
): string {
  if (!product.variants.length) return product.variantId;
  return product.variants.reduce((min, v) => {
    const a = BigInt(v.variantId.split("/").pop() || "0");
    const b = BigInt(min.variantId.split("/").pop() || "0");
    return a < b ? v : min;
  }, product.variants[0]).variantId;
}

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
      type: "image";
      imageUrl: string;
      captionTh?: string;
      captionEn?: string;
      hasVerifiedSource?: boolean;
    }
  | {
      type: "video";
      videoUrl: string;
      posterUrl?: string;
      captionTh?: string;
      captionEn?: string;
      hasVerifiedSource?: boolean;
    }
  | {
      type: "spec_table";
      rows: {
        labelTh: string;
        labelEn: string;
        valueTh: string;
        valueEn: string;
      }[];
      hasVerifiedSource?: boolean;
    };

export const BLOCK_TYPES: { key: ContentBlock["type"]; label: string }[] = [
  { key: "paragraph", label: "ย่อหน้า" },
  { key: "bullet_list", label: "รายการหัวข้อย่อย" },
  { key: "ingredients", label: "ส่วนผสม" },
  { key: "image_text", label: "รูปภาพ + คำอธิบาย" },
  { key: "spec_table", label: "ตารางสเปค" },
  { key: "image", label: "รูปภาพ" },
  { key: "video", label: "วิดีโอ" },
];

// ---------------------------------------------------------------------------
// Video links.
//
// A "video" block holds whatever link an admin pasted; this is the one place
// that decides what that link actually plays, so the editor's preview and the
// product page cannot disagree about it. Anything unrecognised returns null
// and is treated as "not filled in yet" rather than dropped into an <iframe>
// unseen — the src of a frame on our own origin is not a field to be lax
// about, and the allowlist here is what keeps it to the three players the CSP
// in next.config.mjs permits.

export type VideoSource =
  | { kind: "youtube"; src: string }
  | { kind: "vimeo"; src: string }
  | { kind: "file"; src: string };

const YOUTUBE_ID = /^[\w-]{6,20}$/;

export function parseVideoUrl(value: string): VideoSource | null {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  // http:// would be blocked as mixed content anyway, and a javascript: or
  // data: link must never reach an iframe src.
  if (url.protocol !== "https:") return null;
  const host = url.hostname.replace(/^www\.|^m\./, "");
  const parts = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "youtube.com" || host === "youtube-nocookie.com") {
    const id =
      host === "youtu.be"
        ? parts[0]
        : parts[0] === "watch"
          ? url.searchParams.get("v") || ""
          : ["embed", "shorts", "live", "v"].includes(parts[0] ?? "")
            ? parts[1]
            : "";
    if (!id || !YOUTUBE_ID.test(id)) return null;
    // -nocookie: the same player without the ad/profile cookies a product page
    // has no business setting on a visitor who never pressed play.
    return { kind: "youtube", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = (parts[0] === "video" ? parts[1] : parts[0]) ?? "";
    if (!/^\d{6,12}$/.test(id)) return null;
    return { kind: "vimeo", src: `https://player.vimeo.com/video/${id}` };
  }

  // A file served from somewhere we control — a Shopify CDN video, our own
  // storage bucket. Plays in a <video> tag, no third-party player involved.
  // Restricted to those hosts for the same reason the pictures are (IMAGE_HOSTS
  // in the save route) and to match media-src in next.config.mjs: a file from
  // a host nobody here controls is one that can be swapped for something else
  // after the page was approved.
  const ourHost =
    host === "cdn.shopify.com" ||
    host === "smoothlife.com" ||
    url.hostname.endsWith(".supabase.co");
  if (ourHost && /\.(mp4|webm|mov)$/i.test(url.pathname)) {
    return { kind: "file", src: url.toString() };
  }
  return null;
}

export type ProductContentOverride = {
  id: string;
  variant_id: string;
  sku: string | null;
  slug: string | null;
  blocks: ContentBlock[];
  published: boolean;
  updated_at: string;
};

export const PRODUCT_CONTENT_COLUMNS =
  "id,variant_id,sku,slug,blocks,published,updated_at";

export function productContentTag(variantId: string) {
  return `product-content:${variantId}`;
}

/**
 * What a product's page should show beyond the generated defaults, or null
 * if nobody has written anything yet. Read through the Next cache and
 * tagged, same pattern as getSeoOverride — never throws, since missing
 * content is not worth failing a page render over.
 */
export async function getProductContentOverride(
  variantId: string,
): Promise<ProductContentOverride | null> {
  if (!supabaseConfigured()) return null;
  try {
    const rows = await supabaseRestCached<ProductContentOverride[]>(
      `product_content_overrides?variant_id=eq.${pgValue(variantId)}&select=${PRODUCT_CONTENT_COLUMNS}&limit=1`,
      {
        revalidate: 3600,
        tags: [productContentTag(variantId), "product-content-overrides"],
      },
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
        block.itemsTh.filter((s) => s.trim()).length > 0 &&
        block.itemsEn.filter((s) => s.trim()).length > 0
      );
    case "spec_table":
      return (
        block.rows.length > 0 &&
        block.rows.every((r) => r.labelTh.trim() && r.labelEn.trim())
      );
    // Media carries itself: a photo or a clip is as complete in Thai as it is
    // in English, so the both-languages rule the text blocks live by would
    // only block publishing over an optional caption. The link is the thing
    // that has to be there.
    case "image":
      return Boolean(block.imageUrl.trim());
    case "video":
      return parseVideoUrl(block.videoUrl) !== null;
  }
}

// ---------------------------------------------------------------------------
// The storefront's half.
//
// getProductContentOverride() above returns a row whether or not it is
// published, which is what the editor wants when it loads a draft and is
// exactly wrong for a product page. These two are what the page uses.

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
