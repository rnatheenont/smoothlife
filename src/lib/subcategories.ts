// What kind of thing a product is, inside its category.
//
// The six categories are too coarse to navigate: skincare alone is 307
// products, and "show me a sunscreen" means paging through serums, cleansers
// and night creams to find one. Shopify has nothing to answer this with —
// `productType` is empty on all 998 products, and the tags that do exist
// describe benefits and ingredients, unreliably (a face serum tagged
// "น้ำมันปลา", a lip balm tagged "ช่วยให้นอนหลับ").
//
// So it is guessed here from the words the product is sold under, and a
// person confirms the guess. This file is only the guess. It imports nothing
// and touches nothing, so the rules can be unit-tested — which matters,
// because a rule that quietly swallows the wrong products is worse than no
// rule: the shopper is told a shelf exists and then shown the wrong shelf.

export type Subcategory = {
  slug: string;
  nameTh: string;
  /** Matched against the product's name and short description, in order. */
  match: RegExp;
};

/**
 * Rules per category, most specific first.
 *
 * Order carries meaning. "เซรั่มบำรุงหนังศีรษะ" is a scalp serum, not a face
 * serum, so hair-care tests its scalp rule before anything else; "ครีมกันแดด"
 * is a sunscreen, not a moisturiser, so sunscreen comes before cream. Each
 * list reads top to bottom and the first hit wins.
 */
