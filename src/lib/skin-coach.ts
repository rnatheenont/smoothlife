import { Product } from "@/data/types";
import { products } from "@/data/products";
import { concerns as concernInfo } from "@/data/categories";

export type SkinCoachMetrics = {
  faceDetected: boolean;
  acne: { score: number; note: string };
  pores: { score: number; note: string };
  darkSpots: { score: number; note: string };
  wrinkles: { score: number; note: string };
  overallNote: string;
  disclaimer: string;
};

export type ConcernSlug = "acne" | "dark-spots" | "aging";

// Deterministic, code-side mapping from photo metrics -> our own catalogue's
// concern tags. The model never names a product or a concern slug itself —
// it only returns numeric scores, so recommendations always come from real
// inventory data, never from something the model invented.
export function topConcerns(metrics: SkinCoachMetrics, max = 2): ConcernSlug[] {
  const scored: { slug: ConcernSlug; score: number }[] = [
    { slug: "acne", score: (metrics.acne.score + metrics.pores.score) / 2 },
    { slug: "dark-spots", score: metrics.darkSpots.score },
    { slug: "aging", score: metrics.wrinkles.score },
  ];
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, max).map((s) => s.slug);
}

export function concernLabel(slug: ConcernSlug) {
  return concernInfo.find((c) => c.slug === slug);
}

export function productsForConcern(slug: ConcernSlug, max = 3): Product[] {
  const rank = (p: Product) =>
    (p.badges?.includes("Bestseller") ? 2 : 0) + (p.inStock ? 1 : 0) + p.rating / 5;

  return products
    .filter((p) => p.concerns.includes(slug) && p.inStock)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, max);
}
