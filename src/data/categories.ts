import { CategoryInfo, Concern, ConcernInfo } from "./types";

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
