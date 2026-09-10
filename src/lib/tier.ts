import { Award, Crown, Star, type LucideIcon } from "lucide-react";
import type { Tier } from "./auth-context";

// Customer-facing tier names — a skin-glow progression, on-brand for a
// skincare/wellness retailer, standing in for the internal Bronze/Silver/
// Gold identifiers (which stay as-is everywhere else: DB values, tier
// comparison logic, coupon eligibility keys). Only the display layer
// changes here.
export const tierDisplayName: Record<Tier, { en: string; th: string }> = {
  Bronze: { en: "Glow", th: "โกลว์" },
  Silver: { en: "Radiance", th: "เรเดียนซ์" },
  Gold: { en: "Luminous", th: "ลูมินัส" },
};

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

// What each tier actually gives you, in one place.
//
// Real perks only. The handoff doc lists a great deal more — member pricing,
// early access windows, gift wrapping, partner discounts, event invites,
// priority shipping, a personalised shopping day — and none of that was
// built. Listing it here would have the member card promising a customer
// something nobody can deliver when they ask for it, which is worse than a
// short list. /loyalty follows the same rule; when a perk ships, it goes in
// both places at once.
export const tierPerks: Record<Tier, string[]> = {
  Bronze: [
    "สะสม 1 แต้ม ทุกการใช้จ่าย ฿1",
    "แต้มจากรีวิวสินค้า +5 ถึง +30",
    "โบนัสวันเกิด +100 แต้ม",
    "คูปองแนะนำเพื่อน ฿100",
  ],
  Silver: ["โบนัสวันเกิด +200 แต้ม พร้อมส่วนลด 10%", "สิทธิ์ทุกอย่างของระดับ Glow"],
  Gold: ["โบนัสวันเกิด +300 แต้ม พร้อมส่วนลด 20%", "สิทธิ์ทุกอย่างของระดับ Radiance"],
};
