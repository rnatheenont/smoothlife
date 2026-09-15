import type { ConcernResults } from "@/lib/skin-analysis";

export type SkinCoachMetrics = {
  faceDetected: boolean;
  skinAge: { years: number; note: string };
  acne: { score: number; note: string };
  pores: { score: number; note: string };
  darkSpots: { score: number; note: string };
  wrinkles: { score: number; note: string };
  /** All twelve concerns with per-area severity (see skin-analysis.ts). */
  concerns?: ConcernResults;
  /** Everyday care tips for the top concerns. */
  advice?: string;
  /** What about the photo may have moved the result ("แสงน้อย", …); empty when fine. */
  photoIssues?: string[];
  overallNote: string;
  disclaimer: string;
};


// ── The scan flow ──────────────────────────────────────────────────────────
// Front is the only required photo; every other angle is an optional extra,
// offered after the first shot with what it helps the scan see.
export const ANGLES = [
  { key: "front", label: "หน้าตรง", helps: "ภาพรวมทั้งใบหน้า" },
  { key: "cheek", label: "แก้มซ้าย", helps: "รูขุมขนและสิวชัดขึ้น" },
  { key: "cheekRight", label: "แก้มขวา", helps: "รูขุมขนและสิวอีกข้าง" },
  { key: "forehead", label: "หน้าผาก", helps: "ริ้วรอยและความมัน" },
  { key: "eye", label: "ขอบตา", helps: "ริ้วรอยรอบดวงตา" },
  { key: "chin", label: "คาง", helps: "สิวและรอยดำบริเวณคาง" },
  { key: "problem", label: "จุดที่กังวล", helps: "ดูใกล้เฉพาะจุดที่คุณสนใจ" },
] as const;
export type AngleKey = (typeof ANGLES)[number]["key"];

export type Confidence = "basic" | "good" | "detailed";

/** How much the scan has to go on — front only, one extra angle, or more. */
export function confidenceFor(angleCount: number): { level: Confidence; label: string; step: 1 | 2 | 3 } {
  if (angleCount >= 3) return { level: "detailed", label: "ละเอียด", step: 3 };
  if (angleCount === 2) return { level: "good", label: "ดี", step: 2 };
  return { level: "basic", label: "พื้นฐาน", step: 1 };
}

// Optional questions. None of these are sent to the model — they only shape
// how the result is read back (age comparison) and which products lead.
export const AGE_RANGES = [
  { key: "u25", label: "ต่ำกว่า 25", min: 0, max: 24 },
  { key: "25-34", label: "25–34", min: 25, max: 34 },
  { key: "35-44", label: "35–44", min: 35, max: 44 },
  { key: "45+", label: "45 ขึ้นไป", min: 45, max: 120 },
] as const;
export type AgeRangeKey = (typeof AGE_RANGES)[number]["key"];

export const SKIN_TYPES = [
  { key: "oily", label: "ผิวมัน" },
  { key: "dry", label: "ผิวแห้ง" },
  { key: "combination", label: "ผิวผสม" },
  { key: "normal", label: "ผิวธรรมดา" },
  { key: "sensitive", label: "ผิวแพ้ง่าย" },
] as const;
export type SkinTypeKey = (typeof SKIN_TYPES)[number]["key"];

export type MetricKey = "acne" | "pores" | "darkSpots" | "wrinkles";
// Concerns the scan can't measure from a photo still get their own picks.
export type ExtraKey = "dryness" | "sensitive";

