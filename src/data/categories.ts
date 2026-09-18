import { CategoryInfo, Concern, ConcernInfo } from "./types";

// The shelves a shopper picks from, in the order they appear on /shop.
// Specific shelves (เวชสำอาง, อุปกรณ์สุขภาพ, แม่และเด็ก) were split out of
// skincare — without them a knee brace, a baby wash and a blood-pressure
// monitor all sat under face care, which is where the keyword fallback put
// anything it could not place.
export const categories: CategoryInfo[] = [
  {
    slug: "skincare",
    name: "Skincare",
    nameTh: "สกินแคร์",
    image: "/categories/skincare.png",
  },
  {
    slug: "hair-care",
    name: "Hair Care",
    nameTh: "ดูแลเส้นผม",
    image: "/categories/hair-care.png",
  },
  {
    slug: "oral-care",
    name: "Oral Care",
    nameTh: "ดูแลช่องปาก",
    image: "/categories/oral-care.png",
  },
  {
    slug: "body-care",
    name: "Body Care",
    nameTh: "ดูแลผิวกาย",
    image: "/categories/body-care.png",
  },
  {
    slug: "wellness",
    name: "Wellness & Supplements",
    nameTh: "วิตามินและอาหารเสริม",
    image: "/categories/wellness.png",
  },
  {
    slug: "womens-health",
    name: "Women's Health",
    nameTh: "สุขภาพผู้หญิง",
    image: "/categories/womens-health.png",
  },
  {
    slug: "dermo-cosmetics",
    name: "Dermo-cosmetics",
    nameTh: "เวชสำอาง",
    image: "/categories/dermo-cosmetics.png",
  },
  {
    slug: "health-devices",
    name: "Health Devices",
    nameTh: "อุปกรณ์สุขภาพ",
    image: "/categories/health-devices.png",
  },
  {
    slug: "mother-baby",
    name: "Mother & Baby",
    nameTh: "สินค้าแม่และเด็ก",
    image: "/categories/mother-baby.png",
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
