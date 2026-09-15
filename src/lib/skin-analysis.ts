// The 12-concern skin analysis: what's scored, where on the face each concern
// is read, and how a score is shown. Client-safe — shared by the analysis
// route, the results screen, the face map and the saved history.

export const ZONES = ["forehead", "nose", "cheekLeft", "cheekRight", "underEyeLeft", "underEyeRight", "chin"] as const;
export type ZoneKey = (typeof ZONES)[number];

export const ZONE_LABEL: Record<ZoneKey, string> = {
  forehead: "หน้าผาก",
  nose: "จมูก",
  cheekLeft: "แก้ม",
  cheekRight: "แก้ม",
  underEyeLeft: "ใต้ตา",
  underEyeRight: "ใต้ตา",
  chin: "คาง",
};

export const CONCERN_KEYS = [
  "acne",
  "spots",
  "wrinkles",
  "texture",
  "pores",
  "darkCircles",
  "eyeBags",
  "redness",
  "oiliness",
  "moisture",
  "radiance",
  "firmness",
] as const;
export type ConcernMetric = (typeof CONCERN_KEYS)[number];

type ConcernDef = {
  label: string;
  /** Ring and map colour. */
  color: string;
  /** Face areas this concern is read in; the map only ever shades these. */
  zones: readonly ZoneKey[];
};

const SIDES = ["cheekLeft", "cheekRight"] as const;
const EYES = ["underEyeLeft", "underEyeRight"] as const;

export const CONCERN_DEFS: Record<ConcernMetric, ConcernDef> = {
  acne: { label: "สิว", color: "#F43F5E", zones: ["forehead", "nose", ...SIDES, "chin"] },
  spots: { label: "จุดด่างดำ", color: "#F59E0B", zones: ["forehead", "nose", ...SIDES, "chin"] },
  wrinkles: { label: "ริ้วรอย", color: "#8B5CF6", zones: ["forehead", ...EYES] },
  texture: { label: "ความเรียบเนียน", color: "#14B8A6", zones: ["forehead", "nose", ...SIDES, "chin"] },
  pores: { label: "รูขุมขน", color: "#EC4899", zones: ["forehead", "nose", ...SIDES] },
  darkCircles: { label: "ใต้ตาคล้ำ", color: "#6366F1", zones: EYES },
  eyeBags: { label: "ถุงใต้ตา", color: "#0EA5E9", zones: EYES },
  redness: { label: "ผิวแดง", color: "#EF4444", zones: ["forehead", "nose", ...SIDES, "chin"] },
  oiliness: { label: "ความมัน", color: "#EAB308", zones: ["forehead", "nose", "chin"] },
  moisture: { label: "ความชุ่มชื้น", color: "#06B6D4", zones: ["forehead", ...SIDES] },
  radiance: { label: "ความกระจ่างใส", color: "#F97316", zones: ["forehead", ...SIDES] },
  firmness: { label: "ความกระชับ", color: "#10B981", zones: [...SIDES, "chin"] },
};

export type ConcernResult = {
  /** 0-100, higher = more visible issue (dryness for moisture, dullness for radiance, sagging for firmness). */
  severity: number;
  note: string;
  /** Severity per face area, only for the concern's own zones. */
  zones: Partial<Record<ZoneKey, number>>;
};
export type ConcernResults = Record<ConcernMetric, ConcernResult>;

/**
 * What's shown on a chip: 0-100, higher is better, in steps of 5.
 *
 * Steps of 5 because that is as fine as a photo can be read: two photos taken
 * seconds apart differ in light and angle by more than "71 vs 74", and
 * printing that difference made the same face look like it had changed.
 */
export function concernScore(severity: number) {
  return Math.max(0, Math.min(100, Math.round((100 - severity) / 5) * 5));
}

// ── Level scoring ──────────────────────────────────────────────────────────
// The analysis rates each concern in each face area as a level, 0–4, against
// written anchors, instead of picking a number from 0–100. A free number
// invited made-up precision — the same photo sent twice came back 23 one time
// and 41 the next — while "none / slight / some / clear / marked" is a call
// the model makes the same way again. Levels become severities here, in code,
// so the mapping never drifts.

/** Severity for each level: the middle of the band the old 0–100 anchors used. */
export const LEVEL_SEVERITY = [5, 20, 38, 58, 82] as const;
export const LEVEL_LABEL = ["ไม่พบ", "เล็กน้อย", "ปานกลาง", "ชัดเจน", "มาก"] as const;

const round5 = (n: number) => Math.round(n / 5) * 5;

/** A severity read back as its level word ("เล็กน้อย", …) — for older numbers too. */
export function levelLabel(severity: number) {
  const i = severity <= 12 ? 0 : severity <= 28 ? 1 : severity <= 47 ? 2 : severity <= 69 ? 3 : 4;
  return LEVEL_LABEL[i];
}

/**
 * One concern from area levels. The overall severity leans on the worst area
 * (a breakout on the chin is a breakout even if the forehead is clear) but
 * counts how widespread it is too. Null when no area was rated.
 */
