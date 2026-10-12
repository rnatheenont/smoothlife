// Sending an event to whatever tag manager is listening, or to nothing.
//
// One rule: this is measurement, and measurement must never be able to break
// a page. GTM is off unless NEXT_PUBLIC_GTM_ID is set, an ad blocker can
// remove it after it loads, and a customer may have arrived before the
// script did — so every path here ends in "do nothing" rather than throwing.
//
// It pushes to window.dataLayer directly instead of importing anything from
// GTM: the dataLayer is an array that exists whether or not the container
// ever arrives, which is the whole reason the pattern works offline.

type Params = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function pushDataLayer(event: string, params: Params = {}): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Created rather than required: pushing before GTM loads is supported —
    // the container replays what is already in the array when it arrives.
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event, ...params });
    return true;
  } catch {
    return false;
  }
}

/**
 * GA4's promotion shape, filled from what a section already knows.
 *
 * The four names are GA4's own (view_promotion / select_promotion take an
 * `items` array with these keys), so the team's existing reports and the
 * Shopify side line up without a mapping table in between.
 */
export function promotionParams(args: {
  pageKind: string;
  pageSlug: string;
  sectionId: string;
  sectionLabel: string;
  index: number;
}) {
  return {
    promotion_id: `${args.pageKind}/${args.pageSlug}`,
    promotion_name: args.pageSlug,
    creative_name: args.sectionLabel,
    creative_slot: args.sectionId,
    // GA4 reads the ecommerce object, not the top level.
    ecommerce: {
      promotion_id: `${args.pageKind}/${args.pageSlug}`,
      promotion_name: args.pageSlug,
      creative_name: args.sectionLabel,
      creative_slot: args.sectionId,
      items: [
        {
          item_id: args.sectionId,
          item_name: args.sectionLabel,
          index: args.index,
        },
      ],
    },
  };
}
