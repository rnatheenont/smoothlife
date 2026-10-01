// Importer-only. Thai and English for the Shopify taxonomy fields the shop has actually
// filled in, so the CSV export can be turned into spec tables nobody has to
// retype.
//
// Both sides are written out rather than derived from the handle. "vitamin-e"
// title-cased is "Vitamin E" only by luck; "uva-uvb-protection" becomes
// "Uva Uvb Protection", and "spf-protection" loses the capital letters that
// make SPF a word. The Thai side cannot be derived at all.
//
// A value missing from here is not guessed at — the importer leaves that row
// out and the admin adds it by hand. Measured against the export: 318 distinct
// values across the 24 columns, and the entries below cover the great majority
// of where they appear.

/** Values whose reading depends on the column they sit in.
 *
 *  Shopify's taxonomy reuses one handle across metafields — "dry" is the same
 *  value under "Suitable for skin type" and under "Suitable for hair type" — so
 *  a flat table has to pick one meaning, and SPEC_VALUES picked skin. That is
 *  how "เหมาะกับสภาพผม: ผิวแห้ง" (dry *skin* under a *hair* heading) reached
 *  live product pages.
 *
 *  `null` means the value has no honest reading under that column and is
 *  dropped, the same as a value this file does not list at all.
 *
 *  Keyed by the CSV column name, spelled as SPEC_LABELS spells it.
 */
export const SPEC_VALUES_BY_LABEL = {
  "Suitable for hair type": {
    dry: { th: "ผมแห้ง", en: "Dry hair" },
    oily: { th: "ผมมัน", en: "Oily hair" },
    sensitive: { th: "หนังศีรษะบอบบาง", en: "Sensitive scalp" },
    "sensitive-skin": { th: "หนังศีรษะบอบบาง", en: "Sensitive scalp" },
  },
  "Product certifications & standards": {
    // A skin type is not a certification. Every product the shop filed one on
    // already lists it under "Suitable for skin type", so dropping it here
    // loses nothing and stops the column from reading as a claim.
    sensitive: null,
    "sensitive-skin": null,
  },
};

/** The Shopify metafield's own name, as the CSV column header spells it. */
export const SPEC_LABELS = {
  "Active ingredient": { th: "สารออกฤทธิ์", en: "Active ingredient" },
  "Age group": { th: "ช่วงอายุ", en: "Age group" },
  "Closure type": { th: "ลักษณะฝา", en: "Closure type" },
  Color: { th: "สี", en: "Colour" },
  "Constitutive ingredients": { th: "ส่วนประกอบหลัก", en: "Key ingredients" },
  "Cosmetic function": { th: "หน้าที่ของผลิตภัณฑ์", en: "Cosmetic function" },
  "Detailed ingredients": {
    th: "ส่วนผสมโดยละเอียด",
    en: "Detailed ingredients",
  },
  "Dietary preferences": { th: "ข้อจำกัดด้านอาหาร", en: "Dietary preferences" },
  "Dispenser type": { th: "ลักษณะหัวจ่าย", en: "Dispenser type" },
  Flavor: { th: "กลิ่นและรส", en: "Flavour" },
  "Fragrance level": { th: "ระดับน้ำหอม", en: "Fragrance level" },
  "Ingredient category": { th: "ประเภทส่วนผสม", en: "Ingredient category" },
  Material: { th: "วัสดุ", en: "Material" },
  "Package type": { th: "รูปแบบบรรจุภัณฑ์", en: "Package type" },
  "Product certifications & standards": {
    th: "มาตรฐานและการรับรอง",
    en: "Certifications & standards",
  },
  "Product form": { th: "รูปแบบผลิตภัณฑ์", en: "Product form" },
  "Skin care effect": { th: "ผลลัพธ์ต่อผิว", en: "Skin care effect" },
  "Skin care features": { th: "คุณสมบัติดูแลผิว", en: "Skin care features" },
  "Suitable for hair type": {
    th: "เหมาะกับสภาพผม",
    en: "Suitable for hair type",
  },
  "Suitable for skin type": {
    th: "เหมาะกับสภาพผิว",
    en: "Suitable for skin type",
  },
  "Support/Brace material": { th: "วัสดุอุปกรณ์พยุง", en: "Support material" },
  "Target gender": { th: "เหมาะสำหรับ", en: "Target gender" },
  "Toothpaste type": { th: "ประเภทยาสีฟัน", en: "Toothpaste type" },
  "Usage type": { th: "ลักษณะการใช้งาน", en: "Usage type" },
};

