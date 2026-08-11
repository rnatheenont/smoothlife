import { Product } from "@/data/types";
import { products } from "@/data/products";

// The catalogue's "wellness" category mixes real dietary supplements with a
// lot of skincare (Smooth E, Smooth Life etc. are tagged wellness too), so
// filtering by category alone would recommend serums in a supplement plan.
// Brand allowlist is the pragmatic stand-in for a proper subcategory/
// concern_tags metafield, same simplification used for Oral Care Advisor.
const SUPPLEMENT_BRANDS = [
  "Blackmores",
  "Swisse",
  "Vistra",
  "Mega We Care",
  "Mega",
  "Centrum",
  "Berocca",
  "Probac7",
  "Nola",
  "I-Kids",
  "Mamarine",
  "Interpharma",
  "Klean&Kare",
  "Imumate",
  "Hemomin",
  "Lactis",
  "Albupro",
  "Glucolin",
];

export type SupplementGoal = "ผิวสวย" | "ผมแข็งแรง" | "ภูมิคุ้มกัน" | "ระบบขับถ่าย" | "นอนหลับ" | "พลังงาน" | "ข้อกระดูก";

const GOAL_KEYWORDS: Record<SupplementGoal, RegExp> = {
  ผิวสวย: /collagen|วิตามินซี|vitamin c|skin/i,
  ผมแข็งแรง: /hair|biotin|ผม/i,
  ภูมิคุ้มกัน: /immu|zinc|ซิงค์|ภูมิ/i,
  ระบบขับถ่าย: /probiotic|fiber|digest|โพรไบโอติก|ใยอาหาร/i,
  นอนหลับ: /sleep|melatonin|นอนหลับ/i,
  พลังงาน: /energy|b-complex|วิตามินบี|พลังงาน/i,
  ข้อกระดูก: /joint|bone|calcium|glucosamine|กระดูก|ข้อ/i,
};

// This label must trigger a hard stop, never a filtered product list — the
// catalogue has no not_suitable_for/pregnancy metafield to safely exclude
// specific SKUs, so the responsible move is to recommend nothing at all
// rather than guess.
export const PREGNANT_OR_BREASTFEEDING = "กำลังตั้งครรภ์/ให้นมบุตร";

function score(p: Product, goal: string): number {
  let s = 0;
  const pattern = GOAL_KEYWORDS[goal as SupplementGoal];
  if (pattern && (pattern.test(p.name) || pattern.test(p.shortDesc))) s += 3;
  if (p.badges?.includes("Bestseller")) s += 2;
  if (p.badges?.includes("Sale")) s += 1;
  return s;
}

export function recommendSupplementPlan(answers: {
  goal: string;
  status: string;
  budget: string;
}): { items: Product[]; blocked: boolean } {
  if (answers.status === PREGNANT_OR_BREASTFEEDING) {
    return { items: [], blocked: true };
  }

  const pool = products.filter((p) => SUPPLEMENT_BRANDS.includes(p.brand) && p.inStock);
  const ranked = [...pool].sort((a, b) => score(b, answers.goal) - score(a, answers.goal));

  const budgetCap =
    answers.budget === "< 500 บาท"
      ? 500
      : answers.budget === "500-1,000 บาท"
      ? 1000
      : answers.budget === "1,000-2,000 บาท"
      ? 2000
      : Infinity;

  const withinBudget = ranked.filter((p) => p.price <= budgetCap);
  const items = (withinBudget.length > 0 ? withinBudget : ranked).slice(0, 3);
  return { items, blocked: false };
}
