import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { emailConfigured, sendEmail } from "@/lib/email";
import { abandonedCheckoutEmail } from "@/lib/email-order";
import { SITE_URL } from "@/lib/site-url";

// A reminder to the people who got as far as the payment page and stopped.
//
// What this is NOT: a cart-abandonment mailer. The cart lives in the
// browser's localStorage (src/lib/cart-context.tsx) and never reaches a
// server, so "added things and left" cannot be seen from here at all, and
// most of those people are guests whose address we have never had. What can
// be seen is a payment_transactions row created and never completed — which
// means they typed in an email and a shipping address first. Fewer people,
// far closer to buying, and the only ones we can lawfully and accurately
// write to.
//
// Everything below is built to be boring about who it writes to. An email
// nobody asked for, sent twice, about a cart from six weeks ago, is worse
// than sending nothing at all.

/** Off unless switched on. The first deploy of this must email nobody. */
export function abandonedCheckoutEnabled() {
  return process.env.ABANDONED_CHECKOUT_ENABLED === "true";
}

// How long to wait before nudging, and how long before it is too late to be
// welcome. Someone who stepped away for ten minutes does not need an email;
// someone whose cart is three days old has moved on, and writing to them
// reads as the shop trawling old records.
const MIN_AGE_MINUTES = Number(process.env.ABANDONED_CHECKOUT_MIN_AGE_MINUTES ?? 60);
const MAX_AGE_HOURS = Number(process.env.ABANDONED_CHECKOUT_MAX_AGE_HOURS ?? 24);

type Row = {
  invoice_no: string;
  contact_email: string | null;
  amount: string | number | null;
  line_items: { title?: string; name?: string; quantity?: number }[] | null;
  created_at: string;
};

export type Candidate = {
  invoice: string;
  email: string;
  total: number;
  items: { title?: string; name?: string; quantity?: number }[];
  createdAt: string;
};

export type Skipped = { invoice: string; reason: string };

/**
 * Who is eligible, and who was considered and passed over.
 *
 * The skipped list is the point of the shape: this is a job that writes to
 * customers unprompted, so being able to read back why someone was left out
 * matters as much as the sending.
 */
export async function findAbandoned(now = new Date()): Promise<{ send: Candidate[]; skipped: Skipped[] }> {
  const newest = new Date(now.getTime() - MIN_AGE_MINUTES * 60_000).toISOString();
  const oldest = new Date(now.getTime() - MAX_AGE_HOURS * 3_600_000).toISOString();

  const rows = await supabaseRest<Row[]>(
    `payment_transactions?status=eq.pending` +
      `&contact_email=not.is.null` +
      `&created_at=gte.${encodeURIComponent(oldest)}` +
      `&created_at=lte.${encodeURIComponent(newest)}` +
      `&select=invoice_no,contact_email,amount,line_items,created_at&order=created_at.asc&limit=200`
  ).catch((): Row[] => []);

  const send: Candidate[] = [];
  const skipped: Skipped[] = [];

  for (const row of rows) {
    const email = (row.contact_email ?? "").trim().toLowerCase();
    const items = row.line_items ?? [];
    const total = Number(row.amount ?? 0);

    if (!email) {
      skipped.push({ invoice: row.invoice_no, reason: "no email" });
      continue;
    }
    if (items.length === 0 || total <= 0) {
      skipped.push({ invoice: row.invoice_no, reason: "empty cart" });
      continue;
    }
    // They bought something after this attempt — a reminder about the basket
    // they abandoned on the way there is the shop not paying attention.
    if (await boughtSince(email, row.created_at)) {
      skipped.push({ invoice: row.invoice_no, reason: "bought afterwards" });
      continue;
    }
    send.push({ invoice: row.invoice_no, email, total, items, createdAt: row.created_at });
  }

  return { send, skipped };
}

async function boughtSince(email: string, since: string): Promise<boolean> {
  const rows = await supabaseRest<{ invoice_no: string }[]>(
    `payment_transactions?status=eq.success` +
      `&contact_email=ilike.${encodeURIComponent(email)}` +
      `&created_at=gte.${encodeURIComponent(since)}` +
      `&select=invoice_no&limit=1`
  ).catch((): { invoice_no: string }[] => []);
  return rows.length > 0;
}

/**
 * Claims the right to write about this basket, once and for all.
 *
 * Shares the dedupe table with the order emails: the id namespace does not
 * collide, since one side is keyed by Shopify order id and this one by the
 * invoice number the checkout minted. A second table would have been a second
 * thing to remember.
 */
async function claim(invoice: string, email: string): Promise<boolean> {
  const rows = await supabaseRest<{ id: string }[]>("email_order_notifications?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ id: `${invoice}:abandoned`, email, kind: "abandoned", order_name: invoice }),
  }).catch((): { id: string }[] => []);
  return rows.length > 0;
}

async function release(invoice: string) {
  await supabaseRest(`email_order_notifications?id=eq.${pgValue(`${invoice}:abandoned`)}`, {
    method: "DELETE",
    returning: false,
  }).catch(() => {});
}

export type RunResult = {
  dryRun: boolean;
  enabled: boolean;
  considered: number;
  sent: string[];
  alreadySent: string[];
  failed: string[];
  skipped: Skipped[];
};

/**
 * The run.
 *
 * `dryRun` is the default on purpose for the switch being off: a job whose
 * whole job is writing to customers should be readable before it is
 * believable, and this way the first look costs nobody an email.
 */
export async function runAbandonedCheckout(opts: { dryRun?: boolean } = {}): Promise<RunResult> {
  const enabled = abandonedCheckoutEnabled();
  const dryRun = opts.dryRun ?? !enabled;

  if (!supabaseConfigured()) {
    return { dryRun, enabled, considered: 0, sent: [], alreadySent: [], failed: [], skipped: [{ invoice: "-", reason: "supabase not configured" }] };
  }
  if (!dryRun && !emailConfigured()) {
    return { dryRun, enabled, considered: 0, sent: [], alreadySent: [], failed: [], skipped: [{ invoice: "-", reason: "RESEND_API_KEY not set" }] };
  }

  const { send, skipped } = await findAbandoned();
  const result: RunResult = { dryRun, enabled, considered: send.length + skipped.length, sent: [], alreadySent: [], failed: [], skipped };

  for (const candidate of send) {
    if (dryRun) {
      result.sent.push(candidate.invoice);
      continue;
    }
    if (!(await claim(candidate.invoice, candidate.email))) {
      result.alreadySent.push(candidate.invoice);
      continue;
    }
    const mail = abandonedCheckoutEmail({
      cartUrl: `${SITE_URL}/cart`,
      total: candidate.total,
      items: candidate.items,
    });
    try {
      await sendEmail(candidate.email, mail.subject, mail.html);
      result.sent.push(candidate.invoice);
    } catch (err) {
      await release(candidate.invoice);
      result.failed.push(candidate.invoice);
      console.error(`[abandoned-checkout] ${candidate.invoice} failed`, err);
    }
  }

  return result;
}