/** Shopify's value handles. Cosmetic wording on purpose — "ช่วยให้ดูกระจ่างใส"
 *  rather than "ทำให้ขาว", because these are cosmetics under Thai law and a
 *  spec table is as public as a headline. */
export const SPEC_VALUES = {
  // who it is for
  adults: { th: "ผู้ใหญ่", en: "Adults" },
  "all-ages": { th: "ทุกวัย", en: "All ages" },
  kids: { th: "เด็ก", en: "Kids" },
  babies: { th: "ทารก", en: "Babies" },
  teens: { th: "วัยรุ่น", en: "Teens" },
  seniors: { th: "ผู้สูงอายุ", en: "Seniors" },
  unisex: { th: "ทุกเพศ", en: "Unisex" },
  female: { th: "ผู้หญิง", en: "Women" },
  male: { th: "ผู้ชาย", en: "Men" },

  // skin and hair types
  "all-skin-types": { th: "ทุกสภาพผิว", en: "All skin types" },
  sensitive: { th: "ผิวบอบบางแพ้ง่าย", en: "Sensitive" },
  "sensitive-skin": { th: "ผิวบอบบางแพ้ง่าย", en: "Sensitive skin" },
  dry: { th: "ผิวแห้ง", en: "Dry" },
  oily: { th: "ผิวมัน", en: "Oily" },
  combination: { th: "ผิวผสม", en: "Combination" },
  normal: { th: "ผิวธรรมดา", en: "Normal" },
  problem: { th: "ผิวมีปัญหา", en: "Problem skin" },
  mature: { th: "ผิวสูงวัย", en: "Mature" },
  "all-hair-types": { th: "ผมทุกสภาพ", en: "All hair types" },
  damaged: { th: "ผมเสีย", en: "Damaged" },
  "color-treated": { th: "ผมทำสี", en: "Colour-treated" },

  // what it does
  moisturizing: { th: "ให้ความชุ่มชื้น", en: "Moisturising" },
  hydrating: { th: "เติมน้ำให้ผิว", en: "Hydrating" },
  soothing: { th: "ช่วยปลอบประโลมผิว", en: "Soothing" },
  brightening: { th: "ช่วยให้ผิวดูกระจ่างใส", en: "Brightening" },
  whitening: { th: "ช่วยให้ดูกระจ่างใสขึ้น", en: "Brightening" },
  "anti-aging": { th: "ดูแลผิวตามวัย", en: "Anti-ageing" },
  "anti-wrinkle": { th: "ดูแลริ้วรอย", en: "Anti-wrinkle" },
  firming: { th: "ช่วยให้ผิวดูกระชับ", en: "Firming" },
  smoothing: { th: "ช่วยให้ผิวดูเรียบเนียน", en: "Smoothing" },
  nourishing: { th: "บำรุงผิว", en: "Nourishing" },
  repairing: { th: "ช่วยฟื้นบำรุงผิว", en: "Repairing" },
  regenerating: { th: "ช่วยผลัดเซลล์ผิว", en: "Regenerating" },
  revitalizing: { th: "ช่วยคืนความสดใสให้ผิว", en: "Revitalising" },
  cleansing: { th: "ทำความสะอาด", en: "Cleansing" },
  protection: { th: "ปกป้องผิว", en: "Protection" },
  "anti-dark-spot": { th: "ดูแลจุดด่างดำ", en: "Dark-spot care" },
  "anti-acne": { th: "ดูแลผิวเป็นสิว", en: "Acne-prone skin care" },
  "oil-control": { th: "ควบคุมความมัน", en: "Oil control" },
  exfoliating: { th: "ผลัดเซลล์ผิว", en: "Exfoliating" },
  "spf-protection": { th: "มีค่า SPF ป้องกันแดด", en: "SPF protection" },
  "uva-uvb-protection": { th: "ปกป้องรังสี UVA/UVB", en: "UVA/UVB protection" },
  "anti-decay": { th: "ช่วยลดฟันผุ", en: "Cavity care" },
  antiplaque: { th: "ช่วยลดคราบพลัค", en: "Anti-plaque" },
  "breath-freshening": { th: "ช่วยให้ลมหายใจสดชื่น", en: "Breath freshening" },
  "long-lasting": { th: "ติดทนนาน", en: "Long-lasting" },
  "non-greasy": { th: "ไม่เหนียวเหนอะหนะ", en: "Non-greasy" },
  "easy-to-apply": { th: "ทาง่าย เกลี่ยง่าย", en: "Easy to apply" },
  "quick-absorbing": { th: "ซึมไว", en: "Quick-absorbing" },

  // ingredients
  "vitamin-a": { th: "วิตามินเอ", en: "Vitamin A" },
  "vitamin-b": { th: "วิตามินบี", en: "Vitamin B" },
  "vitamin-c": { th: "วิตามินซี", en: "Vitamin C" },
  "vitamin-d": { th: "วิตามินดี", en: "Vitamin D" },
  "vitamin-e": { th: "วิตามินอี", en: "Vitamin E" },
  vitamins: { th: "วิตามินรวม", en: "Vitamins" },
  "hyaluronic-acid": { th: "ไฮยาลูรอนิกแอซิด", en: "Hyaluronic acid" },
  collagen: { th: "คอลลาเจน", en: "Collagen" },
  retinol: { th: "เรตินอล", en: "Retinol" },
  niacinamide: { th: "ไนอาซินาไมด์", en: "Niacinamide" },
  ceramide: { th: "เซราไมด์", en: "Ceramide" },
  "aloe-vera": { th: "ว่านหางจระเข้", en: "Aloe vera" },
  "shea-butter": { th: "เชียบัตเตอร์", en: "Shea butter" },
  "cocoa-butter": { th: "โกโก้บัตเตอร์", en: "Cocoa butter" },
  "jojoba-oil": { th: "น้ำมันโจโจบา", en: "Jojoba oil" },
  "argan-oil": { th: "น้ำมันอาร์แกน", en: "Argan oil" },
  "coconut-oil": { th: "น้ำมันมะพร้าว", en: "Coconut oil" },
  glycerin: { th: "กลีเซอรีน", en: "Glycerin" },
  chamomile: { th: "คาโมมายล์", en: "Chamomile" },
  "green-tea": { th: "ชาเขียว", en: "Green tea" },
  zinc: { th: "สังกะสี", en: "Zinc" },
  calcium: { th: "แคลเซียม", en: "Calcium" },
  iron: { th: "ธาตุเหล็ก", en: "Iron" },
  "omega-fatty-acids": { th: "โอเมก้า", en: "Omega fatty acids" },
  probiotics: { th: "โพรไบโอติก", en: "Probiotics" },
  "salicylic-acid": { th: "ซาลิไซลิกแอซิด", en: "Salicylic acid" },
  "natural-ingredients": {
    th: "ส่วนผสมจากธรรมชาติ",
    en: "Natural ingredients",
  },
  "all-natural-ingredients": {
    th: "ส่วนผสมจากธรรมชาติทั้งหมด",
    en: "All-natural ingredients",
  },
  water: { th: "น้ำ", en: "Water" },
  oil: { th: "น้ำมัน", en: "Oil" },

  // free-from and certifications
  "paraben-free": { th: "ไม่มีพาราเบน", en: "Paraben-free" },
  "sulfate-free": { th: "ไม่มีซัลเฟต", en: "Sulfate-free" },
  "alcohol-free": { th: "ไม่มีแอลกอฮอล์", en: "Alcohol-free" },
  "fragrance-free": { th: "ไม่แต่งกลิ่น", en: "Fragrance-free" },
  "phthalate-free": { th: "ไม่มีพทาเลท", en: "Phthalate-free" },
  "sugar-free": { th: "ไม่มีน้ำตาล", en: "Sugar-free" },
  "gluten-free": { th: "ไม่มีกลูเตน", en: "Gluten-free" },
  "no-artificial-colors": {
    th: "ไม่ใส่สีสังเคราะห์",
    en: "No artificial colours",
  },
  hypoallergenic: { th: "ลดโอกาสการแพ้", en: "Hypoallergenic" },
  "dermatologist-tested": {
    th: "ผ่านการทดสอบโดยแพทย์ผิวหนัง",
    en: "Dermatologist-tested",
  },
  "cruelty-free": { th: "ไม่ทดลองกับสัตว์", en: "Cruelty-free" },
  vegan: { th: "วีแกน", en: "Vegan" },
  organic: { th: "ออร์แกนิก", en: "Organic" },
  halal: { th: "ฮาลาล", en: "Halal" },
  "non-comedogenic": { th: "ไม่อุดตันรูขุมขน", en: "Non-comedogenic" },

  // form and packaging
  serum: { th: "เซรั่ม", en: "Serum" },
  cream: { th: "ครีม", en: "Cream" },
  lotion: { th: "โลชั่น", en: "Lotion" },
  gel: { th: "เจล", en: "Gel" },
  foam: { th: "โฟม", en: "Foam" },
  liquid: { th: "ของเหลว", en: "Liquid" },
  powder: { th: "ผง", en: "Powder" },
  tablet: { th: "เม็ด", en: "Tablet" },
  capsule: { th: "แคปซูล", en: "Capsule" },
  spray: { th: "สเปรย์", en: "Spray" },
  balm: { th: "บาล์ม", en: "Balm" },
  stick: { th: "แบบแท่ง", en: "Stick" },
  wipes: { th: "แผ่นเช็ด", en: "Wipes" },
  mask: { th: "มาส์ก", en: "Mask" },
  bottle: { th: "ขวด", en: "Bottle" },
  "plastic-bottle": { th: "ขวดพลาสติก", en: "Plastic bottle" },
  "pump-bottle": { th: "ขวดปั๊ม", en: "Pump bottle" },
  tube: { th: "หลอด", en: "Tube" },
  jar: { th: "กระปุก", en: "Jar" },
  sachet: { th: "ซอง", en: "Sachet" },
  box: { th: "กล่อง", en: "Box" },
  disposable: { th: "ใช้แล้วทิ้ง", en: "Disposable" },
  reusable: { th: "ใช้ซ้ำได้", en: "Reusable" },

  // materials and colours
  plastic: { th: "พลาสติก", en: "Plastic" },
  glass: { th: "แก้ว", en: "Glass" },
  cotton: { th: "ผ้าฝ้าย", en: "Cotton" },
  silicone: { th: "ซิลิโคน", en: "Silicone" },
  nylon: { th: "ไนลอน", en: "Nylon" },
  white: { th: "ขาว", en: "White" },
  black: { th: "ดำ", en: "Black" },
  blue: { th: "น้ำเงิน", en: "Blue" },
  green: { th: "เขียว", en: "Green" },
  pink: { th: "ชมพู", en: "Pink" },
  red: { th: "แดง", en: "Red" },
  yellow: { th: "เหลือง", en: "Yellow" },
  orange: { th: "ส้ม", en: "Orange" },
  purple: { th: "ม่วง", en: "Purple" },
  clear: { th: "ใส", en: "Clear" },

  // flavour and scent
  unflavored: { th: "ไม่แต่งกลิ่นรส", en: "Unflavoured" },
  mint: { th: "มินต์", en: "Mint" },
  spearmint: { th: "สเปียร์มินต์", en: "Spearmint" },
  citrus: { th: "ซิตรัส", en: "Citrus" },
  orange_flavor: { th: "ส้ม", en: "Orange" },
  strawberry: { th: "สตรอว์เบอร์รี", en: "Strawberry" },
  unscented: { th: "ไม่มีกลิ่น", en: "Unscented" },
  light: { th: "กลิ่นอ่อน", en: "Light" },
  strong: { th: "กลิ่นเข้ม", en: "Strong" },

  // usage
  "daily-use": { th: "ใช้ได้ทุกวัน", en: "Daily use" },
  "leave-in": { th: "ไม่ต้องล้างออก", en: "Leave-in" },
  "rinse-off": { th: "ล้างออก", en: "Rinse-off" },
  topical: { th: "ใช้ภายนอก", en: "Topical" },
  oral: { th: "รับประทาน", en: "Oral" },
  "single-use": { th: "ใช้ครั้งเดียว", en: "Single use" },

  // added after a first pass over the export showed these turning up often
  // enough to be worth writing out rather than dropping
  "sunflower-seed-oil": { th: "น้ำมันเมล็ดทานตะวัน", en: "Sunflower seed oil" },
  "vitamin-b6": { th: "วิตามินบี 6", en: "Vitamin B6" },
  "vitamin-b12": { th: "วิตามินบี 12", en: "Vitamin B12" },
  selenium: { th: "ซีลีเนียม", en: "Selenium" },
  magnesium: { th: "แมกนีเซียม", en: "Magnesium" },
  beeswax: { th: "ไขผึ้ง", en: "Beeswax" },
  "titanium-dioxide": { th: "ไทเทเนียมไดออกไซด์", en: "Titanium dioxide" },
  protecting: { th: "ปกป้องผิว", en: "Protecting" },
  plumping: { th: "ช่วยให้ผิวดูอิ่มฟู", en: "Plumping" },
  illuminating: { th: "ช่วยให้ผิวดูมีประกาย", en: "Illuminating" },
  healing: { th: "ช่วยปลอบประโลมผิว", en: "Soothing" },
  "silicone-free": { th: "ไม่มีซิลิโคน", en: "Silicone-free" },
  "oil-free": { th: "ไม่มีน้ำมัน", en: "Oil-free" },
  "non-gmo": { th: "ไม่ดัดแปรพันธุกรรม", en: "Non-GMO" },
  "no-preservatives": { th: "ไม่ใส่สารกันเสีย", en: "No preservatives" },
  // "fda-approved" is deliberately absent. It is Shopify's taxonomy value and
  // means the US FDA; it was being rendered in Thai as "มี อย.", which states
  // Thai FDA registration — a different regulator, and a regulated claim here.
  // The US FDA does not approve cosmetics at all, so there is no honest reading
  // to translate. An unmapped value is skipped by the importer (see
  // import-product-specs.mjs:124), which is the wanted behaviour: say nothing
  // rather than say the wrong regulator. Add it back only with a real source
  // and a wording the team has checked.
  solid: { th: "แบบแข็ง", en: "Solid" },
  fine: { th: "เนื้อละเอียด", en: "Fine" },
  rubber: { th: "ยาง", en: "Rubber" },
  metal: { th: "โลหะ", en: "Metal" },
  paper: { th: "กระดาษ", en: "Paper" },
  beige: { th: "เบจ", en: "Beige" },
  brown: { th: "น้ำตาล", en: "Brown" },
  grey: { th: "เทา", en: "Grey" },
  gray: { th: "เทา", en: "Grey" },
  "adjustable-straps": { th: "สายปรับได้", en: "Adjustable straps" },
  breathable: { th: "ระบายอากาศ", en: "Breathable" },
  waterproof: { th: "กันน้ำ", en: "Waterproof" },
  lightweight: { th: "น้ำหนักเบา", en: "Lightweight" },
};

/** The spec columns worth importing, in the order they should read on a page:
 *  who it suits, then what it is, then what it is made of, then the packet. */
export const SPEC_COLUMN_ORDER = [
  "Target gender",
  "Age group",
  "Suitable for skin type",
  "Suitable for hair type",
  "Product form",
  "Cosmetic function",
  "Skin care effect",
  "Skin care features",
  "Toothpaste type",
  "Usage type",
  "Active ingredient",
  "Constitutive ingredients",
  "Detailed ingredients",
  "Ingredient category",
  "Dietary preferences",
  "Product certifications & standards",
  "Flavor",
  "Fragrance level",
  "Color",
  "Material",
  "Support/Brace material",
  "Package type",
  "Dispenser type",
  "Closure type",
];
