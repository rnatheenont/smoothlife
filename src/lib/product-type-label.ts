// What to call each kind of skincare product on a card.
//
// Split out of lib/skin-recommend.ts, which picks the products and therefore
// reads the catalogue — the two components that print these labels do not
// need to.

export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  cleanser: "ล้างหน้า",
  makeup_remover: "คลีนซิ่ง",
  toner: "โทนเนอร์",
  exfoliant: "ผลัดเซลล์",
  serum: "เซรั่ม",
  moisturizer: "ครีมบำรุง",
  sunscreen: "กันแดด",
  spot_treatment: "แต้มเฉพาะจุด",
  mask: "มาส์ก",
  eye_care: "รอบดวงตา",
  set: "เซ็ต",
};
