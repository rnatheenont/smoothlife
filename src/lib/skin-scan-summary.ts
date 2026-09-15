// How a saved scan reads at a glance, for the account pages. Client-safe.
//
// Scans saved before the twelve-concern analysis only have four numbers
// (acne, pores, dark spots, wrinkles — higher meant worse), so every helper
// here falls back to those rather than showing an old scan as empty.

import type { SkinScanRow } from "@/app/api/skin-coach/history/route";
import { CONCERN_DEFS, CONCERN_KEYS, concernScore, type ConcernMetric } from "@/lib/skin-analysis";
import { CONCERNS, SKIN_TYPES } from "@/lib/skin-coach";

const LEGACY: { key: keyof SkinScanRow["metrics"]; label: string; color: string }[] = [
  { key: "acne", label: "สิว", color: CONCERN_DEFS.acne.color },
  { key: "pores", label: "รูขุมขน", color: CONCERN_DEFS.pores.color },
  { key: "darkSpots", label: "จุดด่างดำ", color: CONCERN_DEFS.spots.color },
  { key: "wrinkles", label: "ริ้วรอย", color: CONCERN_DEFS.wrinkles.color },
];

/** Overall skin score, 0–100, higher is better. */
export function scanScore(scan: SkinScanRow): number {
  if (typeof scan.skin_health === "number") return scan.skin_health;
  const values = LEGACY.map((m) => 100 - (scan.metrics?.[m.key] ?? 0));
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export type ScanArea = { key: string; label: string; score: number; color: string };

/** Every area the scan scored, worst first. */
export function scanAreas(scan: SkinScanRow): ScanArea[] {
  const areas: ScanArea[] = scan.concerns
    ? CONCERN_KEYS.map((k) => ({
        key: k,
        label: CONCERN_DEFS[k].label,
        score: concernScore(scan.concerns![k].severity),
        color: CONCERN_DEFS[k].color,
      }))
    : LEGACY.map((m) => ({ key: m.key, label: m.label, score: Math.max(0, 100 - (scan.metrics?.[m.key] ?? 0)), color: m.color }));
  return areas.sort((a, b) => a.score - b.score);
}

/** The areas that need care (under 70), worst first, at most `max`. */
export function careAreas(scan: SkinScanRow, max = 3): ScanArea[] {
  return scanAreas(scan).filter((a) => a.score < 70).slice(0, max);
}

/** Twelve-concern keys under 70, for product picks. */
export function weakConcerns(scan: SkinScanRow, max = 3): ConcernMetric[] {
  if (!scan.concerns) return [];
  return careAreas(scan, max).map((a) => a.key as ConcernMetric);
}

export function skinTypeLabels(scan: SkinScanRow): string[] {
  return (scan.skin_type ?? "")
    .split(",")
    .map((k) => SKIN_TYPES.find((t) => t.key === k)?.label)
    .filter((l): l is (typeof SKIN_TYPES)[number]["label"] => Boolean(l));
}

export function namedConcernLabels(scan: SkinScanRow): string[] {
  return (scan.main_concern ?? "")
    .split(",")
    .map((k) => CONCERNS.find((c) => c.key === k)?.label)
    .filter((l): l is (typeof CONCERNS)[number]["label"] => Boolean(l));
}

/** Tailwind text colour for a 0–100 score. */
export function scoreTone(score: number) {
  return score >= 70 ? "text-brand-800" : score >= 50 ? "text-amber-700" : "text-rose-700";
}
