import { products, getProductBySlug } from "@/data/products";
import { categories } from "@/data/categories";
import { brands, brandSlugAliases, slugifyVendor } from "@/data/brands";
import { collections } from "@/data/collections";
import FlashSaleDemo from "@/components/flash-sale-demo/FlashSaleDemo";
import type { CampaignConfig } from "@/components/flash-sale-demo/campaign";
import type { CatalogueItem, ProductGroup } from "@/components/flash-sale-demo/CampaignSetup";

// Hidden page (no links to it, noindex, disallowed in robots.txt): a clickable
// walk-through of the flash-sale queue plan. The products are the real
// catalogue so the admin can pick any of them; the sale itself is simulated.

const DEFAULT_SLUG = "smooth-e-gold-miracle-capsule";

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
    products: p ? [{ slug: p.slug, name: p.name, brand: p.brand, image: p.image, price: p.price, compareAtPrice: p.compareAtPrice }] : [],
    stockPerProduct: 25,
    windowMinutes: 15,
    maxRequeue: 3,
  };

  return <FlashSaleDemo initialConfig={initialConfig} catalogue={catalogue} groups={groups} />;
}
