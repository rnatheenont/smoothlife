import type { OrderStage } from "@/lib/order-status";

// One invented account, shared by the demo list and the demo order pages.
// Nothing here is read from or written to the database.
export const DEMO = {
  name: "สมหญิง ใจดี",
  tier: "Silver",
  points: 1_250,
  spend: 4_200,
  nextAt: 10_000,
  memberSince: "12 มีนาคม 2569",
  address: {
    name: "สมหญิง ใจดี · 081-234-5678",
    lines: ["88/12 ซอยสุขุมวิท 31 แขวงคลองตันเหนือ", "เขตวัฒนา กรุงเทพฯ 10110"],
  },
};

export type DemoLine = { slug: string; qty: number };

export type DemoOrder = {
  id: string;
  date: string;
  stage: OrderStage;
  lines: DemoLine[];
  shipping: number;
  discount?: { code: string; amount: number };
  note?: string;
  courier?: { name: string; number: string };
  /** Which tracking step the parcel has reached, when there is one. */
  reached?: "packing" | "shipped" | "out" | "delivered";
  paidWith?: string;
  refund?: number;
  cancelReason?: string;
};

export const DEMO_ORDERS: DemoOrder[] = [
  {
    id: "SL-2069-0481",
    date: "16 ก.ย. 2569",
    stage: "to_pay",
    lines: [{ slug: "smooth-e-babyface-foam", qty: 1 }],
    shipping: 0,
    note: "ชำระภายใน 24 ชม. มิฉะนั้นระบบจะยกเลิกอัตโนมัติ",
  },
  {
    id: "SL-2069-0477",
    date: "14 ก.ย. 2569",
    stage: "to_ship",
    lines: [
      { slug: "smooth-e-acne-5-pore-clear-whitening-toner", qty: 1 },
      { slug: "dentiste-anticavity-max-fluoride-toothpaste", qty: 2 },
    ],
    shipping: 0,
    discount: { code: "SL100", amount: 100 },
    paidWith: "บัตรเครดิต ลงท้าย 4242",
    reached: "packing",
  },
  {
    id: "SL-2069-0463",
    date: "9 ก.ย. 2569",
    stage: "to_receive",
    lines: [{ slug: "cerave-moisturising-lotion-3-oz", qty: 1 }],
    shipping: 0,
    paidWith: "พร้อมเพย์ QR",
    courier: { name: "Kerry Express", number: "TH88421234567" },
    reached: "out",
  },
  {
    id: "SL-2069-0444",
    date: "28 ส.ค. 2569",
    stage: "completed",
    lines: [{ slug: "blackmores-marine-collagen-absolute-30-cap", qty: 1 }],
    shipping: 0,
    paidWith: "บัตรเครดิต ลงท้าย 4242",
    courier: { name: "Flash Express", number: "TH01994455667" },
    reached: "delivered",
    note: "ส่งถึงแล้ว 31 ส.ค. 2569 · ให้คะแนนรับ 30 แต้ม",
  },
  {
    id: "SL-2069-0431",
    date: "20 ส.ค. 2569",
    stage: "refunded",
    lines: [{ slug: "aromase-anti-hair-loss-essential-shampoo-400-ml-1", qty: 1 }],
    shipping: 0,
    paidWith: "บัตรเครดิต ลงท้าย 4242",
    refund: 630,
    note: "ได้รับสินค้าไม่ตรงรุ่น · คืนเงินเข้าบัตรเดิมภายใน 7 วันทำการ",
  },
  {
    id: "SL-2069-0420",
    date: "11 ส.ค. 2569",
    stage: "cancelled",
    lines: [{ slug: "smooth-e-cream-plus-white", qty: 1 }],
    shipping: 0,
    cancelReason: "ลูกค้ายกเลิกเอง ก่อนร้านจัดส่ง",
  },
];

export const STAGE_BADGE: Record<OrderStage, string> = {
  to_pay: "bg-amber-100 text-amber-700",
  to_ship: "bg-amber-100 text-amber-700",
  to_receive: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  refunded: "bg-slate-100 text-slate-600",
  cancelled: "bg-slate-100 text-slate-600",
};
