import { pgValue, supabaseRest } from "@/lib/supabase-server";

// One receipt, one claim — whoever is holding it.
//
// The campaign is entered by typing the number on a receipt, and until now
// that number was only ever checked against the same customer's own entries.
// Two people could therefore claim one purchase: the number from a receipt
// left in a bag, or simply the one next to theirs. It happened — order #4305
// was claimed twice by two different accounts before this existed.
//
// A claim that was rejected or revoked releases the number again, because the
// usual reason for rejecting one is that it was never that person's receipt,
// and the customer whose purchase it actually was should not be locked out by
// somebody else's failed attempt.

const ACTIVE = ["pending_review", "approved"];

export type ClaimCheck = { taken: boolean; byMe: boolean };

/** Just the digits — receipts are written "#4305", "4305", "Order 4305". */
export function claimDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/**
 * Whether this order number is already spoken for, and by whom.
 *
 * The comparison is done here rather than in the query because the number is
 * stored as the customer typed it — "#4305" and "4305" are the same claim and
 * no amount of SQL equality will say so. The campaign's active entries are a
 * small list by construction: one per purchase, for the length of one
 * campaign.
 */
export async function orderNumberClaim(opts: {
  campaign: string;
  userId: string;
  number: string | null | undefined;
}): Promise<ClaimCheck> {
  const digits = claimDigits(opts.number);
  if (!digits) return { taken: false, byMe: false };

  const rows = await supabaseRest<
    { user_id: string; manual_receipt_no: string | null; declared_order_number: string | null }[]
  >(
    `receipt_campaign_entries?campaign_key=eq.${pgValue(opts.campaign)}` +
      `&status=in.(${ACTIVE.join(",")})` +
      `&select=user_id,manual_receipt_no,declared_order_number&limit=2000`
  ).catch(() => []);

  const holder = rows.find(
    (r) => claimDigits(r.manual_receipt_no) === digits || claimDigits(r.declared_order_number) === digits
  );
  if (!holder) return { taken: false, byMe: false };
  return { taken: true, byMe: holder.user_id === opts.userId };
}
