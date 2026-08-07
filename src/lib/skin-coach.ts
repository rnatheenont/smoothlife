import { Product } from "@/data/types";
import { products } from "@/data/products";
import { concerns as concernInfo } from "@/data/categories";

export type SkinCoachMetrics = {
  faceDetected: boolean;
  skinAge: { years: number; note: string };
  acne: { score: number; note: string };
  pores: { score: number; note: string };
  darkSpots: { score: number; note: string };
  wrinkles: { score: number; note: string };
  overallNote: string;
  disclaimer: string;
};

export type ConcernSlug = "acne" | "dark-spots" | "aging";

// Combined headline score = average clarity across the four scanned areas.
// Kept as a simple, explainable mean (not a hidden model output) so the
// number on screen always matches the bars underneath it. Shared by the
// results view and the share-card canvas so they never drift apart.
export function overallScore(metrics: SkinCoachMetrics) {
  const clarities = [metrics.acne.score, metrics.pores.score, metrics.darkSpots.score, metrics.wrinkles.score].map(
    (s) => Math.max(0, Math.min(100, 100 - s))
  );
  return Math.round(clarities.reduce((a, b) => a + b, 0) / clarities.length);
}

export function scoreBand(score: number) {
  if (score >= 85) return { label: "ผิวสุขภาพดีมาก", hex: "#00A87B" };
  if (score >= 70) return { label: "ผิวสุขภาพดี", hex: "#00B39B" };
  if (score >= 50) return { label: "ผิวปานกลาง ดูแลเพิ่มได้", hex: "#F59E0B" };
  return { label: "ควรดูแลผิวเพิ่มเติม", hex: "#F43F5E" };
}

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

// Reward tier is inverse to the score: skin that could use more care gets a
// bigger nudge to shop, healthy scores still get a smaller thank-you for
// completing the scan. Kept in a narrow 5-15% band so it stays a reasonable
// marketing perk rather than an exploitable giveaway. Shared by the results
// view (to preview the tier) and the claim-reward API (source of truth).
export function discountForScore(score: number): { percentage: number; label: string } {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped >= 85) return { percentage: 0.05, label: "5%" };
  if (clamped >= 70) return { percentage: 0.08, label: "8%" };
  if (clamped >= 50) return { percentage: 0.12, label: "12%" };
  return { percentage: 0.15, label: "15%" };
}

export function productsForConcern(slug: ConcernSlug, max = 3): Product[] {
  const rank = (p: Product) =>
    (p.badges?.includes("Bestseller") ? 2 : 0) + (p.inStock ? 1 : 0) + p.rating / 5;

  return products
    .filter((p) => p.concerns.includes(slug) && p.inStock)
    .sort((a, b) => rank(b) - rank(a))
    .slice(0, max);
}
