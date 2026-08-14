import { Award, Crown, Star, type LucideIcon } from "lucide-react";
import type { Tier } from "./auth-context";

// Shown to customers as "Lv.1/2/3" instead of the internal Bronze/Silver/Gold
// tier name — simpler at a glance, and the internal names still drive the
// actual perks/multiplier logic elsewhere (account/points, lib/points.ts).
export const tierBadge: Record<Tier, { level: number; icon: LucideIcon; className: string }> = {
  Bronze: { level: 1, icon: Star, className: "bg-amber-50 text-amber-700" },
  Silver: { level: 2, icon: Award, className: "bg-slate-100 text-slate-600" },
  Gold: { level: 3, icon: Crown, className: "bg-yellow-50 text-yellow-700" },
};

// Real membership-card look per tier — a distinct metal tone per level, like
// a physical card, rather than the same brand-gradient for everyone.
// `accent` is the gradient's dominant stop, reused as a solid color anywhere
// a flat tier color is needed (e.g. the header avatar ring) so it visually
// matches the card/badge instead of using a separate, unrelated palette.
export const tierCard: Record<Tier, { gradient: string; shine: string; accent: string }> = {
  Bronze: {
    gradient: "linear-gradient(135deg, #8a5a34 0%, #c98a4b 45%, #6b4423 100%)",
    shine: "rgba(255, 214, 170, 0.25)",
    accent: "#c98a4b",
  },
  Silver: {
    gradient: "linear-gradient(135deg, #6b7686 0%, #c3cbd6 45%, #4b5563 100%)",
    shine: "rgba(255, 255, 255, 0.35)",
    accent: "#9aa5b1",
  },
  Gold: {
    gradient: "linear-gradient(135deg, #8a6a12 0%, #e8bd4e 45%, #6e4f0a 100%)",
    shine: "rgba(255, 240, 190, 0.35)",
    accent: "#e8bd4e",
  },
};
