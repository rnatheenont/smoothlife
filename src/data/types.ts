export type Category =
  | "skincare"
  | "oral-care"
  | "hair-care"
  | "personal-care"
  | "wellness"
  | "body-care";

export type Concern =
  | "acne"
  | "dryness"
  | "dark-spots"
  | "aging"
  | "hair-scalp"
  | "sleep-stress";

export type ProductVariant = {
  /** Shopify ProductVariant GID (gid://shopify/ProductVariant/...) — required to add this variant to a real Shopify cart. */
  variantId: string;
  /** e.g. "80 ml." — empty string for a product with only Shopify's implicit "Default Title" variant. */
  size: string;
  price: number;
  compareAtPrice?: number;
  inStock: boolean;
};

export type Product = {
  slug: string;
  /** Shopify ProductVariant GID of the default variant (cheapest in-stock one) — kept for backwards compatibility with code that doesn't need variant selection (product cards, quick-add, chat/quiz recommendations). */
  variantId: string;
  name: string;
  brand: string;
  category: Category;
  concerns: Concern[];
  /** Price of the default variant. When variants.length > 1 this is the cheapest, so callers can show it as a "starting from" price. */
  price: number;
  compareAtPrice?: number;
  image: string;
  image2?: string;
  rating: number;
  reviewCount: number;
  badges?: ("Bestseller" | "New" | "Sale" | "BOGO" | "Bundle")[];
  shortDesc: string;
  description?: string;
  benefits: string[];
  howToUse: string;
  ingredients: string;
  whoFor: string;
  inStock: boolean;
  size?: string;
  /** Every purchasable variant (size/option) this product has, always at least one entry — the same one described by the top-level variantId/price/size fields. */
  variants: ProductVariant[];
};

export type Brand = {
  slug: string;
  name: string;
  tagline: string;
  productCount: number;
  image?: string;
  // Other exact Shopify vendor strings that should count as this brand (e.g.
  // "Palmers" vs "Palmer's", "Dentiste thailand" vs "Dentiste").
  vendorAliases?: string[];
};

export type CategoryInfo = {
  slug: Category;
  name: string;
  nameTh: string;
  image: string;
};

export type ConcernInfo = {
  slug: Concern;
  name: string;
  nameTh: string;
  description: string;
  image: string;
};

export type Article = {
  slug: string;
  title: string;
  category: "guide" | "ingredient" | "routine" | "qa" | "video";
  excerpt: string;
  body: string[];
  image: string;
  sources: string[];
  readMins: number;
};

export type Review = {
  author: string;
  rating: number;
  date: string;
  title: string;
  body: string;
  verified: boolean;
};