export function concernFromLevels(key: ConcernMetric, raw: unknown): ConcernResult | null {
  const r = raw as { note?: unknown; zones?: Record<string, unknown>; level?: unknown } | null;
  const level = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? Math.round(Math.min(4, Math.max(0, n))) : null;
  };
  const fallback = level(r?.level);
  const zones: Partial<Record<ZoneKey, number>> = {};
  const severities: number[] = [];
  for (const z of CONCERN_DEFS[key].zones) {
    const l = level(r?.zones?.[z]) ?? fallback;
    if (l === null) continue;
    zones[z] = LEVEL_SEVERITY[l];
    severities.push(LEVEL_SEVERITY[l]);
  }
  if (severities.length === 0) return null;
  for (const z of CONCERN_DEFS[key].zones) zones[z] ??= Math.min(...severities);
  const max = Math.max(...severities);
  const mean = severities.reduce((a, b) => a + b, 0) / severities.length;
  return {
    severity: round5(0.6 * max + 0.4 * mean),
    note: typeof r?.note === "string" ? r.note.slice(0, 200) : "",
    zones,
  };
}

/** Skin-age bands the analysis picks from, with where in the band it sits. */
const AGE_BANDS: [number, number][] = [
  [18, 24],
  [25, 30],
  [31, 38],
  [39, 48],
  [49, 60],
];
export function skinAgeFromBand(band: unknown, position: unknown): number | null {
  const b = typeof band === "number" ? band : parseFloat(String(band));
  if (!Number.isFinite(b)) return null;
  const [lo, hi] = AGE_BANDS[Math.round(Math.min(4, Math.max(0, b)))];
  const at = position === "low" ? 0.2 : position === "high" ? 0.8 : 0.5;
  return Math.round(lo + (hi - lo) * at);
}

/** One overall number: the mean of the twelve scores. */
export function skinHealth(concerns: ConcernResults) {
  const scores = CONCERN_KEYS.map((k) => concernScore(concerns[k].severity));
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export function healthBand(score: number) {
  if (score >= 85) return { label: "ผิวสุขภาพดีมาก", color: "#05755F" };
  if (score >= 70) return { label: "ผิวสุขภาพดี", color: "#0E8A6E" };
  if (score >= 50) return { label: "ผิวปานกลาง ควรดูแลเพิ่ม", color: "#B45309" };
  return { label: "ผิวต้องการการดูแล", color: "#B91C1C" };
}

// ── Face areas as MediaPipe Face Mesh landmark rings ──────────────────────
// Indices into the 478-point mesh, walked in order around each area. "Left"
// and "right" are sides of the image, matching what the analysis is told:
// landmark 234 sits on the image's left edge of the face, 454 on its right.
export const ZONE_POLYGONS: Record<ZoneKey, number[]> = {
  forehead: [54, 103, 67, 109, 10, 338, 297, 332, 284, 300, 293, 334, 296, 336, 9, 107, 66, 105, 63, 70],
  nose: [168, 417, 465, 412, 399, 437, 355, 371, 358, 327, 326, 2, 97, 98, 129, 142, 126, 217, 174, 188, 245, 193],
  cheekLeft: [116, 117, 118, 119, 120, 100, 142, 203, 206, 216, 207, 187, 147, 123, 227],
  cheekRight: [345, 346, 347, 348, 349, 329, 371, 423, 426, 436, 427, 411, 376, 352, 447],
  // Lower lid down to the second ring below the eye, so the band covers where
  // dark circles and bags actually sit, not just the lash line.
  underEyeLeft: [33, 7, 163, 144, 145, 153, 154, 155, 133, 243, 244, 233, 232, 231, 230, 229, 228, 31, 226, 130],
  underEyeRight: [263, 249, 390, 373, 374, 380, 381, 382, 362, 463, 464, 453, 452, 451, 450, 449, 448, 261, 446, 359],
  chin: [43, 106, 182, 83, 18, 313, 406, 335, 273, 422, 430, 394, 379, 378, 400, 377, 152, 148, 176, 149, 150, 169, 210, 202],
};

/**
 * Makes one concern from the model safe: severity clamped, zones limited to
 * the concern's own areas. Null when the concern is missing or unreadable.
 */
export function normaliseConcern(key: ConcernMetric, raw: unknown): ConcernResult | null {
  const r = raw as { severity?: unknown; note?: unknown; zones?: Record<string, unknown> } | null;
  const num = (v: unknown) => {
    const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
    return Number.isFinite(n) ? Math.round(Math.min(100, Math.max(0, n))) : null;
  };
  const severity = num(r?.severity);
  if (severity === null) return null;
  const zones: Partial<Record<ZoneKey, number>> = {};
  for (const z of CONCERN_DEFS[key].zones) {
    const v = num(r?.zones?.[z]);
    // An area the model didn't rate takes the concern's overall severity.
    zones[z] = v ?? severity;
  }
  return { severity, note: typeof r?.note === "string" ? r.note.slice(0, 200) : "", zones };
}
