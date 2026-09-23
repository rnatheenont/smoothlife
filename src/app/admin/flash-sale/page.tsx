import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { products, getProductBySlug } from "@/data/products";
import { categories } from "@/data/categories";
import { brands, brandSlugAliases, slugifyVendor } from "@/data/brands";
import { collections } from "@/data/collections";
import FlashSaleDemo from "@/components/flash-sale-demo/FlashSaleDemo";
import CampaignList from "./CampaignList";
import "./heroui-demo.css";
import type { CampaignConfig } from "@/components/flash-sale-demo/campaign";
import type { CatalogueItem, ProductGroup } from "@/components/flash-sale-demo/CampaignSetup";

// Admin → Flash Sale: a clickable walk-through of the flash-sale queue plan,
// behind the admin password. The products are the real catalogue so a sale
// can be set up on any of them; the sale itself is simulated.

const DEFAULT_SLUG = "smooth-e-gold-miracle-capsule";

// Rendered per request: the demo clock starts at the moment the page is opened.
export const dynamic = "force-dynamic";

export default function FlashSaleDemoPage() {
  const catalogue: CatalogueItem[] = products
    .filter((p) => p.inStock && p.image)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      brandSlug: slugifyVendor(p.brand),
      category: p.category,
      image: p.image,
      price: p.price,
      compareAtPrice: p.compareAtPrice,
    }));
  const inCatalogue = new Set(catalogue.map((p) => p.slug));

  const groups: ProductGroup[] = [
    ...categories.map((c) => ({
      id: `category:${c.slug}`,
      kind: "category" as const,
      label: c.nameTh,
      slugs: catalogue.filter((p) => p.category === c.slug).map((p) => p.slug),
    })),
    ...brands.map((b) => {
      const aliases = brandSlugAliases(b);
      return {
        id: `brand:${b.slug}`,
        kind: "brand" as const,
        label: b.name,
        slugs: catalogue.filter((p) => aliases.includes(p.brandSlug)).map((p) => p.slug),
      };
    }),
    ...collections.map((c) => ({
      id: `collection:${c.handle}`,
      kind: "collection" as const,
      label: c.title,
      slugs: c.productSlugs.filter((s) => inCatalogue.has(s)),
    })),
  ].filter((g) => g.slugs.length >= 2);

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
      <div className="mb-4 flex justify-end">
        <Link
          href="/admin/flash-sale/create"
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          สร้างแคมเปญจริง <ArrowUpRight size={15} />
        </Link>
      </div>
      <div className="mb-8">
        <CampaignList />
      </div>
      {/* eslint-disable-next-line react-hooks/purity -- render time seeds the demo clock; the page is rendered per request */}
      <FlashSaleDemo embedded baseMs={Date.now()} initialConfig={initialConfig} catalogue={catalogue} groups={groups} />
    </div>
  );
}
