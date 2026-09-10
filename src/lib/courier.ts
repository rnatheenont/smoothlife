// Couriers, kept behind one interface so the tracking UI never learns which
// company shipped the parcel.
//
// Right now this is Kerry Express and the only thing we can do with a Kerry
// tracking number is build a link to Kerry's own page. That is not a
// limitation of this file — it is what the data allows, and it is worth
// writing down because it is the single fact that decides how much of the
// tracking feature can exist:
//
//   Shopify stores a tracking number and a courier name on each fulfillment,
//   and nothing else. Checked against the live store on 2026-09-04: every
//   recent fulfilled order (#4191–#4195) has a Kerry number, and every one of
//   them has `events: []`, `deliveredAt: null` and `estimatedDeliveryAt:
//   null`. So there are no scan events, no delivery confirmation and no ETA
//   coming from Shopify — whoever creates the fulfillments does not post them.
//
// A per-scan timeline, a route map and a countdown all need those events.
// They arrive the day a courier adapter below can actually fetch them; until
// then `fetchEvents` reports that it cannot, and the UI says so plainly
// rather than inventing a journey.

import { aftershipConfigured, fetchTracking } from "@/lib/aftership";
import { saveTracking } from "@/lib/shipment-store";

export type CourierId = "kerry" | "flash" | "thailand_post" | "unknown";

export type CourierEvent = {
  /** Raw status text from the courier, kept for the timeline. */
  statusText: string;
  /** Mapped onto our own step vocabulary where possible. */
  statusCode: ShipmentStatus | null;
  locationName: string | null;
  eventTime: string;
};

export type ShipmentStatus =
  | "confirmed"
  | "processing"
  | "ready_to_ship"
  | "shipped"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "failed";

type Courier = {
  id: CourierId;
  label: string;
  /** Public tracking page for a number, or null when the courier has none. */
  trackingUrl(trackingNumber: string): string | null;
  /** True once this courier's API credentials are present. */
  configured(): boolean;
  fetchEvents(trackingNumber: string): Promise<CourierEvent[]>;
};

class NotConfiguredError extends Error {
  constructor(courier: string) {
    super(`ยังไม่ได้เชื่อมต่อ API ของ ${courier}`);
    this.name = "NotConfiguredError";
  }
}

const KERRY: Courier = {
  id: "kerry",
  label: "Kerry Express",
  // The URL Shopify itself stores on the fulfillment, so a customer clicking
  // through from us lands exactly where Shopify's own emails send them.
  // The number cannot be put in the link: kerryexpress.com is retired, and on
  // the KEX site that replaced it a URL carrying a tracking number answers
  // with a bare "ok" instead of a page — checked, not assumed. So the link
  // opens their search and the number sits next to it with a copy button.
  trackingUrl: () => "https://th.kex-express.com/th/track/",
  // AfterShip carries KEX's scans and needs no agreement with KEX to start,
  // so the feature does not have to wait on a sales conversation. If KEX's own
  // API arrives later it becomes another branch here and nothing above this
  // file changes.
  configured: () => aftershipConfigured(),
  async fetchEvents(trackingNumber) {
    if (!KERRY.configured()) throw new NotConfiguredError("Kerry Express");
    const tracking = await fetchTracking(trackingNumber);
    if (!tracking) return [];
    await saveTracking(tracking);
    return tracking.events;
  },
};

const FLASH: Courier = {
  id: "flash",
  label: "Flash Express",
  trackingUrl: (n) => `https://www.flashexpress.com/fle/tracking?se=${encodeURIComponent(n)}`,
  configured: () => false,
  async fetchEvents() {
    throw new NotConfiguredError("Flash Express");
  },
};

const THAILAND_POST: Courier = {
  id: "thailand_post",
  label: "ไปรษณีย์ไทย",
  trackingUrl: (n) => `https://track.thailandpost.co.th/?trackNumber=${encodeURIComponent(n)}`,
  configured: () => false,
  async fetchEvents() {
    throw new NotConfiguredError("ไปรษณีย์ไทย");
  },
};

const UNKNOWN: Courier = {
  id: "unknown",
  label: "ขนส่ง",
  trackingUrl: () => null,
  configured: () => false,
  async fetchEvents() {
    throw new NotConfiguredError("ขนส่ง");
  },
};

const COURIERS: Courier[] = [KERRY, FLASH, THAILAND_POST];

/**
 * Maps the free-text courier name Shopify stores on a fulfillment onto one of
 * ours. Matched loosely because the string is typed by whoever set up the
 * shipping app — the live store currently says "Kerry Express Thailand".
 */
export function courierFromShopifyName(name: string | null | undefined): Courier {
  const n = (name || "").toLowerCase();
  if (n.includes("kerry")) return KERRY;
  if (n.includes("flash")) return FLASH;
  if (n.includes("thailand post") || n.includes("ไปรษณีย์")) return THAILAND_POST;
  return UNKNOWN;
}

export function courierById(id: string | null | undefined): Courier {
  return COURIERS.find((c) => c.id === id) ?? UNKNOWN;
}

/** True when at least one courier can give us scan events. */
export function anyCourierConfigured(): boolean {
  return COURIERS.some((c) => c.configured());
}
