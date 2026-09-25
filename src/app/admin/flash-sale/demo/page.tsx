import Link from "next/link";
import { products, getProductBySlug } from "@/data/products";
import FlashSaleDemo from "@/components/flash-sale-demo/FlashSaleDemo";
import { ArrowLeft } from "lucide-react";
import "../heroui-demo.css";
import type { CampaignConfig } from "@/components/flash-sale-demo/campaign";
import { saleCatalogue, saleGroups } from "@/lib/flash-sale-catalogue";

// The flash-sale walk-through: a clickable model of the queue, behind the
// admin password. The products are the real catalogue so a sale can be set up
// on any of them; the sale itself is simulated.
//
// It has its own page because it is not the campaigns. Sharing a screen with
// the live list is how a simulated sale's numbers ended up being read as a
// real campaign's — "จบแล้ว · ขายหมด" on a campaign that had sold nothing.

const DEFAULT_SLUG = "smooth-e-gold-miracle-capsule";

// Rendered per request: the demo clock starts at the moment the page is opened.
export const dynamic = "force-dynamic";

export default function FlashSaleSimulatorPage() {
  const catalogue = saleCatalogue();
  const groups = saleGroups(catalogue);

  const p = getProductBySlug(DEFAULT_SLUG) ?? products.find((x) => x.inStock);
  const initialConfig: CampaignConfig = {
    mode: "single",
    title: `Flash Sale · ${p?.name ?? "สินค้า"}`,
    products: p
      ? [
          {
            slug: p.slug,
            name: p.name,
            brand: p.brand,
            image: p.image,
            price: p.price,
            compareAtPrice: p.compareAtPrice,
          },
        ]
      : [],
    stockPerProduct: 25,
    windowMinutes: 15,
    maxRequeue: 3,
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          href="/admin/flash-sale"
          className="inline-flex items-center gap-1.5 rounded-full border border-surface-line px-3 py-1.5 text-[12px] font-semibold text-brand-ink hover:bg-surface-soft"
        >
          <ArrowLeft size={13} aria-hidden /> แคมเปญทั้งหมด
        </Link>
      </div>
      {/* eslint-disable-next-line react-hooks/purity -- render time seeds the demo clock; the page is rendered per request */}
      <FlashSaleDemo embedded baseMs={Date.now()} initialConfig={initialConfig} catalogue={catalogue} groups={groups} />
    </div>
  );
}
