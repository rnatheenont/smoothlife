import { supabaseRest } from "@/lib/supabase-server";
import { findShopifyCustomerByEmail } from "@/lib/shopify-admin";

/**
 * The Shopify customer an employee's staff-shop orders land on.
 *
 * The staff sale buys under the work email, and staff-order-shopify's
 * resolveCustomerId deliberately prefers whichever customer owns that email
 * over the one the account is linked to — it even logs "two Shopify customers
 * for one employee" when they differ, and leaves the link alone on the
 * grounds that merging accounts is a job for a human with the merge button.
 *
 * That decision is fine. What it left behind is that everything which lists
 * "this person's orders" asks only about the linked customer, so a paid staff
 * order is a real order on a record nobody queries — invisible to the person
 * who bought it and to the support agent looking at their account.
 *
 * Keyed on the email recorded on the user's own staff_orders rows, never on
 * anything the account stores, so it can only ever reach a customer this user
 * has actually bought through. Returns null when there is nothing to add:
 * no staff orders, or the staff customer is already the linked one.
 */
export async function staffShopifyCustomerId(
  userId: string | null | undefined,
  linkedCustomerId?: string | null,
): Promise<string | null> {
  if (!userId) return null;
  const rows = await supabaseRest<{ staff_email: string | null }[]>(
    `staff_orders?user_id=eq.${userId}&select=staff_email&order=created_at.desc&limit=1`,
  ).catch(() => []);
  const email = rows?.[0]?.staff_email?.trim();
  if (!email) return null;
  const customer = await findShopifyCustomerByEmail(email).catch(() => null);
  const id = customer?.id ?? null;
  // Compared on the number alone: the linked id reaches here as a gid from
  // one caller and as the bare digits from the other, and matching the whole
  // string would make the same customer look like a second one.
  const num = (v: string | null | undefined) => v?.replace(/^gid:\/\/shopify\/Customer\//, "") ?? null;
  return id && num(id) !== num(linkedCustomerId) ? id : null;
}
