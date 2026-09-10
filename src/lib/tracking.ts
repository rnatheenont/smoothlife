import { courierFromShopifyName, anyCourierConfigured } from "@/lib/courier";
import { deriveSteps } from "@/lib/shipment";
import type { ShopifyShipment } from "@/lib/shopify-admin";
import type { StoredTracking } from "@/lib/shipment-store";

// Shapes one order into what the tracker component renders. Shared by the
// signed-in orders page and the signed-out /track page so the two can never
// drift into telling a customer two different stories about one parcel.

export type TrackedShipment = ReturnType<typeof buildTracking>["shipments"][number];

export function buildTracking(
  order: {
    name: string;
    createdAt: string;
    financialStatus: string | null;
    shipments: ShopifyShipment[];
  },
  /**
   * Courier scans we already hold, by tracking number.
   *
   * Optional so the signature stays honest about what is guaranteed: Shopify
   * knows the parcel was handed over and nothing more, and everything past
   * that step exists only when a courier feed has told us.
   */
  stored?: Map<string, StoredTracking>
) {
  // The order exists, so it was confirmed — that step never depended on
  // payment and pretending it did left a partially refunded or unpaid order
  // with five grey steps and no way to tell it apart from one that had gone
  // wrong. Preparing still keys off money actually having arrived.
  const confirmedAt = order.createdAt;
  const paidAt =
    order.financialStatus === "PAID" ||
    order.financialStatus === "PARTIALLY_REFUNDED" ||
    order.financialStatus === "REFUNDED"
      ? order.createdAt
      : null;
  const hasCourierFeed = anyCourierConfigured();

  const shipments = order.shipments.map((s) => {
    const courier = courierFromShopifyName(s.company);
    const feed = stored?.get(s.number);
    return {
      trackingNumber: s.number,
      courierId: courier.id,
      courierLabel: courier.label,
      // Ours first, Shopify's second. Shopify stores whatever link was right
      // when the fulfillment was created and never revisits it, so orders from
      // months ago still point at kerryexpress.com — a domain that no longer
      // tracks anything. courier.ts is the one place that knows today's link.
      trackingUrl: courier.trackingUrl(s.number) || s.url,
      // The courier's own estimate wins over Shopify's, which is only ever
      // whatever the shop typed at fulfillment time.
      estimatedDeliveryAt: feed?.expectedDelivery ?? s.estimatedDeliveryAt,
      steps: deriveSteps({
        confirmedAt,
        paidAt,
        shippedAt: s.shippedAt,
        // A delivery scan is the strongest thing anyone has; Shopify's own
        // deliveredAt is almost always null because nobody posts it there.
        deliveredAt: feed?.deliveredAt ?? s.deliveredAt,
        events: feed?.events ?? [],
      }),
      events: (feed?.events ?? []).slice().reverse(),
    };
  });

  // An order that is paid but has no parcel yet still deserves a tracker: it
  // is genuinely at "preparing", and showing nothing would read as "lost".
  if (shipments.length === 0) {
    return {
      orderName: order.name,
      hasCourierFeed,
      shipments: [
        {
          trackingNumber: null,
          courierId: "unknown",
          courierLabel: "ขนส่ง",
          trackingUrl: null,
          estimatedDeliveryAt: null,
          steps: deriveSteps({ confirmedAt, paidAt, shippedAt: null, deliveredAt: null, events: [] }),
          events: [],
        },
      ],
    };
  }

  return { orderName: order.name, hasCourierFeed, shipments };
}
