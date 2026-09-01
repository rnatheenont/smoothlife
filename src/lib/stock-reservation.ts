import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { getVariantAvailability } from "@/lib/shopify-admin";

// Short TTL — this is a checkout-session-length hold (stops two customers
// racing for the last unit while one of them is mid-checkout), not a
// cart-length hold. A stale `held` row just means someone abandoned
// checkout; the expiry sweep below frees it back up.
const RESERVATION_TTL_MINUTES = 15;

export type ReservationLine = { variantId: string; quantity: number };

type ReservationRow = { variant_id: string; quantity: number };

async function heldQuantityFor(variantId: string): Promise<number> {
  const rows = await supabaseRest<ReservationRow[]>(
    `stock_reservations?variant_id=eq.${encodeURIComponent(variantId)}&status=eq.held&expires_at=gt.${new Date().toISOString()}&select=quantity`
  );
  return rows.reduce((sum, r) => sum + r.quantity, 0);
}

// All-or-nothing: either every line in the cart gets a reservation, or none
// do — a customer shouldn't end up holding 2 of 3 items in their cart.
export async function reserveStock(
  cartToken: string,
  lines: ReservationLine[]
): Promise<{ ok: true } | { ok: false; shortVariantIds: string[] }> {
  if (!supabaseConfigured()) return { ok: true }; // nothing to guard against locally without Supabase

  const shortVariantIds: string[] = [];
  for (const line of lines) {
    const availability = await getVariantAvailability(line.variantId);
    if (!availability) continue; // couldn't verify — don't block on missing data, matches cancelOutOfStockSubscriptions' policy
    if (availability.inventoryPolicy !== "DENY" || availability.inventoryQuantity === null) continue; // unlimited/untracked — never short
    const held = await heldQuantityFor(line.variantId);
    const remaining = availability.inventoryQuantity - held;
    if (remaining < line.quantity) shortVariantIds.push(line.variantId);
  }
  if (shortVariantIds.length > 0) return { ok: false, shortVariantIds };

  const expiresAt = new Date(Date.now() + RESERVATION_TTL_MINUTES * 60 * 1000).toISOString();
  await supabaseRest("stock_reservations", {
    method: "POST",
    returning: false,
    body: JSON.stringify(
      lines.map((l) => ({ cart_token: cartToken, variant_id: l.variantId, quantity: l.quantity, expires_at: expiresAt }))
    ),
  });
  return { ok: true };
}

export async function releaseStock(cartToken: string): Promise<void> {
  if (!supabaseConfigured()) return;
  await supabaseRest(`stock_reservations?cart_token=eq.${encodeURIComponent(cartToken)}&status=eq.held`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "released" }),
  });
}

export async function confirmStock(cartToken: string): Promise<void> {
  if (!supabaseConfigured()) return;
  await supabaseRest(`stock_reservations?cart_token=eq.${encodeURIComponent(cartToken)}&status=eq.held`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ status: "confirmed" }),
  });
}

// Daily sweep (called from the shared cron, see api/cron/subscription-reminders)
// — frees stock held by checkouts that were abandoned before ever reaching
// a payment outcome (so releaseStock never got called).
export async function expireStaleReservations(): Promise<number> {
  if (!supabaseConfigured()) return 0;
  const expired = await supabaseRest<{ id: string }[]>(
    `stock_reservations?status=eq.held&expires_at=lt.${new Date().toISOString()}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status: "expired" }),
    }
  );
  return expired.length;
}
