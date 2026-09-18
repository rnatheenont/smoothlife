// Each promo owns its banner.
//
// These used to be filled from the live catalogue — pick a product carrying
// the promo's badge, fall back to the deepest discount, and make sure no two
// cards drew the same product. It was a lot of machinery to answer a question
// the photography answers better: a packshot on white needed a near-opaque
// black scrim before the caption could be read on it, and four cards of
// muddied packshots is not a promotions row. These four are shot for the slot,
// with the caption's space left clear at the bottom.
export type Promotion = {
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  badge: string;
};

export const promotions: Promotion[] = [
  {
    slug: "buy-1-get-1-free-deal",
    title: "Buy 1 Get 1 Free",
    subtitle: "ซื้อ 1 แถม 1 เฉพาะสินค้าคัดสรร",
    image: "/promotions/buy-1-get-1-free-deal.jpg",
    badge: "BOGO",
  },
  {
    slug: "bundel-set-smoothlife",
    title: "Bundle Deal",
    subtitle: "รวมเซ็ตคุ้มค่า ประหยัดกว่าซื้อแยก",
    image: "/promotions/bundel-set-smoothlife.jpg",
    badge: "Bundle",
  },
  {
    slug: "clearance-sale",
    title: "Clearance Sale",
    subtitle: "ลดสูงสุด 70% สินค้าคัดสรรพิเศษ",
    image: "/promotions/clearance-sale.jpg",
    badge: "Sale",
  },
  {
    slug: "special-promotion",
    title: "Special Promotion",
    subtitle: "โปรโมชั่นพิเศษประจำเดือน",
    image: "/promotions/special-promotion.jpg",
    badge: "Promotion",
  },
];
