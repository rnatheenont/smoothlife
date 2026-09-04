import { courierFromShopifyName, anyCourierConfigured } from "@/lib/courier";
import { deriveSteps } from "@/lib/shipment";
import type { ShopifyShipment } from "@/lib/shopify-admin";

// Shapes one order into what the tracker component renders. Shared by the
// signed-in orders page and the signed-out /track page so the two can never
// drift into telling a customer two different stories about one parcel.

export type TrackedShipment = ReturnType<typeof buildTracking>["shipments"][number];

export function buildTracking(order: {
  name: string;
  createdAt: string;
  financialStatus: string | null;
  shipments: ShopifyShipment[];
}) {
  const paidAt = order.financialStatus === "PAID" ? order.createdAt : null;
  const hasCourierFeed = anyCourierConfigured();

  const shipments = order.shipments.map((s) => {
    const courier = courierFromShopifyName(s.company);
    return {
      trackingNumber: s.number,
      courierId: courier.id,
      courierLabel: courier.label,
      trackingUrl: s.url || courier.trackingUrl(s.number),
      estimatedDeliveryAt: s.estimatedDeliveryAt,
      steps: deriveSteps({
        paidAt,
        shippedAt: s.shippedAt,
        deliveredAt: s.deliveredAt,
        // Empty until a courier adapter is connected — see courier.ts.
        events: [],
      }),
      events: [] as { statusText: string; locationName: string | null; eventTime: string }[],
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
          steps: deriveSteps({ paidAt, shippedAt: null, deliveredAt: null, events: [] }),
          events: [],
        },
      ],
    };
  }

  return { orderName: order.name, hasCourierFeed, shipments };
}
