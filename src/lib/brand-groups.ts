import type { Product } from "@/data/types";

// What kind of thing a product is, read off its own name.
//
// A brand hub with a hundred items in one grid is a wall, not a shop: the
// shopper who arrived searching "ยาสีฟัน Dentiste" wants the toothpaste, not
// the electric brushes and the floss in between. Shopify gives us a vendor
// and a category but no product type we can trust across 65 brands, so the
// grouping is read from the product name — which is what the merchant
// actually writes, and what the shopper reads on the card.
//
// Order is the whole logic: the first pattern that matches wins, so the more
// specific kind has to come before the one that would swallow it. Naming the
// thing beats naming the deal, so "[Buy 1 Get 1] ... Nighttime Toothpaste
// Free! Toothbrush" is filed under toothpaste — someone shopping for
// toothpaste should find it — and only a bundle that never says what is in
// it ("Dentiste Duo White Set") falls through to the sets section.
export type BrandGroup = { key: string; label: string; test: RegExp };

const BUNDLE = /\bset\b|เซ็ต|เซต|\bkit\b|\bduo\b|free|ฟรี|แถม|special|edition/i;

export const BRAND_GROUPS: BrandGroup[] = [
  { key: "kids", label: "สำหรับเด็ก", test: /\bkids?\b|เด็ก/i },
  { key: "toothpaste", label: "ยาสีฟัน", test: /toothpaste|ยาสีฟัน|tooth serum|ทูธ ?ซีรั่ม/i },
  { key: "toothbrush", label: "แปรงสีฟัน", test: /toothbrush|แปรงสีฟัน|brush head|sonic/i },
  { key: "mouthwash", label: "น้ำยาบ้วนปาก", test: /mouthwash|oral rinse|บ้วนปาก|rinse|oil pulling/i },
  { key: "spray", label: "สเปรย์ระงับกลิ่นปาก", test: /spray|สเปรย์/i },
  { key: "floss", label: "ไหมขัดฟันและอุปกรณ์", test: /floss|ไหมขัดฟัน|pick|mirror|plaque test/i },
  { key: "tongue", label: "ทำความสะอาดลิ้น", test: /tongue|ลิ้น/i },
  { key: "mint", label: "เม็ดอมและลมหายใจสดชื่น", test: /sukkiri|mint|เม็ดอม|ลูกอม|breath/i },
  { key: "set", label: "เซ็ตและของขวัญ", test: BUNDLE },
  { key: "cleanser", label: "ทำความสะอาดผิวหน้า", test: /cleanser|cleansing|โฟมล้างหน้า|ล้างหน้า|makeup remover/i },
  { key: "serum", label: "เซรั่มและทรีทเมนต์", test: /serum|เซรั่ม|ampoule|essence/i },
  { key: "sunscreen", label: "กันแดด", test: /sunscreen|sun ?block|กันแดด|\bspf\b/i },
  { key: "moisturizer", label: "บำรุงผิวหน้า", test: /cream|ครีม|moisturi[sz]er|lotion|โลชั่น|gel|เจล/i },
  { key: "hair", label: "ดูแลเส้นผม", test: /shampoo|แชมพู|conditioner|ครีมนวด|hair|เส้นผม/i },
  { key: "body", label: "ดูแลผิวกาย", test: /body|soap|สบู่|ผิวกาย|deodorant|โรลออน/i },
  {
    key: "supplement",
    label: "วิตามินและอาหารเสริม",
    test: /vitamin|วิตามิน|supplement|อาหารเสริม|collagen|คอลลาเจน|capsule|tablet/i,
  },
];

export type GroupedProducts = { key: string; label: string; items: Product[] };

/**
 * Splits a brand's catalogue into the sections its hub page shows.
 *
 * Anything that matches nothing, and any group too small to be worth its own
 * heading, is folded into a single trailing group — a section of two items
 * reads as an accident, and eight one-item sections read as a mess.
 */
export function groupBrandProducts(items: Product[], minPerGroup = 3): GroupedProducts[] {
  const buckets = new Map<string, Product[]>();
  const rest: Product[] = [];

  for (const product of items) {
    const group = BRAND_GROUPS.find((g) => g.test.test(product.name));
    if (!group) {
      rest.push(product);
      continue;
    }
    const bucket = buckets.get(group.key);
    if (bucket) bucket.push(product);
    else buckets.set(group.key, [product]);
  }

  const groups: GroupedProducts[] = [];
  for (const g of BRAND_GROUPS) {
    const bucket = buckets.get(g.key);
    if (!bucket) continue;
    if (bucket.length < minPerGroup) rest.push(...bucket);
    else groups.push({ key: g.key, label: g.label, items: bucket });
  }
  if (rest.length > 0) groups.push({ key: "other", label: "สินค้าอื่น ๆ", items: rest });
  return groups;
}
