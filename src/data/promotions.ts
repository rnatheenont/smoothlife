import { Product } from "./types";

export type Promotion = {
  slug: string;
  title: string;
  subtitle: string;
  image: string;
  badge: string;
};

// Banner images used to be hand-picked marketing photos (some featured
// people/illustrated characters). Use a real product shot from the live
// catalogue instead — always product-only, and stays current automatically.
export function promotionImage(promo: Promotion, products: Product[]): string {
  const match = products.find((p) => p.badges?.some((b) => b === promo.badge) && p.image);
  return match?.image || products[0]?.image || promo.image;
}

export const promotions: Promotion[] = [
  {
    slug: "buy-1-get-1-free-deal",
    title: "Buy 1 Get 1 Free",
    subtitle: "ซื้อ 1 แถม 1 เฉพาะสินค้าคัดสรร",
    image: "https://www.smoothlife.com/cdn/shop/files/set_sme_824.png?width=700",
    badge: "BOGO",
  },
  {
    slug: "bundel-set-smoothlife",
    title: "Bundle Deal",
    subtitle: "รวมเซ็ตคุ้มค่า ประหยัดกว่าซื้อแยก",
    image: "https://www.smoothlife.com/cdn/shop/collections/2_76ba709d-a39c-437a-bbfa-6c6f0e6799f7.jpg?width=700",
    badge: "Bundle",
  },
  {
    slug: "clearance-sale",
    title: "Clearance Sale",
    subtitle: "ลดสูงสุด 70% สินค้าคัดสรรพิเศษ",
    image: "https://www.smoothlife.com/cdn/shop/files/SME_24K_Glow_Booster-02_871051fa-6241-4f0a-be7f-fa8e28cbc3c6.jpg?width=700",
    badge: "Sale",
  },
  {
    slug: "special-promotion",
    title: "Special Promotion",
    subtitle: "โปรโมชั่นพิเศษประจำเดือน",
    image: "https://www.smoothlife.com/cdn/shop/files/SmoothLifeVitaminCPackShot2.png?width=700",
    badge: "Promotion",
  },
];
