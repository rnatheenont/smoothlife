import { CategoryInfo, Concern, ConcernInfo } from "./types";
import { products } from "./products";

export const categories: CategoryInfo[] = [
  {
    slug: "skincare",
    name: "Skincare",
    nameTh: "สกินแคร์",
    image: "/categories/skincare-acne5.jpg",
  },
  {
    slug: "oral-care",
    name: "Oral Care",
    nameTh: "ดูแลช่องปาก",
    image: "/categories/oral-care-dentiste.jpg",
  },
  {
    slug: "hair-care",
    name: "Hair Care",
    nameTh: "ดูแลเส้นผม",
    image: "/categories/hair-care-smoothe.jpg",
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
    image:
      "https://www.smoothlife.com/cdn/shop/collections/dcb36a4c1ed80a8f262719e7b24d0023_e8ec4344-5233-49e6-aa98-177ffa0a05b7.jpg?v=1760415029&width=800",
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
// a concern to shoppers use the photo of a real, in-stock product instead.
//
// Picking it well matters more than it looks. The first version took the
// product with the most badges, and badges pile up on bundles — which also
// carry every concern of every item inside them. One hair-thickening gift set
// won both "สิวและผิวแพ้ง่าย" and "ผิวแห้งและเกราะผิว", so two tiles showed the
// same shampoo under two skin problems it has nothing to do with.
//
// So: single products over sets, the most specific product for the concern
// (fewest other concerns), then the best seller — real units sold, from the
// build. Each image is used once across all tiles, so no two concerns can
// ever show the same picture.
const isBundle = (p: (typeof products)[number]) =>
  Boolean(p.badges?.includes("Bundle")) || /\b(set|pack)\b|เซต|เซ็ต|\(pack/i.test(p.name);

// Which categories a concern can honestly apply to — mirrors the build-time
// rule in scripts/fetch-products.js, applied again here so tiles are right
// even before the next catalogue build re-tags everything.
export const CONCERN_CATEGORIES: Record<Concern, string[]> = {
  acne: ["skincare", "body-care", "wellness"],
  dryness: ["skincare", "body-care", "wellness"],
  "dark-spots": ["skincare", "body-care", "wellness"],
  aging: ["skincare", "body-care", "wellness"],
  "hair-scalp": ["hair-care", "wellness"],
  "sleep-stress": ["wellness", "personal-care"],
};

let assigned: Map<Concern, string> | null = null;

function assignConcernImages(): Map<Concern, string> {
  const used = new Set<string>();
  const out = new Map<Concern, string>();
  for (const c of concerns) {
    const pick = products
      .filter(
        (p) =>
          p.inStock &&
          p.image &&
          p.concerns.includes(c.slug) &&
          CONCERN_CATEGORIES[c.slug]?.includes(p.category) &&
          !used.has(p.image)
      )
      .sort(
        (a, b) =>
          Number(isBundle(a)) - Number(isBundle(b)) ||
          a.concerns.length - b.concerns.length ||
          (b.sold ?? 0) - (a.sold ?? 0) ||
          (b.badges?.length ?? 0) - (a.badges?.length ?? 0)
      )[0];
    if (pick) {
      used.add(pick.image);
      out.set(c.slug, pick.image);
    }
  }
  return out;
}

export function concernImage(slug: Concern): string {
  if (!assigned) assigned = assignConcernImages();
  return assigned.get(slug) || concerns.find((c) => c.slug === slug)?.image || "";
}
