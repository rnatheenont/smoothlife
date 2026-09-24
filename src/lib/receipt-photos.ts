// Receipt photos: private bucket, signed links, nothing public.
//
// A receipt carries a name, an address and everything the person bought, so
// this follows chat-attachments.ts rather than the blog-image path — same
// storage API, opposite promise. The difference from chat photos is how long
// they live: a receipt is evidence for a prize draw and has to survive until
// after the last winner confirms (5 Nov), not thirty days from upload.
import { pgValue, supabaseRest } from "@/lib/supabase-server";

const BUCKET = "receipt-photos";
/** Long enough to look at one in the review screen, short enough to be useless if copied. */
const SIGNED_URL_TTL_SECONDS = 300;
export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function storageBase() {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL not set");
  return `${url.replace(/\/$/, "")}/storage/v1`;
}

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return key;
}

export function receiptExtension(contentType: string): string | null {
  return ALLOWED[contentType] ?? null;
}

/** Uploads one receipt and returns its path. There is no public URL for it. */
export async function uploadReceiptPhoto(opts: {
  userId: string;
  bytes: ArrayBuffer;
  contentType: string;
}): Promise<string> {
  const ext = receiptExtension(opts.contentType);
  if (!ext) throw new Error(`unsupported content type: ${opts.contentType}`);
  // Foldered by customer so everything one person sent can be found — and
  // removed — without having tracked each file separately.
  const path = `${opts.userId}/${crypto.randomUUID()}.${ext}`;
  const res = await fetch(`${storageBase()}/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceKey()}`,
      "Content-Type": opts.contentType,
      "x-upsert": "false",
    },
    body: opts.bytes,
  });
  if (!res.ok) {
    throw new Error(`receipt upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  return path;
}

/** A link that works for a few minutes and then does not. */
export async function signedReceiptUrl(path: string): Promise<string | null> {
  try {
    const res = await fetch(`${storageBase()}/object/sign/${BUCKET}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { signedURL?: string };
    return data.signedURL ? `${storageBase()}${data.signedURL}` : null;
  } catch {
    return null;
  }
}

/** Deletes a file uploaded for an entry that was never created. */
export async function removeReceiptPhoto(path: string): Promise<void> {
  await fetch(`${storageBase()}/object/${BUCKET}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${serviceKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ prefixes: [path] }),
  }).catch(() => {});
}

export type ReceiptEntryRow = {
  id: string;
  payment_transaction_id: string | null;
  /** Joined so the history can name the order the way the customer sees it. */
  contact_name?: string | null;
  contact_phone?: string | null;
  payment_transactions?: { shopify_order_id: string | null; amount: number } | null;
  manual_receipt_no: string | null;
  dentiste_net_amount: number;
  keychain_amount: number;
  computed_entries: number;
  entries_override: number | null;
  status: "pending_review" | "approved" | "rejected";
  reject_reason: string | null;
  created_at: string;
};

export const ENTRY_COLUMNS =
  "id,payment_transaction_id,manual_receipt_no,dentiste_net_amount,keychain_amount,computed_entries," +
  "entries_override,status,reject_reason,contact_name,contact_phone,created_at,payment_transactions(shopify_order_id,amount)";

/** The number that counts: what staff decided, or what the order came to. */
export function entriesOf(row: Pick<ReceiptEntryRow, "computed_entries" | "entries_override">): number {
  return row.entries_override ?? row.computed_entries;
}

export async function entriesForUser(campaignKey: string, userId: string): Promise<ReceiptEntryRow[]> {
  return supabaseRest<ReceiptEntryRow[]>(
    `receipt_campaign_entries?campaign_key=eq.${encodeURIComponent(campaignKey)}&user_id=eq.${userId}` +
      `&select=${ENTRY_COLUMNS}&order=created_at.desc&limit=100`
  ).catch(() => []);
}

/**
 * How long a receipt photo is kept after the campaign closes.
 *
 * The photo is evidence for as long as there is anything to dispute — a
 * rejection to appeal, a prize to award, a winner to check. Thirty days past
 * the last of that is long enough, and keeping a customer's order confirmation
 * (name, address, what they bought) any longer than it is useful is just a
 * liability sitting in a bucket.
 */
export const RECEIPT_RETENTION_DAYS = 30;

/**
 * Deletes the photos for receipts older than the retention window, and forgets
 * the paths with them.
 *
 * The row stays: what was decided about a receipt, and the entries it earned,
 * is the record of who won and has to outlive the picture.
 */
export async function purgeExpiredReceiptPhotos(before: Date): Promise<number> {
  const rows = await supabaseRest<{ id: string; receipt_photo_path: string | null }[]>(
    `receipt_campaign_entries?receipt_photo_path=not.is.null&created_at=lt.${before.toISOString()}` +
      `&select=id,receipt_photo_path&limit=500`
  ).catch(() => []);

  let removed = 0;
  for (const row of rows) {
    if (!row.receipt_photo_path) continue;
    try {
      await removeReceiptPhoto(row.receipt_photo_path);
      await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(row.id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ receipt_photo_path: null }),
      });
      removed += 1;
    } catch (err) {
      // One unreachable object should not stop the rest of the sweep; the next
      // run picks it up again.
      console.error("[receipt-photos] purge failed for", row.id, err);
    }
  }

  // The attempt rows carry their own copies of replaced photos.
  const attempts = await supabaseRest<{ id: string; receipt_photo_path: string | null }[]>(
    `receipt_campaign_uploads?receipt_photo_path=not.is.null&created_at=lt.${before.toISOString()}` +
      `&select=id,receipt_photo_path&limit=500`
  ).catch(() => []);
  for (const row of attempts) {
    if (!row.receipt_photo_path) continue;
    try {
      await removeReceiptPhoto(row.receipt_photo_path);
      await supabaseRest(`receipt_campaign_uploads?id=eq.${pgValue(row.id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ receipt_photo_path: null }),
      });
      removed += 1;
    } catch (err) {
      console.error("[receipt-photos] purge failed for upload", row.id, err);
    }
  }

  return removed;
}
