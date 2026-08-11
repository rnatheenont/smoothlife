import { Product } from "@/data/types";
import { products } from "@/data/products";

export type OralConcern = "กลิ่นปาก" | "เสียวฟัน" | "ฟันเหลือง" | "เหงือกอักเสบ" | "ฟันผุบ่อย";
export type OralSetType = "ครบเซ็ต" | "เฉพาะยาสีฟัน" | "ประหยัดสุด";

type OralProductType = "toothpaste" | "toothbrush" | "floss" | "mouthwash" | "other";

const TYPE_PATTERNS: [OralProductType, RegExp][] = [
  ["toothpaste", /toothpaste|ยาสีฟัน/i],
  ["toothbrush", /toothbrush|แปรงสีฟัน/i],
  ["floss", /floss|ไหมขัดฟัน/i],
  ["mouthwash", /mouth ?spray|mouthwash|oral rinse|น้ำยาบ้วนปาก/i],
];

function detectType(p: Product): OralProductType {
  for (const [type, pattern] of TYPE_PATTERNS) {
    if (pattern.test(p.name)) return type;
  }
  return "other";
}

// Light keyword boost per concern — a stand-in for the concern_tags metafield
// the full spec calls for; the catalogue isn't tagged that way yet, so this
// scores on product name/description text instead of hard-filtering on it.
const CONCERN_KEYWORDS: Record<OralConcern, RegExp> = {
  กลิ่นปาก: /fresh|breath/i,
  เสียวฟัน: /sensitive/i,
  ฟันเหลือง: /white|whitening/i,
  เหงือกอักเสบ: /gum/i,
  ฟันผุบ่อย: /cavity|fluoride/i,
};

function score(p: Product, concerns: string[]): number {
  let s = 0;
  if (p.badges?.includes("Bestseller")) s += 3;
  if (p.badges?.includes("Sale")) s += 1;
  s += p.rating * (p.reviewCount > 0 ? 1 : 0);
  for (const c of concerns) {
    const pattern = CONCERN_KEYWORDS[c as OralConcern];
    if (pattern && (pattern.test(p.name) || pattern.test(p.shortDesc))) s += 2;
  }
  return s;
}

export function recommendOralCareSet(answers: {
  concerns: string[];
  using: string[];
  setType: string;
}): Product[] {
  const pool = products.filter((p) => p.category === "oral-care" && p.inStock);
  if (pool.length === 0) return [];

  const ranked = [...pool].sort((a, b) => score(b, answers.concerns) - score(a, answers.concerns));

  if (answers.setType === "เฉพาะยาสีฟัน") {
    return ranked.filter((p) => detectType(p) === "toothpaste").slice(0, 4);
  }

  if (answers.setType === "ประหยัดสุด") {
    const byType = new Map<OralProductType, Product>();
    for (const p of [...ranked].sort((a, b) => a.price - b.price)) {
      const type = detectType(p);
      if (type !== "other" && !byType.has(type)) byType.set(type, p);
      if (byType.size === 4) break;
    }
    return [...byType.values()];
  }

  // "ครบเซ็ต" (default): one best-scoring pick per product type, up to 4.
  const byType = new Map<OralProductType, Product>();
  for (const p of ranked) {
    const type = detectType(p);
    if (type !== "other" && !byType.has(type)) byType.set(type, p);
    if (byType.size === 4) break;
  }
  // Fill up to 4 items if fewer than 4 types were found in stock.
  const picked = [...byType.values()];
  for (const p of ranked) {
    if (picked.length >= 4) break;
    if (!picked.includes(p)) picked.push(p);
  }
  return picked.slice(0, 4);
}