export const SUBCATEGORIES: Record<string, Subcategory[]> = {
  skincare: [
    { slug: "lip-care", nameTh: "บำรุงริมฝีปาก", match: /\blip\b|blistex|ริมฝีปาก|ลิปบาล์ม|ลิปมัน/i },
    { slug: "sunscreen", nameTh: "กันแดด", match: /sunscreen|sun\s?(screen|stick|fluid|milk)|spf\s?\d|\bspf\b|\bpa\+|กันแดด|ป้องกันแสงแดด/i },
    { slug: "cleanser", nameTh: "ทำความสะอาดผิวหน้า", match: /cleans|foam|\bwash\b|micellar|makeup remover|cleansing (gel|water|oil|balm)|โฟม|ล้างหน้า|ไมเซล|เช็ดเครื่องสำอาง|คลีนซิ่ง/i },
    { slug: "serum", nameTh: "เซรั่มและเอสเซนส์", match: /serum|ampoule|essence|booster|concentrate|เซรั่ม|เอสเซนส์|แอมพูล/i },
    { slug: "mask", nameTh: "มาส์กและแผ่นแปะสิว", match: /\bmask\b|sheet mask|acne patch|spot patch|มาส์ก|แผ่นแปะ|แปะสิว/i },
    { slug: "eye-care", nameTh: "บำรุงรอบดวงตา", match: /eye (cream|serum|repair|contour|gel)|รอบดวงตา|รอบตา|ใต้ตา/i },
    { slug: "toner", nameTh: "โทนเนอร์", match: /toner|lotion tonique|micro.?water|โทนเนอร์/i },
    { slug: "acne-care", nameTh: "ดูแลสิว", match: /acne|spot gel|blemish|\bสิว\b|จุดด่างดำจากสิว/i },
    { slug: "moisturiser", nameTh: "ครีมและมอยส์เจอไรเซอร์", match: /cream|moistur|emulsion|\bgel\b|\bfluid\b|ครีม|มอยส์เจอ|บำรุงผิวหน้า/i },
  ],
  "oral-care": [
    { slug: "toothpaste", nameTh: "ยาสีฟัน", match: /toothpaste|tooth paste|ยาสีฟัน/i },
    { slug: "toothbrush", nameTh: "แปรงสีฟัน", match: /toothbrush|tooth brush|แปรงสีฟัน|หัวแปรง/i },
    { slug: "mouthwash", nameTh: "น้ำยาบ้วนปาก", match: /mouth\s?wash|mouth\s?rinse|น้ำยาบ้วนปาก|บ้วนปาก/i },
    { slug: "breath-spray", nameTh: "สเปรย์ระงับกลิ่นปาก", match: /breath spray|mouth spray|สเปรย์(ปาก|ระงับกลิ่นปาก|ช่องปาก)/i },
    { slug: "floss", nameTh: "ไหมขัดฟันและแปรงซอกฟัน", match: /floss|interdental|ไหมขัดฟัน|ซอกฟัน|แปรงซอก/i },
    { slug: "denture", nameTh: "ดูแลฟันปลอมและจัดฟัน", match: /denture|retainer|ฟันปลอม|จัดฟัน|รีเทนเนอร์/i },
  ],
  "hair-care": [
    { slug: "hair-tool", nameTh: "หวีและอุปกรณ์", match: /\bbrush\b|\bcomb\b|detangl|superbrush|หวี|แปรงผม/i },
    { slug: "scalp-care", nameTh: "บำรุงหนังศีรษะและลดผมร่วง", match: /scalp|tonic|hair (serum|spray|essence)|anti.?hair.?loss|หนังศีรษะ|ลดผมร่วง|เซรั่มผม|โทนิค/i },
    { slug: "shampoo", nameTh: "แชมพู", match: /shampoo|แชมพู/i },
    { slug: "conditioner", nameTh: "ครีมนวดและทรีตเมนต์", match: /conditioner|treatment|hair mask|ครีมนวด|ทรีตเมนต์|บำรุงเส้นผม/i },
    { slug: "styling", nameTh: "จัดแต่งทรงผมและเปลี่ยนสี", match: /styling|\bwax\b|hair (colou?r|dye)|ย้อมผม|เปลี่ยนสีผม|จัดแต่งทรง/i },
  ],
  "body-care": [
    { slug: "deodorant", nameTh: "ระงับกลิ่นกาย", match: /deodor|antiperspir|roll.?on|ระงับกลิ่นกาย|โรลออน/i },
    { slug: "body-wash", nameTh: "สบู่และครีมอาบน้ำ", match: /shower|body wash|bath|\bsoap\b|cleansing bar|สบู่|ครีมอาบน้ำ|เจลอาบน้ำ/i },
    { slug: "scrub", nameTh: "สครับและผลัดเซลล์ผิว", match: /scrub|exfoliat|peeling|สครับ|ผลัดเซลล์|ขัดผิว/i },
    { slug: "hand-foot", nameTh: "มือ เท้า และเล็บ", match: /hand (cream|lotion|wash|sanitiz)|foot (cream|care)|\bnail\b|ครีมทามือ|ดูแลเท้า|เล็บ/i },
    { slug: "body-lotion", nameTh: "โลชั่นและครีมบำรุงผิวกาย", match: /body (lotion|cream|milk|butter|oil|serum)|lotion|โลชั่น|บำรุงผิวกาย|ทาผิว/i },
  ],
  wellness: [
    { slug: "collagen", nameTh: "คอลลาเจน", match: /collagen|คอลลาเจน/i },
    { slug: "fish-oil", nameTh: "น้ำมันปลาและโอเมก้า", match: /fish oil|omega|\bdha\b|\bepa\b|krill|น้ำมันปลา|โอเมก้า/i },
    { slug: "probiotic", nameTh: "โพรไบโอติกและดูแลลำไส้", match: /probio|prebio|lactobacill|\bgos\b|โพรไบ|พรีไบ|จุลินทรีย์|ลำไส้/i },
    { slug: "herbal", nameTh: "สมุนไพร", match: /herbal?\b|turmeric|ginger|ginkgo|ขมิ้น|ฟ้าทะลาย|สมุนไพร|กระชาย|ใบแปะก๊วย/i },
    { slug: "beauty-supplement", nameTh: "อาหารเสริมผิวและผม", match: /glutathione|\bgluta\b|biotin|placenta|astaxanthin|กลูต้า|ไบโอติน|บำรุงผิว|ผิวกระจ่างใส/i },
    { slug: "vitamin", nameTh: "วิตามินและเกลือแร่", match: /vitamin|\bvit[\s.]|multivit|\bbio\s?c\b|acerola|calcium|\bzinc\b|\biron\b|magnesium|วิตามิน|แคลเซียม|ซิงค์|ธาตุเหล็ก|เกลือแร่/i },
  ],
  "personal-care": [
    { slug: "support-brace", nameTh: "อุปกรณ์พยุงและบรรเทาปวด", match: /futuro|vantelin|support(er)?\b|\bbrace\b|\bknee\b|\bwrist\b|\bankle\b|elbow|แวนเทลิน|ผ้าพยุง|ประคบ|บรรเทาปวด/i },
    { slug: "condom", nameTh: "ถุงยางอนามัย", match: /durex|condom|latex|ดูเร็กซ์|ถุงยาง/i },
    { slug: "wipes", nameTh: "ทิชชู่เปียกและสำลี", match: /wet wipes?|wipes?\b|cotton (pad|ball|bud)|tissue|ทิชชู่|สำลี|ผ้าเปียก/i },
    { slug: "lip-balm", nameTh: "ลิปบาล์มและดูแลริมฝีปาก", match: /lip (balm|care|stick|mask)|\bbalm\b|ลิปบาล์ม|ริมฝีปาก/i },
    { slug: "feminine", nameTh: "ผลิตภัณฑ์สำหรับผู้หญิง", match: /feminine|intimate|sanitary|tampon|จุดซ่อนเร้น|ผ้าอนามัย|อนามัยสตรี/i },
    { slug: "eye-drops", nameTh: "ดูแลดวงตา", match: /eye drop|opti.?free|contact lens|น้ำตาเทียม|ออพติ|คอนแทคเลนส์/i },
    { slug: "first-aid", nameTh: "ปฐมพยาบาล", match: /plaster|bandage|antiseptic|wound|first aid|พลาสเตอร์|แผล|ปฐมพยาบาล|ฆ่าเชื้อ/i },
  ],
};

/** Everything the given category can be divided into. */
export function subcategoriesOf(category: string): Subcategory[] {
  return SUBCATEGORIES[category] ?? [];
}

/**
 * The best guess for one product, or null when no rule fits.
 *
 * Returning null is a real answer, not a failure — it is what sends the
 * product to a person instead of onto the wrong shelf.
 */
export function guessSubcategory(product: { name: string; shortDesc?: string; category: string }): string | null {
  const haystack = `${product.name} ${product.shortDesc ?? ""}`;
  for (const sub of subcategoriesOf(product.category)) {
    if (sub.match.test(haystack)) return sub.slug;
  }
  return null;
}

/** The Thai label for a slug, for admin tables and storefront chips. */
export function subcategoryLabel(category: string, slug: string): string | undefined {
  return subcategoriesOf(category).find((s) => s.slug === slug)?.nameTh;
}
