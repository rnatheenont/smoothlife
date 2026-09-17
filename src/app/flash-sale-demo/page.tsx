import { getProductBySlug } from "@/data/products";
import FlashSaleDemo, { type DemoProduct } from "@/components/flash-sale-demo/FlashSaleDemo";

// Demo product: a real Smooth E item from the catalogue, so the page looks
// like the shop; the sale around it (25 pieces, queue, payment) is invented.
const FALLBACK: DemoProduct = {
  name: "Smooth E Gold Miracle Capsule",
  brand: "Smooth E",
  image: "https://cdn.shopify.com/s/files/1/0663/8334/7863/files/69dff856cea2631c4625a19a44903caf.webp?v=1755249015&width=700",
  price: 528,
  compareAtPrice: 670,
};

export default function FlashSaleDemoPage() {
  const p = getProductBySlug("smooth-e-gold-miracle-capsule");
  const product: DemoProduct = p
    ? { name: p.name, brand: p.brand, image: p.image, price: p.price, compareAtPrice: p.compareAtPrice }
    : FALLBACK;
  return <FlashSaleDemo product={product} />;
}
