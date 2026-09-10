import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import type { CourierEvent } from "@/lib/courier";
import type { NormalisedTracking } from "@/lib/aftership";

// Where courier scans live once we have them.
//
// Kept in our own table rather than fetched per page view: webhooks arrive
// whether or not anyone is looking, an order page must not wait on a third
// party to render, and a courier that goes quiet should not erase the history
// it already gave us.

export type StoredTracking = {
  trackingNumber: string;
  status: string | null;
  deliveredAt: string | null;
  expectedDelivery: string | null;
  events: CourierEvent[];
};

export async function saveTracking(t: NormalisedTracking): Promise<void> {
  if (!supabaseConfigured()) return;
  try {
    await supabaseRest("shipment_tracking?on_conflict=tracking_number", {
      method: "POST",
      returning: false,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        tracking_number: t.trackingNumber,
        slug: t.slug,
        status: t.status,
        raw_status: t.rawStatus,
        delivered_at: t.deliveredAt,
        expected_delivery: t.expectedDelivery,
        events: t.events,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("[shipment-store] save failed", t.trackingNumber, err);
  }
}

/** Everything we know about these parcels, keyed by tracking number. */
export async function getStoredTracking(numbers: string[]): Promise<Map<string, StoredTracking>> {
  const out = new Map<string, StoredTracking>();
  const wanted = [...new Set(numbers.filter(Boolean))];
  if (!supabaseConfigured() || wanted.length === 0) return out;
  try {
    const list = wanted.map((n) => `"${n.replace(/"/g, "")}"`).join(",");
    const rows = await supabaseRest<
      {
        tracking_number: string;
        status: string | null;
        delivered_at: string | null;
        expected_delivery: string | null;
        events: CourierEvent[] | null;
      }[]
    >(
      `shipment_tracking?tracking_number=in.(${encodeURIComponent(list)})` +
        `&select=tracking_number,status,delivered_at,expected_delivery,events`
    );
    for (const r of rows) {
      out.set(r.tracking_number, {
        trackingNumber: r.tracking_number,
        status: r.status,
        deliveredAt: r.delivered_at,
        expectedDelivery: r.expected_delivery,
        events: Array.isArray(r.events) ? r.events : [],
      });
    }
  } catch (err) {
    console.error("[shipment-store] read failed", err);
  }
  return out;
}

/** Numbers we have never registered with the courier feed. */
export async function unregisteredNumbers(numbers: string[]): Promise<string[]> {
  const wanted = [...new Set(numbers.filter(Boolean))];
  if (!supabaseConfigured() || wanted.length === 0) return [];
  try {
    const list = wanted.map((n) => `"${n.replace(/"/g, "")}"`).join(",");
    const rows = await supabaseRest<{ tracking_number: string }[]>(
      `shipment_tracking?tracking_number=in.(${encodeURIComponent(list)})&select=tracking_number`
    );
    const known = new Set(rows.map((r) => r.tracking_number));
    return wanted.filter((n) => !known.has(n));
  } catch (err) {
    console.error("[shipment-store] registration check failed", err);
    return [];
  }
}

/** Records that a parcel is now being watched, before any scan arrives. */
export async function markRegistered(trackingNumber: string, courierLabel: string | null): Promise<void> {
  if (!supabaseConfigured()) return;
  try {
    await supabaseRest("shipment_tracking?on_conflict=tracking_number", {
      method: "POST",
      returning: false,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        tracking_number: trackingNumber,
        courier_label: courierLabel,
        registered_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (err) {
    console.error("[shipment-store] mark registered failed", trackingNumber, err);
  }
}

export { pgValue };
