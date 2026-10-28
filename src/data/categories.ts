import { Category, CategoryInfo, Concern, ConcernInfo } from "./types";

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
    // No curated shot yet — categoryImage() takes the best-reviewed thing in
    // it instead, which is at least always something the category sells.
    slug: "personal-care",
    name: "Personal Care",
    nameTh: "ดูแลส่วนบุคคล",
    image: "",
  },
  {
    slug: "wellness",
    name: "Wellness & Supplements",
    nameTh: "วิตามินและอาหารเสริม",
    // Was a screenshot of the Smooth Life wordmark with its background
    // rubbed out — a logo where every other tile in the row has a product.
    image: "",
  },
  {
    slug: "body-care",
    name: "Body Care",
    nameTh: "ดูแลผิวกาย",
    image: "",
  },
];

export const concerns: ConcernInfo[] = [
  {
    slug: "acne",
    name: "Acne & Sensitive Skin",
    nameTh: "สิวและผิวแพ้ง่าย",
    description: "ลดการอักเสบ ควบคุมความมัน และปลอบประโลมผิวที่ระคายเคืองง่าย",
    image: "/concerns/acne.jpg",
  },
  {
    slug: "dryness",
    name: "Dryness & Skin Barrier",
    nameTh: "ผิวแห้งและเกราะผิว",
    description: "ฟื้นฟูเกราะปกป้องผิวและเติมความชุ่มชื้นระยะยาว",
    image: "/concerns/dryness.jpg",
  },
  {
    slug: "dark-spots",
    name: "Dark Spots & Brightening",
    nameTh: "จุดด่างดำและผิวกระจ่างใส",
    description: "ลดเลือนจุดด่างดำ ปรับผิวให้กระจ่างใสสม่ำเสมอ",
    image: "/concerns/dark-spots.jpg",
  },
  {
    slug: "aging",
    name: "Aging & Firmness",
    nameTh: "ริ้วรอยและความกระชับ",
    description: "ลดเลือนริ้วรอยแห่งวัย เพิ่มความยืดหยุ่นและกระชับ",
    image: "/concerns/aging.jpg",
  },
  {
    slug: "hair-scalp",
    name: "Hair & Scalp",
    nameTh: "เส้นผมและหนังศีรษะ",
    description: "บำรุงหนังศีรษะ ลดผมร่วง เสริมความหนาแน่นของเส้นผม",
    image: "/concerns/hair-scalp.jpg",
  },
  {
    slug: "sleep-stress",
    name: "Sleep & Relaxation",
    nameTh: "การนอนหลับและผ่อนคลาย",
    description: "ช่วยให้หลับสบาย ผ่อนคลายความเครียดจากการใช้ชีวิตประจำวัน",
    image: "/concerns/sleep-stress.jpg",
  },
];

// The tile for a concern shows a person with that concern, not a bottle.
//
// It used to show a photo of a real product tagged with the concern, picked
// by an elaborate rule — single products over sets, fewest other concerns,
// best seller — because bundles carry every concern of every item inside
// them and kept winning tiles they had nothing to do with. But the rule was
// solving the wrong problem: a packshot answers "what do you sell", and this
// row asks "what is bothering you". Someone scanning it is looking for their
// own face.
//
// So each concern owns one photograph, and that is the whole lookup.
export function concernImage(slug: Concern): string {
  return concerns.find((c) => c.slug === slug)?.image || "";
}

/**
 * The same concern photo at three widths, for the browser to choose between.
 *
 * These are files in /public, not Shopify URLs, so nothing resizes them on
 * request — the variants are generated next to the original and listed here.
 * Squares at every width, like the original, so `object-cover` crops exactly
 * the same way whichever one the browser takes and the picture never shifts.
 *
 * The 800px original stays: it is the hero on /concern/[slug] and the social
 * share image, and both want the pixels. What it was not is six tiles on the
 * home page at 2.4 MB of decoded image each.
 */
export function concernImageSrcSet(slug: Concern): string | undefined {
  const base = concernImage(slug);
  if (!base.endsWith(".jpg")) return undefined;
  const stem = base.slice(0, -4);
  return `${stem}-400.jpg 400w, ${stem}-560.jpg 560w, ${base} 800w`;
}
