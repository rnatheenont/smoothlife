import { createHmac, timingSafeEqual } from "crypto";
import type { CourierEvent, ShipmentStatus } from "@/lib/courier";

// AfterShip, standing in for a direct courier feed.
//
// KEX will give us their own API eventually — the request is with their sales
// team — but "eventually" is not a date, and until then every customer looking
// at a parcel sees a tracker frozen at "handed to the courier". AfterShip
// already carries KEX's scans, so this buys the missing half of the feature
// now and can be swapped for the direct feed later without the pages noticing:
// both sides speak CourierEvent (see lib/courier.ts).

const BASE = process.env.AFTERSHIP_API_BASE || "https://api.aftership.com/tracking/2026-07";
// The courier's identifier in AfterShip's list. Configurable because carriers
// get renamed — Kerry Express Thailand became KEX — and a rename should be an
// environment variable, not a deploy.
const SLUG = process.env.AFTERSHIP_SLUG || "kerry-express-th";

export function aftershipConfigured() {
  return Boolean(process.env.AFTERSHIP_API_KEY);
}

/** AfterShip's status vocabulary, mapped onto ours. */
const TAG_TO_STATUS: Record<string, ShipmentStatus | null> = {
  Pending: "confirmed",
  InfoReceived: "ready_to_ship",
  InTransit: "in_transit",
  OutForDelivery: "out_for_delivery",
  AttemptFail: "failed",
  Delivered: "delivered",
  AvailableForPickup: "out_for_delivery",
  Exception: "failed",
  Expired: null,
};

type Checkpoint = {
  message?: string | null;
  tag?: string | null;
  subtag_message?: string | null;
  checkpoint_time?: string | null;
  created_at?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
};

type TrackingPayload = {
  tracking_number?: string;
  slug?: string;
  tag?: string | null;
  expected_delivery?: string | null;
  shipment_delivery_date?: string | null;
  checkpoints?: Checkpoint[];
};

export type NormalisedTracking = {
  trackingNumber: string;
  slug: string | null;
  status: ShipmentStatus | null;
  rawStatus: string | null;
  deliveredAt: string | null;
  expectedDelivery: string | null;
  events: CourierEvent[];
};

/**
 * One tracking payload turned into the shape the rest of the app speaks.
 *
 * Exported so the webhook and the polling path share it — the two used to be
 * the classic place for a tracker to disagree with itself, one route mapping
 * "AttemptFail" and the other not.
 */
export function normaliseTracking(t: TrackingPayload): NormalisedTracking | null {
  if (!t?.tracking_number) return null;
  const events: CourierEvent[] = (t.checkpoints ?? [])
    .map((c) => {
      const eventTime = c.checkpoint_time || c.created_at;
      if (!eventTime) return null;
      const place = [c.location, c.city, c.state].filter(Boolean).join(", ");
      return {
        statusText: c.message || c.subtag_message || c.tag || "อัปเดตสถานะ",
        statusCode: c.tag ? (TAG_TO_STATUS[c.tag] ?? null) : null,
        locationName: place || null,
        eventTime: new Date(eventTime).toISOString(),
      };
    })
    .filter((e): e is CourierEvent => e !== null)
    .sort((a, b) => a.eventTime.localeCompare(b.eventTime));

  const delivered = events.filter((e) => e.statusCode === "delivered").pop();
  return {
    trackingNumber: t.tracking_number,
    slug: t.slug ?? null,
    status: t.tag ? (TAG_TO_STATUS[t.tag] ?? null) : null,
    rawStatus: t.tag ?? null,
    // The scan wins over the tracking's own delivery date: it is the moment
    // someone recorded the parcel changing hands.
    deliveredAt: delivered?.eventTime ?? (t.shipment_delivery_date ? new Date(t.shipment_delivery_date).toISOString() : null),
    expectedDelivery: t.expected_delivery ? new Date(t.expected_delivery).toISOString() : null,
    events,
  };
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T | null> {
  const key = process.env.AFTERSHIP_API_KEY;
  if (!key) return null;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10_000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      signal: abort.signal,
      headers: { "as-api-key": key, "Content-Type": "application/json", ...(init.headers || {}) },
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      // 4xx here is ordinary: a number AfterShip has never heard of, or one
      // already registered. Logged, never thrown — a courier lookup must not
      // be able to take down the order page it decorates.
      console.error("[aftership]", init.method || "GET", path, res.status, JSON.stringify(body)?.slice(0, 300));
      return null;
    }
    return body as T;
  } catch (err) {
    console.error("[aftership] request failed", path, err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Tells AfterShip to start watching a parcel.
 *
 * Registering is what makes the webhooks start; a number nobody registered is
 * a number nobody reports on. Safe to call again — a duplicate comes back as a
 * 4xx that this treats as "already watching", which it is.
 */
export async function registerTracking(trackingNumber: string): Promise<boolean> {
  if (!aftershipConfigured()) return false;
  const body = await call<{ data?: { tracking?: TrackingPayload } }>("/trackings", {
    method: "POST",
    body: JSON.stringify({ tracking: { tracking_number: trackingNumber, slug: SLUG } }),
  });
  return Boolean(body);
}

/** The current state of one parcel, or null when we cannot ask or it is unknown. */
export async function fetchTracking(trackingNumber: string): Promise<NormalisedTracking | null> {
  if (!aftershipConfigured()) return null;
  const body = await call<{ data?: { trackings?: TrackingPayload[] } }>(
    `/trackings?tracking_numbers=${encodeURIComponent(trackingNumber)}`
  );
  const found = body?.data?.trackings?.find((t) => t.tracking_number === trackingNumber);
  return found ? normaliseTracking(found) : null;
}

/**
 * Whether a webhook body really came from AfterShip.
 *
 * Base64 HMAC-SHA256 of the raw body with the account's webhook secret, sent
 * in aftership-hmac-sha256. Compared in constant time, and refused outright
 * when no secret is configured: an endpoint that writes parcel statuses on
 * anyone's say-so is worse than one that does not exist.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.AFTERSHIP_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  const a = Buffer.from(signature.trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The header carrying the signature, whichever name this account's plan uses.
 *
 * AfterShip's own documentation names two — aftership-hmac-sha256 for Tracking
 * and am-webhook-signature for Shipping — and the admin has more than one place
 * to turn webhooks on. Reading all of them costs nothing; guessing one and
 * being wrong means every update is rejected as forged and the tracker quietly
 * never updates, which is the hardest kind of failure to notice.
 */
export const SIGNATURE_HEADERS = [
  "aftership-hmac-sha256",
  "am-webhook-signature",
  "as-signature-hmac-sha256",
  "x-aftership-hmac-sha256",
];
