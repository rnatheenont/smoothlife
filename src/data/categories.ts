import { CategoryInfo, Concern, ConcernInfo } from "./types";
import { products } from "./products";

export const categories: CategoryInfo[] = [
  {
    slug: "skincare",
    name: "Skincare",
    nameTh: "สกินแคร์",
    image: "https://www.smoothlife.com/cdn/shop/collections/Skincare-02.jpg?width=800",
  },
  {
    slug: "oral-care",
    name: "Oral Care",
    nameTh: "ดูแลช่องปาก",
    image: "https://www.smoothlife.com/cdn/shop/files/1set_den_002.jpg?width=800",
  },
  {
    slug: "hair-care",
    name: "Hair Care",
    nameTh: "ดูแลเส้นผม",
    image: "https://www.smoothlife.com/cdn/shop/files/SMEHAIRMEN-03.jpg?width=800",
  },
  {
    slug: "personal-care",
    name: "Personal Care",
    nameTh: "ดูแลส่วนบุคคล",
    image: "https://www.smoothlife.com/cdn/shop/files/03020321.jpg?width=800",
  },
  {
    slug: "wellness",
    name: "Wellness & Supplements",
    nameTh: "วิตามินและอาหารเสริม",
    image: "https://www.smoothlife.com/cdn/shop/collections/Screenshot_2025-09-25_095352-removebg-preview_1.png?width=800",
  },
  {
    slug: "body-care",
    name: "Body Care",
    nameTh: "ดูแลผิวกาย",
    image: "https://www.smoothlife.com/cdn/shop/files/th-11134207-7r992-lxgbv5tesvxs25.webp?width=800",
  },
];

export const concerns: ConcernInfo[] = [
  {
    slug: "acne",
    name: "Acne & Sensitive Skin",
    nameTh: "สิวและผิวแพ้ง่าย",
    description: "ลดการอักเสบ ควบคุมความมัน และปลอบประโลมผิวที่ระคายเคืองง่าย",
    image: "https://www.smoothlife.com/cdn/shop/files/th-11134201-7rasi-m8e9zf33lucu07.webp?width=600",
  },
  {
    slug: "dryness",
    name: "Dryness & Skin Barrier",
    nameTh: "ผิวแห้งและเกราะผิว",
    description: "ฟื้นฟูเกราะปกป้องผิวและเติมความชุ่มชื้นระยะยาว",
    image: "https://www.smoothlife.com/cdn/shop/files/th-11134207-7r992-lxgbv5tesvxs25.webp?width=600",
  },
  {
    slug: "dark-spots",
    name: "Dark Spots & Brightening",
    nameTh: "จุดด่างดำและผิวกระจ่างใส",
    description: "ลดเลือนจุดด่างดำ ปรับผิวให้กระจ่างใสสม่ำเสมอ",
    image: "https://www.smoothlife.com/cdn/shop/files/SME_VIT_C_New-02_1fd98218-6baf-4643-9ad2-530c390ee11a.jpg?width=600",
  },
  {
    slug: "aging",
    name: "Aging & Firmness",
    nameTh: "ริ้วรอยและความกระชับ",
    description: "ลดเลือนริ้วรอยแห่งวัย เพิ่มความยืดหยุ่นและกระชับ",
    image: "https://www.smoothlife.com/cdn/shop/files/SME_24K_Glow_Booster-02_871051fa-6241-4f0a-be7f-fa8e28cbc3c6.jpg?width=600",
  },
  {
    slug: "hair-scalp",
    name: "Hair & Scalp",
    nameTh: "เส้นผมและหนังศีรษะ",
    description: "บำรุงหนังศีรษะ ลดผมร่วง เสริมความหนาแน่นของเส้นผม",
    image: "https://www.smoothlife.com/cdn/shop/files/SMEHAIRMEN-03.jpg?width=600",
  },
  {
    slug: "sleep-stress",
    name: "Sleep & Relaxation",
    nameTh: "การนอนหลับและผ่อนคลาย",
    description: "ช่วยให้หลับสบาย ผ่อนคลายความเครียดจากการใช้ชีวิตประจำวัน",
    image: "https://www.smoothlife.com/cdn/shop/files/sg-11134201-7rfi5-m9fjgzvwm8knb0.jpg?width=600",
  },
];

// The static `image` above is a marketing banner (campaign creative, not
// always tied to what's actually sold under that concern). Pages that show
// a concern to shoppers should call this instead — it picks the real photo
// of an in-stock product under that concern (preferring ones the store is
// already merchandising with a badge), so the picture always matches real,
// current catalogue data rather than a hand-picked graphic that can drift
// out of sync. (This sync carries no review/rating data — every product
// comes through as rating 0 / reviewCount 0 — so badge count is the real
// signal available, not popularity.)
export function concernImage(slug: Concern): string {
  const best = [...products]
    .filter((p) => p.inStock && p.concerns.includes(slug))
    .sort((a, b) => (b.badges?.length ?? 0) - (a.badges?.length ?? 0))[0];
  return best?.image || concerns.find((c) => c.slug === slug)?.image || "";
}
