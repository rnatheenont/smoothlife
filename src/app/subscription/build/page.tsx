import { redirect } from "next/navigation";
import { products } from "@/data/products";
import { subscriptionPlans } from "@/data/subscriptions";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { twoC2PConfigured } from "@/lib/2c2p";
import BundleBuilder from "@/components/BundleBuilder";

export const metadata = { title: "จัดชุดสินค้าเอง | Smoothlife.com" };

// Same intersect-and-filter shape as subscriptionProducts in
// data/subscriptions.ts, just keyed off the bundle_eligible flag instead of
// category — a product opts into the bundle pool the same way it opts out
// of `subscribable` today (product_subscription_settings, added for v3).
async function getBundleEligibleProducts() {
  if (!supabaseConfigured()) return [];
  try {
    const rows = await supabaseRest<{ product_slug: string }[]>(
      "product_subscription_settings?bundle_eligible=eq.true&select=product_slug"
    );
    const eligibleSlugs = new Set(rows.map((r) => r.product_slug));
    return products.filter((p) => p.inStock && eligibleSlugs.has(p.slug));
  } catch {
    return [];
  }
}

export default async function BundleBuilderPage() {
  // The discount-code fallback can't apply an arbitrary bundle % (no real
  // Shopify discount code exists for it) — this entry point simply doesn't
  // exist until real 2C2P billing is configured.
  if (!twoC2PConfigured()) redirect("/subscription");

  const eligibleProducts = await getBundleEligibleProducts();

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">จัดชุดสินค้าเอง</h1>
      <p className="text-sm text-slate-500 mb-6">
        เลือกสินค้าที่ใช้ประจำมาจัดเป็นชุดของตัวเอง แล้วสมัครสมาชิกรับส่วนลดชุดพิเศษซ้อนทับกับส่วนลดตามรอบที่เลือก
      </p>
      <BundleBuilder products={eligibleProducts} plans={subscriptionPlans} />
    </div>
  );
}
