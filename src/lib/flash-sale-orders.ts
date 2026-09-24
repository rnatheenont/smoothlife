// Turning a paid flash-sale reservation into a Shopify order. Used by the
// 2C2P webhook right after payment, and by the admin "retry" button when
// Shopify was unavailable at that moment (plan §8: the payment is never
// rolled back; the order is retried and staff are alerted).
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { createPaidShopifyOrder } from "@/lib/shopify-admin";

export type FlashSaleTransaction = {
  id: string;
  invoice_no: string;
  tran_ref: string | null;
  user_id: string | null;
  amount: number;
  currency_code: string | null;
  contact_email: string | null;
  flash_sale_entry_id: string;
  line_items: { variantId: string; quantity: number; price: number }[] | null;
  shipping_address: {
    firstName?: string;
    lastName?: string;
    address1: string;
    city: string;
    postalCode: string;
    countryCode: string;
    state?: string;
    phone?: string;
  };
};

export const FLASH_SALE_TX_COLUMNS =
  "id,invoice_no,tran_ref,user_id,amount,currency_code,contact_email,flash_sale_entry_id,line_items,shipping_address";

/** Creates the order and records the result on both rows. Never throws. */
export async function createFlashSaleOrder(tx: FlashSaleTransaction): Promise<{ ok: boolean; orderName?: string }> {
  const entryFilter = `flash_sale_queue?id=eq.${pgValue(tx.flash_sale_entry_id)}`;
  try {
    let customerId: string | undefined;
    if (tx.user_id) {
      const [user] = await supabaseRest<{ shopify_customer_id: string | null }[]>(
        `users?id=eq.${pgValue(tx.user_id)}&select=shopify_customer_id&limit=1`
      );
      customerId = user?.shopify_customer_id ?? undefined;
    }
    const addr = tx.shipping_address;
    const order = await createPaidShopifyOrder({
      customerId,
      email: tx.contact_email ?? undefined,
      lineItems: tx.line_items ?? [],
      currencyCode: tx.currency_code ?? "THB",
      shippingAddress: {
        firstName: addr.firstName,
        lastName: addr.lastName,
        address1: addr.address1,
        city: addr.city,
        province: addr.state,
        zip: addr.postalCode,
        countryCode: addr.countryCode,
        phone: addr.phone,
      },
      note: `Flash Sale (2C2P ${tx.invoice_no})`,
      tranRef: tx.tran_ref ?? tx.invoice_no,
    });
    await supabaseRest(`payment_transactions?id=eq.${pgValue(tx.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_order_id: order.id }),
    });
    await supabaseRest(entryFilter, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_order_id: order.name, shopify_sync_status: "synced", updated_at: new Date().toISOString() }),
    });
    return { ok: true, orderName: order.name };
  } catch (err) {
    console.error("[flash-sale] paid but Shopify order creation failed", tx.invoice_no, err);
    await supabaseRest(entryFilter, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ shopify_sync_status: "failed", updated_at: new Date().toISOString() }),
    }).catch(() => {});
    return { ok: false };
  }
}
