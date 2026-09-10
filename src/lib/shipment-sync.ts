import { registerTracking, aftershipConfigured } from "@/lib/aftership";
import { getStoredTracking, unregisteredNumbers, markRegistered, type StoredTracking } from "@/lib/shipment-store";

// Making sure the parcels on a page are actually being watched.
//
// Registering happens the first time anyone looks at an order rather than only
// when the tracking number is written, because the numbers that most need
// watching are the ones already in flight when this feature shipped. It is
// fire-and-forget on purpose: the page renders with what we have, and the
// scans show up on the next visit. An order page must never wait on a courier.

export async function trackingForOrders(
  orders: { shipments: { number: string; company: string | null }[] }[]
): Promise<Map<string, StoredTracking>> {
  const numbers = orders.flatMap((o) => o.shipments.map((s) => s.number)).filter(Boolean);
  if (numbers.length === 0) return new Map();

  const stored = await getStoredTracking(numbers);

  if (aftershipConfigured()) {
    void (async () => {
      try {
        const missing = await unregisteredNumbers(numbers);
        // A handful at a time: someone opening a long order history should not
        // fire off fifty courier registrations in one breath.
        for (const number of missing.slice(0, 5)) {
          const label = orders.flatMap((o) => o.shipments).find((s) => s.number === number)?.company ?? null;
          if (await registerTracking(number)) await markRegistered(number, label);
        }
      } catch (err) {
        console.error("[shipment-sync] registration sweep failed", err);
      }
    })();
  }

  return stored;
}
