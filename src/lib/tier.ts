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
