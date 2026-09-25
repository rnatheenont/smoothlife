import { products } from "@/data/products";
import { categories } from "@/data/categories";
import { brands, brandSlugAliases, slugifyVendor } from "@/data/brands";
import { collections } from "@/data/collections";
import { unpublishedProducts } from "@/lib/shopify-admin";
import type { ExtraProducts } from "@/lib/flash-sale-campaigns";
import type { CatalogueItem, ProductGroup } from "@/components/flash-sale-demo/CampaignSetup";

// What a flash sale can be built out of: the shop's own products, and the
// groups a campaign can be pointed at wholesale.
//
// One copy because there were two — the simulator's page and the real
// creator's — and a campaign form that offers a different catalogue depending
// on which screen you opened it from is a campaign form you cannot trust.

/** Everything sellable: in stock, and with a picture to show in the picker. */
export function saleCatalogue(): CatalogueItem[] {
  return products
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
}

/** Categories, brands and collections — anything with at least two products in it. */
export function saleGroups(catalogue: CatalogueItem[]): ProductGroup[] {
  const inCatalogue = new Set(catalogue.map((p) => p.slug));
  return [
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
    // A "group" of one is a single-product campaign wearing the wrong hat.
  ].filter((g) => g.slugs.length >= 2);
}

/**
 * The picker's list, including what the shop has not published yet.
 *
 * Drafts come last and carry a marker: a campaign can be set up for next
 * month's launch, but nobody should mistake one for something on sale.
 */
export async function catalogueWithDrafts(): Promise<CatalogueItem[]> {
  const published = saleCatalogue();
  const known = new Set(published.map((p) => p.slug));
  const drafts = await unpublishedProducts();
  return [
    ...published,
    ...drafts
      .filter((d) => !known.has(d.slug) && d.image)
      .map((d) => ({
        slug: d.slug,
        name: d.name,
        brand: d.brand,
        brandSlug: slugifyVendor(d.brand),
        // Not in any category the storefront knows, which is the point.
        category: "",
        image: d.image,
        price: d.price,
        compareAtPrice: d.compareAtPrice,
        state: d.state,
      })),
  ];
}

/** Slug → variant and price, for the products the static catalogue lacks. */
export async function unpublishedIndex(): Promise<ExtraProducts> {
  const rows = await unpublishedProducts();
  return new Map(rows.map((d) => [d.slug, { variantId: d.variantId, price: d.price }]));
}
