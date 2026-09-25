import type { CampaignConfig } from "@/components/flash-sale-demo/campaign";
import type { CatalogueItem } from "@/components/flash-sale-demo/CampaignSetup";
import type { FlashSaleCampaignDTO } from "@/lib/flash-sale-campaigns";

// A campaign as the API wants it written down.
//
// The simulator's drawer and the real creator both hand the same shape to the
// same two endpoints, and they had each spelled this out for themselves.
// Spelling it once is the difference between a field being added to the form
// and a field being added to the form *and* remembered in two places.

export function campaignBody(config: CampaignConfig, startsAt: number, endsAt?: number | null) {
  return {
    title: config.title,
    mode: config.mode,
    kind: config.kind ?? "regular",
    // A regular campaign's page has no dressing; the server drops these for
    // it anyway, and sending them keeps one shape for both kinds.
    heroImage: config.presentation?.heroImage ?? null,
    heroHeadline: config.presentation?.heroHeadline ?? null,
    heroNote: config.presentation?.heroNote ?? null,
    heroAlign: config.presentation?.heroAlign ?? "top",
    accent: config.presentation?.accent ?? null,
    faq: config.presentation?.faq ?? [],
    groupKind: config.group?.kind,
    groupKey: config.group?.key,
    productSlugs: config.products.map((p) => p.slug),
    pricing: config.pricing ?? { mode: "regular" as const },
    stockPerProduct: config.stockPerProduct,
    windowMinutes: config.windowMinutes,
    maxRequeue: config.maxRequeue,
    startsAt,
    endsAt: endsAt ?? null,
  };
}

/**
 * A saved campaign as the form wants to show it.
 *
 * The prices are folded into the products the way the form displays them —
 * a flash price becomes the product's price, with the regular one moved to
 * compareAtPrice — so what the admin sees is what the customer would. Which
 * price mode produced them is restored from EditingCampaign.salePrices.
 *
 * Returns null when the catalogue no longer has any of its products: a
 * campaign selling something since delisted cannot be rebuilt by this form,
 * and a half-filled form is worse than saying so.
 */
export function campaignToConfig(
  c: FlashSaleCampaignDTO,
  bySlug: Map<string, CatalogueItem>
): CampaignConfig | null {
  const products = c.productSlugs
    .map((slug) => bySlug.get(slug))
    .filter((p): p is CatalogueItem => Boolean(p))
    .map(({ slug, name, brand, image, price, compareAtPrice }) => {
      const sale = c.salePrices?.[slug];
      return sale === null || sale === undefined
        ? { slug, name, brand, image, price, compareAtPrice }
        : { slug, name, brand, image, price: sale, compareAtPrice: Math.max(price, compareAtPrice ?? 0) };
    });
  if (products.length === 0) return null;
  return {
    mode: c.mode,
    kind: c.kind,
    presentation: {
      heroImage: c.presentation.heroImage ?? undefined,
      heroHeadline: c.presentation.heroHeadline ?? undefined,
      heroNote: c.presentation.heroNote ?? undefined,
      heroAlign: c.presentation.heroAlign,
      accent: c.presentation.accent ?? undefined,
      faq: c.presentation.faq,
    },
    title: c.title,
    products,
    stockPerProduct: c.stockPerProduct,
    windowMinutes: c.windowMinutes,
    maxRequeue: c.maxRequeue,
    group: c.groupKind && c.groupKey ? { kind: c.groupKind, key: c.groupKey } : undefined,
  };
}
