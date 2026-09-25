import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { orderNameByGid } from "@/lib/shopify-admin";

// Taking entries back when the purchase behind them is undone.
//
// Entries are bought, not given: the rule is "ทุกๆ 690 บาทต่อใบเสร็จ", and a
// refunded order is 690 baht the shop does not have. Leaving the entries in
// place would let somebody buy in, be drawn, and take the money back — and the
// draw is weighted by entries, so it is not only their own chance they inflate.
//
// Deliberately not "rejected". Nothing was wrong with the photo or with the
// person, and a customer told their receipt was rejected will send it again.

export type RevokeResult = { revoked: number; heldPrize: boolean };

/**
 * Revokes the entries resting on one payment, and tells the customer why.
 *
 * One payment is one order is one entry — the unique index sees to that — so
 * this takes back what that bill was worth and nothing else. A customer with
 * three orders who is refunded on the second keeps the other two, and the
 * message names the order so they are not left working out which.
 *
 * Safe to call twice: only entries that are still live are touched, so a
 * second refund notice does not send a second message.
 */
export async function revokeEntriesForTransaction(
  transactionId: string,
  reason: string
): Promise<RevokeResult> {
  const entries = await supabaseRest<{ id: string; user_id: string; campaign_key: string; status: string }[]>(
    `receipt_campaign_entries?payment_transaction_id=eq.${pgValue(transactionId)}` +
      `&status=in.(pending_review,approved)&select=id,user_id,campaign_key,status`
  ).catch(() => []);
  if (!entries.length) return { revoked: 0, heldPrize: false };

  // The order number, so the notice is about a bill they can recognise rather
  // than "this order" in a list of three.
  const [tx] = await supabaseRest<{ shopify_order_id: string | null; invoice_no: string }[]>(
    `payment_transactions?id=eq.${pgValue(transactionId)}&select=shopify_order_id,invoice_no&limit=1`
  ).catch(() => []);
  const orderLabel =
    (tx ? await orderNameByGid(tx.shopify_order_id).catch(() => null) : null) ?? tx?.invoice_no ?? null;

  const now = new Date().toISOString();
  for (const entry of entries) {
    await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(entry.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ status: "revoked", revoked_at: now, revoke_reason: reason }),
    });

    await supabaseRest("notifications", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        user_id: entry.user_id,
        type: "receipt_revoked",
        title: orderLabel ? `สิทธิ์จากคำสั่งซื้อ ${orderLabel} ถูกยกเลิก` : "สิทธิ์จากใบเสร็จนี้ถูกยกเลิก",
        // Said plainly, and said why: this is not a rejection they can fix by
        // sending a clearer photo, and telling them to try again would waste
        // their time twice.
        // Says which bill, and says the rest are safe: the first thing anyone
        // wonders on reading this is whether they have lost everything.
        body:
          `${reason} — สิทธิ์ที่คำนวณจากคำสั่งซื้อ${orderLabel ? ` ${orderLabel}` : "นี้"} จึงถูกยกเลิก ` +
          `ใบเสร็จอื่นที่ส่งไว้ยังได้รับสิทธิ์ตามปกติ และหากซื้อใหม่ภายในช่วงกิจกรรม ส่งใบเสร็จเข้ามาได้เลย`,
        link: `/campaigns/${entry.campaign_key}`,
        metadata: { campaign_key: entry.campaign_key, entry_id: entry.id, order: orderLabel, reason: "refunded" },
      }),
    }).catch((err) => console.error("[receipt-revoke] notify failed", err));
  }

  // A prize already drawn is not ours to quietly delete. The draw is a record
  // of what happened, and somebody has to decide what to do about a winner
  // whose purchase went back — so it is flagged, loudly, rather than resolved.
  const users = [...new Set(entries.map((e) => e.user_id))];
  const winners = await supabaseRest<{ id: string }[]>(
    `receipt_campaign_winners?user_id=in.(${users.map(pgValue).join(",")})` +
      `&status=in.(pending_confirm,confirmed)&select=id&limit=1`
  ).catch(() => []);

  return { revoked: entries.length, heldPrize: winners.length > 0 };
}
