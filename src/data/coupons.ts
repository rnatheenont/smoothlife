import { Category } from "./types";

export type CouponType = "amount" | "percent" | "freeship";

export type Coupon = {
  code: string;
  titleTh: string;
  titleEn: string;
  descTh: string;
  descEn: string;
  type: CouponType;
  value: number;
  minSpend?: number;
  brand?: string;
  category?: Category;
  memberOnly?: boolean;
  tier?: "Silver" | "Gold";
  maxDiscount?: number;
  expires: string;
};

export const coupons: Coupon[] = [
  {
    code: "SL100",
    titleTh: "ลด 100 บาท",
    titleEn: "฿100 off",
    descTh: "เมื่อซื้อครบ 990 บาทขึ้นไป",
    descEn: "On orders of ฿990 or more",
    type: "amount",
    value: 100,
    minSpend: 990,
    expires: "31 ธ.ค. 2026",
  },
  {
    code: "WELCOME15",
    titleTh: "ลด 15% สำหรับสมาชิก",
    titleEn: "15% off for members",
    descTh: "เฉพาะสมาชิกที่เข้าสู่ระบบ ลดสูงสุด 300 บาท",
    descEn: "Signed-in members only, up to ฿300 off",
    type: "percent",
    value: 15,
    maxDiscount: 300,
    memberOnly: true,
    expires: "31 ธ.ค. 2026",
  },
  {
    code: "SMOOTHE20",
    titleTh: "ลด 20% สินค้า Smooth E",
    titleEn: "20% off Smooth E",
    descTh: "คำนวณจากยอดสินค้าแบรนด์ Smooth E ในตะกร้า",
    descEn: "Calculated on Smooth E items in your cart",
    type: "percent",
    value: 20,
    brand: "Smooth E",
    expires: "30 ก.ย. 2026",
  },
  {
    code: "VITA50",
    titleTh: "ลด 50 บาท วิตามินและอาหารเสริม",
    titleEn: "฿50 off vitamins & supplements",
    descTh: "เมื่อซื้อสินค้าหมวดวิตามินครบ 500 บาท",
    descEn: "On ฿500+ of vitamins & supplements",
    type: "amount",
    value: 50,
    category: "wellness",
    minSpend: 500,
    expires: "31 ต.ค. 2026",
  },
  {
    code: "GOLD10",
    titleTh: "ลด 10% สมาชิกระดับ Gold",
    titleEn: "10% off for Gold members",
    descTh: "สำหรับสมาชิกระดับ Gold เท่านั้น",
    descEn: "Gold tier members only",
    type: "percent",
    value: 10,
    tier: "Gold",
    memberOnly: true,
    expires: "31 ธ.ค. 2026",
  },
];

export type CartLine = {
  slug: string;
  qty: number;
  price: number;
  brand?: string;
  category?: Category;
};

export type CouponEval = {
  coupon: Coupon;
  eligible: boolean;
  discount: number;
  freeShipping: boolean;
  reasonTh: string;
  reasonEn: string;
};

const SHIPPING_FEE = 50;
// Real policy is free shipping on every order now (see FREE_SHIPPING_THRESHOLD
// in lib/use-order-totals.ts) — kept in sync here so a "freeship"-type coupon,
// if one's ever added back, reports "already ships free" correctly.
const FREE_SHIPPING_THRESHOLD = 0;

export function evaluateCoupon(
  coupon: Coupon,
  lines: CartLine[],
  opts: { signedIn: boolean; tier?: string }
): CouponEval {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const scoped = lines.filter((l) => {
    if (coupon.brand && l.brand !== coupon.brand) return false;
    if (coupon.category && l.category !== coupon.category) return false;
    return true;
  });
  const scopedTotal = scoped.reduce((s, l) => s + l.price * l.qty, 0);
  const base = coupon.brand || coupon.category ? scopedTotal : subtotal;

  const fail = (th: string, en: string): CouponEval => ({
    coupon,
    eligible: false,
    discount: 0,
    freeShipping: false,
    reasonTh: th,
    reasonEn: en,
  });

  if (coupon.memberOnly && !opts.signedIn) {
    return fail("ต้องเข้าสู่ระบบก่อนใช้คูปองนี้", "Sign in to use this coupon");
  }
  if (coupon.tier && opts.tier !== coupon.tier) {
    return fail(`เฉพาะสมาชิกระดับ ${coupon.tier}`, `${coupon.tier} tier members only`);
  }
  if (coupon.brand && scopedTotal <= 0) {
    return fail(`ต้องมีสินค้า ${coupon.brand} ในตะกร้า`, `Add ${coupon.brand} products to your cart`);
  }
  if (coupon.category && scopedTotal <= 0) {
    return fail("ต้องมีสินค้าในหมวดที่กำหนดในตะกร้า", "Add qualifying category items to your cart");
  }
  if (coupon.minSpend && base < coupon.minSpend) {
    const missing = coupon.minSpend - base;
    return fail(
      `ซื้อเพิ่มอีก ฿${missing.toLocaleString()} จึงจะใช้คูปองนี้ได้`,
      `Spend ฿${missing.toLocaleString()} more to unlock`
    );
  }

  if (coupon.type === "freeship") {
    const already = subtotal >= FREE_SHIPPING_THRESHOLD;
    return {
      coupon,
      eligible: true,
      discount: 0,
      freeShipping: true,
      reasonTh: already ? "คำสั่งซื้อนี้ส่งฟรีอยู่แล้ว" : `ประหยัดค่าส่ง ฿${SHIPPING_FEE}`,
      reasonEn: already ? "This order already ships free" : `Saves ฿${SHIPPING_FEE} shipping`,
    };
  }

  let discount = coupon.type === "percent" ? Math.floor((base * coupon.value) / 100) : coupon.value;
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  discount = Math.min(discount, subtotal);

  return {
    coupon,
    eligible: discount > 0,
    discount,
    freeShipping: false,
    reasonTh: `ประหยัด ฿${discount.toLocaleString()}`,
    reasonEn: `Saves ฿${discount.toLocaleString()}`,
  };
}

export function evaluateAll(lines: CartLine[], opts: { signedIn: boolean; tier?: string }) {
  return coupons
    .map((c) => evaluateCoupon(c, lines, opts))
    .sort((a, b) => {
      if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
      return b.discount - a.discount;
    });
}

export const POINTS_PER_BAHT = 1 / 100;

export function pointsForAmount(amount: number) {
  return Math.floor(amount * POINTS_PER_BAHT);
}

export const TIERS = [
  { name: "Bronze", min: 0 },
  { name: "Silver", min: 1000 },
  { name: "Gold", min: 3000 },
];

export function tierProgress(points: number) {
  const current = [...TIERS].reverse().find((t) => points >= t.min) || TIERS[0];
  const next = TIERS.find((t) => t.min > points);
  return {
    current: current.name,
    next: next ? next.name : null,
    remaining: next ? next.min - points : 0,
    percent: next ? Math.min(100, Math.round(((points - current.min) / (next.min - current.min)) * 100)) : 100,
  };
}
