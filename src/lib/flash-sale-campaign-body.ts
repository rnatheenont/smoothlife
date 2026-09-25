import type { CampaignConfig } from "@/components/flash-sale-demo/campaign";

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
