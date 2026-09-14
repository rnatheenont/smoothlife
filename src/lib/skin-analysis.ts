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

/** What's shown on a chip: 0-100, higher is better. */
export function concernScore(severity: number) {
  return Math.max(0, Math.min(100, Math.round(100 - severity)));
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