// What a person can say they worry about. Most map onto a scan metric, so
// the picks sit under that finding; dryness and sensitivity have no metric
// and get a row of their own.
export const CONCERNS = [
  { key: "acne", label: "สิว", metric: "acne" },
  { key: "acneMarks", label: "รอยสิว รอยดำ", metric: "darkSpots" },
  { key: "pores", label: "รูขุมขนกว้าง", metric: "pores" },
  { key: "oiliness", label: "ผิวมัน หน้าเงา", metric: "pores" },
  { key: "darkSpots", label: "ฝ้า กระ จุดด่างดำ", metric: "darkSpots" },
  { key: "dullness", label: "ผิวหมองคล้ำ ไม่กระจ่างใส", metric: "darkSpots" },
  { key: "wrinkles", label: "ริ้วรอย", metric: "wrinkles" },
  { key: "firmness", label: "ผิวหย่อนคล้อย ไม่กระชับ", metric: "wrinkles" },
  { key: "dryness", label: "ผิวแห้ง ขาดน้ำ", extra: "dryness" },
  { key: "sensitive", label: "ผิวแพ้ง่าย แดง ระคายเคือง", extra: "sensitive" },
] as const satisfies readonly { key: string; label: string; metric?: MetricKey; extra?: ExtraKey }[];
export type ConcernKey = (typeof CONCERNS)[number]["key"];
export const MAX_CONCERNS = 3;

export type ScanAnswers = {
  ageRange?: AgeRangeKey;
  skinTypes?: SkinTypeKey[];
  concerns?: ConcernKey[];
};

export function concernLabel(key: string) {
  return CONCERNS.find((c) => c.key === key)?.label ?? null;
}

/**
 * Reads the estimated skin age against the age range the person gave, in
 * words rather than as a verdict. A range, not an exact age, so this is
 * never more precise than what they told us.
 */
export function ageComparison(skinAge: number, ageRange?: AgeRangeKey): string | null {
  const range = AGE_RANGES.find((r) => r.key === ageRange);
  if (!range || !skinAge) return null;
  const yours = `ช่วงอายุของคุณ (${range.label} ปี)`;
  if (skinAge < range.min) return `ผิวดูอ่อนกว่า${yours}`;
  if (skinAge > range.max) return skinAge - range.max <= 5 ? `ผิวดูมากกว่า${yours}เล็กน้อย` : `ผิวดูมากกว่า${yours}`;
  return `ผิวดูสมวัย อยู่ใน${yours}`;
}

/**
 * A metric as a level in plain Thai, not a number to two digits. The model's
 * scores are rough estimates from a photo; "ดี" says what it can honestly
 * say, where "73/100" implies a precision it doesn't have.
 */
export function clarityLevel(score: number): { label: string; pips: 1 | 2 | 3 | 4; tone: "good" | "fair" | "care" } {
  const clarity = Math.max(0, Math.min(100, 100 - score));
  if (clarity >= 85) return { label: "ดีมาก", pips: 4, tone: "good" };
  if (clarity >= 70) return { label: "ดี", pips: 3, tone: "good" };
  if (clarity >= 50) return { label: "ปานกลาง", pips: 2, tone: "fair" };
  return { label: "ควรดูแลเพิ่ม", pips: 1, tone: "care" };
}

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

// Reward tier is inverse to the score: skin that could use more care gets a
// bigger nudge to shop, healthy scores still get a smaller thank-you for
// completing the scan. Kept in a narrow 5-15% band so it stays a reasonable
// marketing perk rather than an exploitable giveaway. Shared by the results
// view (to preview the tier) and the claim-reward API (source of truth).
export const SKIN_COACH_POINTS_REWARD = 50;

export function discountForScore(score: number): { percentage: number; label: string } {
  const clamped = Math.max(0, Math.min(100, score));
  if (clamped >= 85) return { percentage: 0.05, label: "5%" };
  if (clamped >= 70) return { percentage: 0.08, label: "8%" };
  if (clamped >= 50) return { percentage: 0.12, label: "12%" };
  return { percentage: 0.15, label: "15%" };
}

// ── Phase 2: coming back ───────────────────────────────────────────────────
// A small thank-you for the fuller scan, not a points farm: only when a
// member saves a scan with at least three angles, and at most once per
// rescan cycle. Enforced server-side in /api/skin-coach/history.
export const SCAN_BONUS_POINTS = 10;
export const SCAN_BONUS_MIN_ANGLES = 3;
export const SCAN_BONUS_EVERY_DAYS = 28;

// When a saved scan earns a "time to check again" nudge.
export const RESCAN_AFTER_DAYS = 42;
