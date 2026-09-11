import { Product } from "@/data/types";
import { products } from "@/data/products";

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

// ── The scan flow ──────────────────────────────────────────────────────────
// Front is the only required photo; every other angle is an optional extra,
// offered after the first shot with what it helps the scan see.
export const ANGLES = [
  { key: "front", label: "หน้าตรง", helps: "ภาพรวมทั้งใบหน้า" },
  { key: "cheek", label: "แก้ม", helps: "รูขุมขนและสิวชัดขึ้น" },
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

export const MAIN_CONCERNS: { key: ConcernSlug; label: string }[] = [
  { key: "acne", label: "สิวและรูขุมขน" },
  { key: "dark-spots", label: "จุดด่างดำ ผิวไม่สม่ำเสมอ" },
  { key: "aging", label: "ริ้วรอย" },
];

export type ScanAnswers = {
  ageRange?: AgeRangeKey;
  skinType?: SkinTypeKey;
  mainConcern?: ConcernSlug;
};

/**
 * Reads the estimated skin age against the age range the person gave, in
 * words rather than as a verdict. A range, not an exact age, so this is
 * never more precise than what they told us.
 */
export function ageComparison(skinAge: number, ageRange?: AgeRangeKey): string | null {
  const range = AGE_RANGES.find((r) => r.key === ageRange);
  if (!range || !skinAge) return null;
  if (skinAge < range.min) return `ผิวดูอ่อนกว่าช่วงอายุ ${range.label} ปีของคุณ`;
  if (skinAge > range.max) return `ผิวดูมากกว่าช่วงอายุ ${range.label} ปีของคุณเล็กน้อย`;
  return `ผิวดูสมวัย อยู่ในช่วงอายุ ${range.label} ปีของคุณ`;
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

// ── Matching products to what the scan saw ─────────────────────────────────
// The catalogue's concern tags come from loose keyword hits across titles and
// Shopify tags, good enough for browsing but not for "this is for what the
// scan found": a retinal wrinkle set was tagged dark-spots because "dark spot"
// appears in paragraph three. For recommendations each product is scored per
// metric from its name and short description (weighted) and its benefits and
// opening description (lightly), and only counts where that metric is what
// the product is mainly about.

export type MetricKey = "acne" | "pores" | "darkSpots" | "wrinkles";

const METRIC_WORDS: Record<MetricKey, string[]> = {
  acne: ["สิว", "acne", "blemish", "breakout", "salicylic", "tea tree", "anti-bacterial", "ลดการอักเสบ"],
  pores: ["รูขุมขน", "pore", "ควบคุมความมัน", "ผิวมัน", "oil control", "oil-control", "sebum", "exfoliat", "ผลัดเซลล์", "bha", "pha", "clay"],
  darkSpots: [
    "จุดด่างดำ", "ฝ้า", "รอยดำ", "หมองคล้ำ", "กระจ่างใส", "ผิวขาว", "dark spot", "melasma", "pigment",
    "brighten", "whitening", "even tone", "uneven", "arbutin", "tranexamic", "niacinamide", "vitamin c", "gluta",
  ],
  wrinkles: [
    "ริ้วรอย", "ชะลอวัย", "ยกกระชับ", "wrinkle", "fine line", "anti-aging", "anti aging", "retinol", "retinal",
    "peptide", "firming", "lifting", "collagen", "nad+", "ageless",
  ],
};

// Face-scan results call for face care. Hair, oral, intimate and body products
// can share a keyword ("whitening" toothpaste, "anti-hair-loss" serum) but
// never the problem.
const NOT_FACE_CARE = ["hair-care", "oral-care", "personal-care", "body-care"];
const NOT_FACE_WORDS = [
  "แชมพู", "shampoo", "ยาสีฟัน", "toothpaste", "body lotion", "โลชั่นทาผิวกาย", "ผมร่วง", "hair",
  // Supplements: the scan reads the skin's surface, so it recommends what goes on it.
  "soft capsules", "softgel", "tablet", "gummy", "อาหารเสริม", "ซอง)", "เม็ด",
];

// English keywords must start a word — "pha" is an exfoliant, "alpha" isn't.
// Thai has no spaces between words, so Thai keywords match anywhere.
const wordMatchers = new Map<string, (text: string) => boolean>();
function matcher(word: string) {
  let m = wordMatchers.get(word);
  if (!m) {
    if (/^[a-z0-9+ .-]+$/.test(word)) {
      const re = new RegExp(`(^|[^a-z])${word.replace(/[.+]/g, "\\$&")}`);
      m = (text) => re.test(text);
    } else {
      m = (text) => text.includes(word);
    }
    wordMatchers.set(word, m);
  }
  return m;
}

function hits(text: string, words: string[]) {
  return words.reduce((n, w) => n + (matcher(w)(text) ? 1 : 0), 0);
}

function metricScores(p: Product) {
  const primary = `${p.name} ${p.shortDesc}`.toLowerCase();
  const secondary = `${p.benefits.join(" ")} ${(p.description || "").slice(0, 400)}`.toLowerCase();
  const out = {} as Record<MetricKey, { primary: number; total: number }>;
  for (const key of Object.keys(METRIC_WORDS) as MetricKey[]) {
    const a = hits(primary, METRIC_WORDS[key]);
    out[key] = { primary: a, total: a * 3 + hits(secondary, METRIC_WORDS[key]) };
  }
  return out;
}

/**
 * Products for one scan metric, best match first. A product qualifies only
 * when its name or short description names this problem at least as often as
 * any other — so a wrinkle serum that mentions pores in passing stays with
 * wrinkles. Anything the member already bought is left out.
 */
export function recommendForMetric(metric: MetricKey, max = 3, alreadyBought?: ReadonlySet<string>): Product[] {
  const ranked: { p: Product; score: number }[] = [];
  for (const p of products) {
    if (!p.inStock || alreadyBought?.has(p.slug) || NOT_FACE_CARE.includes(p.category)) continue;
    if (hits(p.name.toLowerCase(), NOT_FACE_WORDS) > 0) continue;
    const scores = metricScores(p);
    const mine = scores[metric];
    if (mine.primary === 0) continue;
    const strongestOther = Math.max(
      ...(Object.keys(scores) as MetricKey[]).filter((k) => k !== metric).map((k) => scores[k].primary)
    );
    if (mine.primary < strongestOther) continue;
    const popularity = Math.min(3, Math.log10((p.sold ?? 0) + 1)) + (p.badges?.includes("Bestseller") ? 1 : 0);
    ranked.push({ p, score: mine.total * 2 + popularity });
  }
  ranked.sort((a, b) => b.score - a.score);
  // One product line once: a single and its two-pack are the same advice.
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const { p } of ranked) {
    const line = p.name.toLowerCase().replace(/\(.*?\)|pack\s*\d+|x\s*\d+|\d+\s*(ml|g|ชิ้น)\.?/g, "").replace(/\s+/g, " ").trim();
    if (seen.has(line)) continue;
    seen.add(line);
    out.push(p);
    if (out.length === max) break;
  }
  return out;
}

/** How many of a metric's usual picks were left out because they were bought before. */
export function boughtCountForMetric(metric: MetricKey, alreadyBought: ReadonlySet<string>, max = 3): number {
  return recommendForMetric(metric, max).filter((p) => alreadyBought.has(p.slug)).length;
}
