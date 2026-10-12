import type { Product } from "./types";

// What a product card needs, and nothing else.
//
// A Product carries about forty fields: every variant with its sku, size and
// own stock count, the photo gallery, the concerns, the SEO lines. A card
// draws thirteen of them. Every one of the others still travelled from the
// server into the browser, serialised into the HTML of every page with a
// shelf on it — the brand page shipped 685 KB of HTML, most of it product
// data nothing on screen was reading.
//
// Two of the fields here are answers rather than data. "เริ่มต้น" above the
// price means the variants are not all the same price, and "เหลือเพียง N
// ชิ้น" means the default variant is nearly out — both were worked out in
// the card from the whole variants array. Working them out on the server
// turns an array of objects into a boolean and a number, which is the
// difference between carrying a list and carrying its conclusion.

export type ProductCardData = {
  slug: string;
  /** The default variant's GID — what quick-add puts in the cart. */
  variantId: string;
  name: string;
  brand: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  inStock: boolean;
  rating: number;
  reviewCount: number;
  sold?: number;
  badges?: Product["badges"];
  /**
   * Whether the variants differ in price, so the card can say the price it
   * shows is a starting point. Required, not optional: a card that is handed
   * a whole Product by mistake must not type-check, because the mistake
   * would be invisible — the price would simply stop saying "เริ่มต้น" on
   * the products where it matters.
   */
  multiplePrices: boolean;
  /** Stock of the default variant when the shop publishes it, else null. */
  quantity: number | null;
};

export function toCardData(p: Product): ProductCardData {
  const defaultVariant = p.variants.find((v) => v.variantId === p.variantId);
  return {
    slug: p.slug,
    variantId: p.variantId,
    name: p.name,
    brand: p.brand,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    image: p.image,
    inStock: p.inStock,
    rating: p.rating,
    reviewCount: p.reviewCount,
    sold: p.sold,
    badges: p.badges,
    multiplePrices: p.variants.length > 1 && p.variants.some((v) => v.price !== p.price),
    quantity: typeof defaultVariant?.quantity === "number" ? defaultVariant.quantity : null,
  };
}
