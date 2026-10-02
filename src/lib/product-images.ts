import { supabaseRest, supabaseRestCached, pgValue } from "@/lib/supabase-server";
import type { Product } from "@/data/types";

// Which photographs the shop shows for a product.
//
// Everything on the site comes from Shopify's CDN by way of
// products.generated.ts, which is rebuilt every morning and cannot be edited.
// This is the overlay: a row per product saying "use ours instead", and one
// function that decides. Every screen that draws a product image calls
// resolveProductImages and nothing else re-implements the rule, because a
// second copy of it is how a product ends up with our photo on the card and
// Shopify's on the page.
//
// The rule, in full: our images are used only when the switch is on AND there
// is at least one of them. Anything else — no row, switch off, switch on but
// nothing uploaded — is Shopify's images, untouched. There is deliberately no
// state in which a product has no picture.

export const IMAGES_TAG = "product-images";

/** At most this many, matching what fetch-products pulls from Shopify. */
export const MAX_IMAGES = 10;

export type UploadedImage = {
  url: string;
  /** Where it lives in storage, kept so it can be deleted later. */
  path: string;
};

export type ImageOverride = {
  variantId: string;
  slug: string | null;
  useCustom: boolean;
  images: UploadedImage[];
};

export type ResolvedImages = {
  image: string;
  image2?: string;
  images: string[];
  /** Which set is actually on screen. The admin's status chip reads this
   *  rather than guessing from the switch, which is not the same question. */
  source: "custom" | "shopify";
};

type Row = {
  variant_id: string;
  slug: string | null;
  use_custom: boolean;
  images: UploadedImage[] | null;
};

const rowToOverride = (r: Row): ImageOverride => ({
  variantId: r.variant_id,
  slug: r.slug,
  useCustom: r.use_custom,
  images: Array.isArray(r.images) ? r.images.filter((i) => i?.url) : [],
});

/**
 * The one place the rule lives.
 *
 * `images` on a generated product is undefined when it has two photos or
 * fewer — the field is only written past that — so the Shopify branch
 * reassembles it from image/image2 rather than handing back undefined.
 */
export function resolveProductImages(
  product: Pick<Product, "image" | "image2" | "images">,
  override?: ImageOverride | null,
): ResolvedImages {
  const custom = override?.useCustom ? override.images : [];
  if (custom.length > 0) {
    const urls = custom.map((i) => i.url);
    return {
      image: urls[0],
      image2: urls[1],
      images: urls,
      source: "custom",
    };
  }
  const shopify =
    product.images && product.images.length > 0
      ? product.images
      : [product.image, product.image2].filter(Boolean as unknown as (v: string | undefined) => v is string);
  return {
    image: product.image,
    image2: product.image2,
    images: shopify,
    source: "shopify",
  };
}

/** Everything a storefront render needs, in one query: only the products
 *  actually using their own images, which is a short list. */
export async function getImageOverrideMap(): Promise<Map<string, ImageOverride>> {
  const rows = await supabaseRestCached<Row[]>(
    "product_image_overrides?use_custom=is.true&select=variant_id,slug,use_custom,images",
    { revalidate: 3600, tags: [IMAGES_TAG] },
  ).catch((): Row[] => []);
  return new Map(rows.map((r) => [r.variant_id, rowToOverride(r)]));
}

/**
 * The override for one product, matched on any of its variant ids.
 *
 * Matching on all of them rather than on the stable key alone is the same
 * defence getPublishedProductContent uses: a product's sizes come and go, and
 * a row keyed to a variant that has since been discontinued should still find
 * its product rather than quietly showing Shopify's pictures again.
 */
export function overrideFor(
  product: Pick<Product, "variantId" | "variants">,
  map: Map<string, ImageOverride>,
): ImageOverride | null {
  if (map.size === 0) return null;
  const ids = [product.variantId, ...(product.variants?.map((v) => v.variantId) ?? [])];
  for (const id of ids) {
    const hit = map.get(id);
    if (hit) return hit;
  }
  return null;
}

/**
 * What a server component actually calls.
 *
 * Hands back products whose image fields already say what the shop should
 * show, so every card, gallery, OG tag and JSON-LD block downstream keeps
 * reading `product.image` and knows nothing about any of this. One query per
 * render covers a whole page of them, and a product with no override is
 * returned as the very same object — a page with no custom photography
 * anywhere allocates nothing and renders exactly as before.
 */
export async function withCustomImages<T extends ProductImageFields>(products: T[]): Promise<T[]> {
  const map = await getImageOverrideMap();
  if (map.size === 0) return products;
  return products.map((p) => overlay(p, overrideFor(p, map)));
}

export async function withCustomImagesOne<T extends ProductImageFields>(product: T): Promise<T> {
  const [out] = await withCustomImages([product]);
  return out;
}

type ProductImageFields = Pick<
  Product,
  "image" | "image2" | "images" | "variantId" | "variants"
>;

function overlay<T extends ProductImageFields>(product: T, override: ImageOverride | null): T {
  const resolved = resolveProductImages(product, override);
  if (resolved.source === "shopify") return product;
  return { ...product, image: resolved.image, image2: resolved.image2, images: resolved.images };
}

/** The admin editor's own read: the row whether or not the switch is on, so
 *  the card can show what has been uploaded but not yet turned on. */
export async function getImageOverride(variantId: string): Promise<ImageOverride | null> {
  const [row] = await supabaseRest<Row[]>(
    `product_image_overrides?variant_id=eq.${pgValue(variantId)}` +
      "&select=variant_id,slug,use_custom,images&limit=1",
  ).catch((): Row[] => []);
  return row ? rowToOverride(row) : null;
}
