import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isRateLimitedShared } from "@/lib/rate-limit";
import { ipLimited, TOO_MANY_TH } from "@/lib/abuse-guard";
import {
  TEST_MARKER,
  amountsFromLineItems,
  computeEntries,
  isTestMode,
  withinCampaign,
  type LineItem,
} from "@/lib/receipt-campaign";
import { checkReceiptPhoto, readMoment } from "@/lib/receipt-vision";
import {
  findPaidOrderForProduct,
  orderNameByGid,
  orderNamesByGid,
  orderPaymentByGid,
  ordersByName,
  normalizeOrderName,
} from "@/lib/shopify-admin";
import { loadCampaignContent, windowOf } from "@/lib/receipt-campaign-content";
import { orderNumberClaim } from "@/lib/receipt-campaign-claims";
import { holdsPrize, VIP_SLUGS, type CampaignRules } from "@/lib/receipt-campaign";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";
import { eligibleOrders } from "@/lib/receipt-campaign-orders";
import {
  ENTRY_COLUMNS,
  MAX_RECEIPT_BYTES,
  entriesForUser,
  entriesOf,
  receiptExtension,
  removeReceiptPhoto,
  uploadReceiptPhoto,
  type ReceiptEntryRow,
} from "@/lib/receipt-photos";

// The customer's side of the receipt campaign: which of their orders can be
// entered, and sending one in.
//
// The amount is read from the order, never from what the browser sends —
// a request that could name its own total is a request that can name ฿100,000.
// The photo still matters: it is what the conditions ask the customer to keep,
// and what a reviewer compares against the order before approving anything.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";



type TxRow = {
  id: string;
  invoice_no: string;
  amount: number;
  confirmed_at: string | null;
  line_items: LineItem[] | null;
  shopify_order_id: string | null;
};

// The number a customer knows an order by is its Shopify *name* ("#4292"),
// not the id we store to address it with. Looked up rather than derived —
// deriving it produced "#7743402541207", which matches nothing they hold.

type UploadRow = {
  id: string;
  entry_id: string;
  ai_check: { verdict: "ok" | "unclear" | "mismatch"; message: string } | null;
  is_current: boolean;
  created_at: string;
};

type WinnerRow = {
  id: string;
  user_id: string;
  prize_type: "vip" | "lucky_fan";
  rank: number;
  status: "pending_confirm" | "confirmed" | "forfeited";
  confirm_deadline: string;
};

function unauthorised() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนส่งใบเสร็จ" }, { status: 401 });
}

export async function GET(req: NextRequest, props: { params: Promise<{ campaign: string }> }) {
  const CAMPAIGN = campaignKeyFrom((await props.params).campaign);
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return unauthorised();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const test = isTestMode(req.nextUrl.searchParams.get("test"));
  const [{ orders, rules }, entries, uploads, profile, emailIdentity, prizes] = await Promise.all([
    eligibleOrders(CAMPAIGN, uid, test),
    entriesForUser(CAMPAIGN, uid),
    supabaseRest<UploadRow[]>(
      `receipt_campaign_uploads?user_id=eq.${pgValue(uid)}` +
        `&select=id,entry_id,ai_check,is_current,created_at&order=created_at.desc&limit=60`
    ).catch(() => [] as UploadRow[]),
    // Every drawn place for this campaign, not only this customer's: whether
    // they hold a prize depends on who above them gave theirs up.
    // The account's own name and number, as the first guess at who to call.
    supabaseRest<{ display_name: string | null; phone: string | null; shopify_customer_id: string | null }[]>(
      `users?id=eq.${pgValue(uid)}&select=display_name,phone,shopify_customer_id&limit=1`
    ).catch(() => []),
    // The address they signed in with — a verified one, since signing in is
    // what verified it. Shown in the form rather than used silently: the
    // account's address and the one they want a prize sent to are allowed to
    // differ, and they should be able to see which one we have.
    supabaseRest<{ provider_uid: string }[]>(
      `auth_identities?user_id=eq.${pgValue(uid)}&provider=eq.email&select=provider_uid&limit=1`
    ).catch(() => []),
    supabaseRest<WinnerRow[]>(
      `receipt_campaign_winners?campaign_key=eq.${CAMPAIGN}` +
        `&select=id,user_id,prize_type,rank,status,confirm_deadline&order=rank`
    ).catch(() => [] as WinnerRow[]),
  ]);

  // What this customer is holding right now, in the words they need: the prize,
  // the deadline, and whether they have answered yet.
  const holding = new Set<string>();
  for (const type of ["vip", "lucky_fan"] as const) {
    for (const w of holdsPrize(prizes.filter((p) => p.prize_type === type))) holding.add(w.id);
  }
  const myPrizes = prizes
    .filter((p) => p.user_id === uid && holding.has(p.id))
    .map((p) => ({
      id: p.id,
      prizeType: p.prize_type,
      rank: p.rank,
      status: p.status,
      confirmDeadline: p.confirm_deadline,
    }));
  const used = new Set(entries.map((e) => e.payment_transaction_id).filter(Boolean));
  // One lookup for every order on the page — the ones they can still send and
  // the ones they already did. The payment status comes back with the number
  // because a receipt whose money went back is not a purchase any more, and
  // the running total on this page said otherwise for as long as it only
  // asked for names.
  const payments = await orderPaymentByGid([
    ...orders.map((tx) => tx.shopify_order_id),
    ...entries.map((e) => e.payment_transactions?.shopify_order_id),
  ]);
  const nameOf = (gid: string | null | undefined) => payments.get(gid ?? "")?.name ?? null;
  /** Shopify's word for money that is not staying with the shop. */
  const RETURNED = new Set(["REFUNDED", "VOIDED", "EXPIRED"]);
  const refundedGid = (gid: string | null | undefined) => {
    const payment = payments.get(gid ?? "");
    if (!payment) return false;
    return payment.refunded > 0 || RETURNED.has((payment.financialStatus ?? "").toUpperCase());
  };

  // Did they buy the VIP set? Asked of Shopify rather than of our own orders:
  // payment_transactions only has a row when the checkout went through 2C2P on
  // this site, and the set is a pre-order most of its twenty-five buyers placed
  // some other way — the same gap that had every receipt in this campaign
  // computing to zero. Failing open costs a card, not a claim.
  const shopifyCustomerId = profile[0]?.shopify_customer_id ?? null;
  const vipOrder = shopifyCustomerId
    ? await (async () => {
        for (const slug of VIP_SLUGS) {
          const found = await findPaidOrderForProduct(shopifyCustomerId, slug).catch(() => null);
          if (found) return found;
        }
        return null;
      })()
    : null;

  return NextResponse.json(
    {
      ok: true,
      test,
      prizes: myPrizes,
      /** The VIP set, if this customer owns one — the card on the form. */
      vip: vipOrder ? { orderNumber: vipOrder.orderName, paidAt: vipOrder.paidAt } : null,
      // The same window the submit checks against, so the form can refuse a
      // date the server would only reject after an upload.
      window: windowOf(await loadCampaignContent(CAMPAIGN)),
      // Their last answer wins over the account's: someone who corrected the
      // name on a previous receipt meant it.
      profile: {
        name: entries[0]?.contact_name ?? profile[0]?.display_name ?? "",
        phone: entries[0]?.contact_phone ?? profile[0]?.phone ?? "",
        // Whatever they last told us, else the address they signed in with.
        email: entries[0]?.contact_email ?? emailIdentity[0]?.provider_uid ?? "",
      },
      orders: orders.map((tx) => {
        const amounts = amountsFromLineItems(tx.line_items, rules);
        return {
          id: tx.id,
          orderNumber: nameOf(tx.shopify_order_id),
          invoiceNo: tx.invoice_no,
          paidAt: tx.confirmed_at,
          total: Number(tx.amount),
          dentisteAmount: amounts.dentisteAmount,
          keychainAmount: amounts.keychainAmount,
          entries: computeEntries(amounts, rules),
          alreadySent: used.has(tx.id),
        };
      }),
      entries: entries.map((e) => ({
        id: e.id,
        paymentTransactionId: e.payment_transaction_id,
        // The number the customer knows the order by, not our invoice.
        orderNumber: nameOf(e.payment_transactions?.shopify_order_id) ?? e.manual_receipt_no,
        orderTotal: e.payment_transactions ? Number(e.payment_transactions.amount) : null,
        dentisteAmount: Number(e.dentiste_net_amount),
        keychainAmount: Number(e.keychain_amount),
        // Refunded in Shopify since it was sent — the entry stays in their
        // history, because it happened, but it stops counting towards
        // anything.
        refunded: refundedGid(e.payment_transactions?.shopify_order_id),
        status: e.status,
        rejectReason: e.reject_reason,
        entries: entriesOf(e),
        createdAt: e.created_at,
      })),
      // Every photo they have sent, newest first — including the ones replaced
      // by a later attempt, which is the part they cannot otherwise see.
      uploads: uploads.map((u) => ({
        id: u.id,
        entryId: u.entry_id,
        current: u.is_current,
        aiVerdict: u.ai_check?.verdict ?? null,
        aiMessage: u.ai_check?.message ?? null,
        createdAt: u.created_at,
      })),
      // What counts so far. Only approved receipts do.
      approvedEntries: entries.filter((e) => e.status === "approved").reduce((n, e) => n + entriesOf(e), 0),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * What a receipt with no order still has to satisfy.
 *
 * Everything the order row would have answered is now the customer's word, so
 * each of these is a door that word could otherwise walk through: a receipt
 * dated outside the campaign, a number that is really one of their own orders
 * (which belongs in the normal path, where it earns computed entries), and an
 * account sending an unbounded pile of them for a reviewer to wade through.
 */
async function checkManual(opts: {
  campaign: string;
  uid: string;
  orders: { shopify_order_id: string | null; invoice_no: string }[];
  declaredOrderNumber: string | null;
  declaredPaidAt: string | null;
  declaredTotal: number | null;
  window: { opensAt: number; closesAt: number };
  digitsOf: (v: string | null | undefined) => string;
}): Promise<NextResponse | null> {
  const { campaign, uid, declaredOrderNumber, declaredPaidAt, declaredTotal, window, digitsOf } = opts;

  if (!declaredOrderNumber || digitsOf(declaredOrderNumber).length < 3) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกเลขคำสั่งซื้อจากใบเสร็จ" }, { status: 400 });
  }
  if (!declaredTotal) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกยอดรวมจากใบเสร็จ" }, { status: 400 });
  }
  // Asked for, now, rather than left to the reviewer. It is often not printed
  // in the body of an order-confirmation screenshot — the time is there and
  // the date sits up in the mail app's own header — so this does cost some
  // customers a look back at their inbox. The trade is that every claim
  // arrives placeable inside the campaign window without opening the photo.
  if (!declaredPaidAt) {
    return NextResponse.json(
      { ok: false, error: "กรุณากรอกวันและเวลาที่ชำระเงินจากใบเสร็จ" },
      { status: 400 }
    );
  }
  if (declaredPaidAt) {
    const paid = Date.parse(declaredPaidAt);
    if (!Number.isFinite(paid) || paid < window.opensAt || paid > window.closesAt) {
      return NextResponse.json(
        { ok: false, error: "วันที่ชำระเงินอยู่นอกช่วงกิจกรรม — ตรวจวันที่บนใบเสร็จอีกครั้ง" },
        { status: 400 }
      );
    }
    // The window alone does not catch this: it runs to late October, so a
    // receipt "paid" tomorrow is inside it. Both claims received so far were
    // dated after the moment they were submitted — a slip in the date picker,
    // not a fraud, but one nothing was telling the customer about.
    if (paid > Date.now() + 60_000) {
      return NextResponse.json(
        { ok: false, error: "วันที่ชำระเงินเป็นเวลาในอนาคต — ตรวจวันที่บนใบเสร็จอีกครั้ง" },
        { status: 400 }
      );
    }
  }

  const [pending] = await supabaseRest<{ id: string }[]>(
    `receipt_campaign_entries?campaign_key=eq.${pgValue(campaign)}&user_id=eq.${pgValue(uid)}` +
      `&payment_transaction_id=is.null&status=eq.pending_review&select=id&limit=6`
  ).catch(() => []);
  if (pending) {
    const rows = await supabaseRest<{ id: string }[]>(
      `receipt_campaign_entries?campaign_key=eq.${pgValue(campaign)}&user_id=eq.${pgValue(uid)}` +
        `&payment_transaction_id=is.null&status=eq.pending_review&select=id&limit=20`
    ).catch(() => []);
    if (rows.length >= 5) {
      return NextResponse.json(
        { ok: false, error: "มีใบเสร็จเคสพิเศษรอตรวจอยู่หลายรายการแล้ว กรุณารอทีมงานตรวจก่อนส่งเพิ่ม" },
        { status: 429 }
      );
    }
  }
  return null;
}

/** Digits only: "#4292", "4292" and " 4292 " are the same order number. */
const digitsOfRaw = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

export async function POST(req: NextRequest, props: { params: Promise<{ campaign: string }> }) {
  const CAMPAIGN = campaignKeyFrom((await props.params).campaign);
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return unauthorised();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  // Uploading costs storage and review time; a person sends a handful.
  if (await isRateLimitedShared(`receipt:${uid}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "ส่งใบเสร็จบ่อยเกินไป กรุณาลองใหม่ในอีกสักครู่" }, { status: 429 });
  }
  // Per address as well as per account: every call here is a model call we pay
  // for, and an account is the cheapest thing in this system to make more of.
  if (await ipLimited(req, "receipt", 40, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: TOO_MANY_TH }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const photo = form?.get("photo");
  const orderId = typeof form?.get("orderId") === "string" ? (form.get("orderId") as string) : "";

  if (!(photo instanceof File)) {
    return NextResponse.json({ ok: false, error: "กรุณาแนบรูปใบเสร็จ" }, { status: 400 });
  }
  if (photo.size > MAX_RECEIPT_BYTES) {
    return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกินไป (ไม่เกิน 8MB)" }, { status: 400 });
  }
  if (!receiptExtension(photo.type)) {
    return NextResponse.json({ ok: false, error: "รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP" }, { status: 400 });
  }
  // The receipt of an order this site has no record of.
  //
  // It happens: the card cleared and the order never got written, the customer
  // bought through a channel that does not reach this table, our own webhook
  // missed. Refusing the upload leaves them with a receipt, a prize they
  // qualify for and no way to say so — so it is taken, marked, and decided by
  // a person instead of by a join.
  const manual = String(form?.get("manual") ?? "") === "1";
  if (!manual && !/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ ok: false, error: "กรุณาเลือกคำสั่งซื้อ" }, { status: 400 });
  }

  // Who to call about a prize. Asked at the moment they send the receipt
  // rather than chased in November, when a winner has a deadline to meet.
  const contactName = String(form?.get("contactName") ?? "").trim().slice(0, 120);
  const contactPhone = String(form?.get("contactPhone") ?? "").replace(/[^0-9+]/g, "").slice(0, 20);
  const contactEmail = String(form?.get("contactEmail") ?? "").trim().slice(0, 160).toLowerCase() || null;
  if (contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contactEmail)) {
    return NextResponse.json({ ok: false, error: "อีเมลไม่ถูกต้อง — ตรวจอีกครั้งนะคะ" }, { status: 400 });
  }
  if (contactName.length < 2) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ-นามสกุล" }, { status: 400 });
  }
  // Ten digits from 0, or the +66 form of the same number — the rule the form
  // applies, applied again to whatever actually arrives. The name is left at
  // "two characters" rather than the form's "two words": the form asks for a
  // full name because a prize is collected with an ID card, but somebody whose
  // legal name is one word should not find the door locked.
  const phoneDigits = contactPhone.replace(/\D/g, "");
  const localPhone = phoneDigits.startsWith("66") ? `0${phoneDigits.slice(2)}` : phoneDigits;
  if (localPhone.length !== 10 || !localPhone.startsWith("0")) {
    return NextResponse.json(
      { ok: false, error: "เบอร์โทรต้องมี 10 หลัก เช่น 0812345678" },
      { status: 400 }
    );
  }

  // The customer's own reading of their receipt. Stored beside the photo for a
  // reviewer to compare against, and deliberately nowhere near the arithmetic
  // below — a number typed into a form must not be able to earn an entry.
  const declaredOrderNumber = String(form?.get("declaredOrderNumber") ?? "").trim().slice(0, 40) || null;
  // The form sends Bangkok wall-clock time; the column keeps the moment.
  const declaredLocal = readMoment(String(form?.get("declaredPaidAt") ?? ""));
  const declaredPaidAt = declaredLocal ? `${declaredLocal}:00+07:00` : null;
  const declaredTotalRaw = Number(String(form?.get("declaredTotal") ?? "").replace(/[^0-9.]/g, ""));
  // A million baht of Dentiste is a typo, not a receipt.
  const declaredTotal =
    Number.isFinite(declaredTotalRaw) && declaredTotalRaw > 0 && declaredTotalRaw <= 1_000_000
      ? declaredTotalRaw
      : null;

  // The order has to be theirs, paid, inside the window and actually contain
  // Dentiste — checked here rather than trusted from the form.
  const test = isTestMode(req.nextUrl.searchParams.get("test"));
  const { orders, rules } = await eligibleOrders(CAMPAIGN, uid, test);
  // Which order the receipt names, worked out here rather than on the form.
  //
  // The customer's screen used to match the typed number against their own
  // orders and show a verdict, which made "is this purchase real" a question
  // asked of the person who cannot answer it. It is asked here, and where the
  // answer is no the receipt still goes through — to a reviewer, marked.
  const names = await orderNamesByGid(orders.map((o) => o.shopify_order_id));
  const typed = digitsOfRaw(declaredOrderNumber);
  const matched =
    manual && typed
      ? orders.find((o) => digitsOfRaw(names.get(o.shopify_order_id ?? "") ?? null) === typed)
      : undefined;

  const order = manual ? matched : orders.find((o) => o.id === orderId);
  if (!manual && !order) {
    return NextResponse.json(
      { ok: false, error: "ไม่พบคำสั่งซื้อนี้ หรือไม่เข้าเงื่อนไขของแคมเปญ" },
      { status: 409 }
    );
  }

  // Somebody else's claim on this number stops here, whichever path it came
  // in by. A rejected or revoked claim does not hold the number.
  const claimedNumber = order ? (names.get(order.shopify_order_id ?? "") ?? declaredOrderNumber) : declaredOrderNumber;
  const claim = await orderNumberClaim({ campaign: CAMPAIGN, userId: uid, number: claimedNumber }).catch(() => ({
    taken: false,
    byMe: false,
  }));
  if (claim.taken && !claim.byMe) {
    return NextResponse.json(
      {
        ok: false,
        error: `เลขคำสั่งซื้อ ${claimedNumber} ถูกใช้ไปแล้ว — ถ้าเป็นของคุณ ทักทีมงานได้เลยค่ะ`,
      },
      { status: 409 }
    );
  }

  const digitsOf = digitsOfRaw;
  if (manual && !order) {
    const stop = await checkManual({
      campaign: CAMPAIGN,
      uid,
      orders,
      declaredOrderNumber,
      declaredPaidAt,
      declaredTotal,
      window: windowOf(await loadCampaignContent(CAMPAIGN)),
      digitsOf,
    });
    if (stop) return stop;
  }

  // A manual receipt used to compute to nothing: payment_transactions has no
  // row for it, so there were no line items to read and every number on it was
  // the customer's word until a reviewer typed theirs. Every claim this
  // campaign has received so far came in that way, which made "the reviewer
  // types it" the normal path rather than the exception it was written as.
  //
  // The order number is checkable, so it is checked: an order that exists in
  // the shop, under that number, and is still PAID, brings its own lines. The
  // lookup fails open — Shopify being unreachable leaves the entry exactly
  // where it would have been anyway, at zero in front of a person.
  let amounts = order
    ? amountsFromLineItems(order.line_items, rules)
    : { dentisteAmount: 0, keychainAmount: 0 };
  let computed = order ? computeEntries(amounts, rules) : 0;

  if (!order && declaredOrderNumber) {
    const key = normalizeOrderName(declaredOrderNumber);
    const claimed = key ? (await ordersByName([key]).catch(() => new Map())).get(key) : null;
    if (claimed && (!claimed.financialStatus || claimed.financialStatus.toUpperCase() === "PAID")) {
      amounts = amountsFromLineItems(claimed.lineItems, rules);
      computed = computeEntries(amounts, rules);
    }
  }
  const bytes = await photo.arrayBuffer();

  // Read before storing: the customer is still here, and a photo that cannot
  // be read is worth saying so about now rather than in a rejection later.
  // Never blocks — a check that fails to run leaves the receipt exactly where
  // it would have been anyway, in front of a person.
  const aiCheck = await checkReceiptPhoto({
    bytes,
    contentType: photo.type,
    // With no order, the photo is checked against what the customer typed —
    // which is the comparison a reviewer would make first anyway. What matters
    // is that `facts` says so: the same comparison reported as "ตรงกับระบบ" is
    // a reviewer being told the shop confirmed something it never saw.
    order: order
      ? {
          facts: "shop",
          orderNumber: await orderNameByGid(order.shopify_order_id),
          invoiceNo: order.invoice_no,
          total: Number(order.amount),
          paidAt: order.confirmed_at,
          items: (order.line_items ?? []).map((li) => `variant ${li.variantId} x${li.quantity}`),
        }
      : {
          facts: "customer",
          orderNumber: declaredOrderNumber,
          invoiceNo: null,
          total: declaredTotal ?? 0,
          paidAt: declaredPaidAt,
          items: [],
        },
  });

  const path = await uploadReceiptPhoto({
    userId: uid,
    bytes,
    contentType: photo.type,
  }).catch((err) => {
    console.error("[receipts] upload failed", err);
    return null;
  });
  if (!path) return NextResponse.json({ ok: false, error: "อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 502 });

  // A second photo for the same order replaces the first rather than becoming a
  // second claim on one purchase — which is what the unique index enforces, and
  // what someone re-sending a clearer photo after a rejection is trying to do.
  const fields = {
    receipt_photo_path: path,
    ai_check: aiCheck,
    contact_name: contactName,
    contact_phone: contactPhone,
    contact_email: contactEmail,
    declared_order_number: declaredOrderNumber,
    declared_paid_at: declaredPaidAt,
    declared_total: declaredTotal,
    dentiste_net_amount: amounts.dentisteAmount,
    keychain_amount: amounts.keychainAmount,
    computed_entries: computed,
    payment_transaction_id: order ? order.id : null,
    manual_receipt_no: order ? null : declaredOrderNumber,
    status: "pending_review",
    reject_reason: null,
    // Whatever a reviewer decided about the old photo does not carry over.
    entries_override: null,
    reviewed_by: null,
    reviewed_at: null,
  };

  try {
    // One entry per order — or, with no order, one per receipt number this
    // customer has sent, so a clearer photo of the same receipt replaces the
    // first rather than becoming a second claim on one purchase.
    const [existing] = await supabaseRest<{ id: string; receipt_photo_path: string }[]>(
      order
        ? `receipt_campaign_entries?campaign_key=eq.${CAMPAIGN}&payment_transaction_id=eq.${pgValue(order.id)}` +
            `&select=id,receipt_photo_path&limit=1`
        : `receipt_campaign_entries?campaign_key=eq.${CAMPAIGN}&user_id=eq.${pgValue(uid)}` +
            `&payment_transaction_id=is.null&manual_receipt_no=eq.${pgValue(declaredOrderNumber ?? "")}` +
            `&select=id,receipt_photo_path&limit=1`
    );

    let entryId: string | undefined;
    if (existing) {
      await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(existing.id)}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify(fields),
      });
      entryId = existing.id;
      // Earlier attempts stop being the one under review but stay in the
      // customer's history — the photo goes with them, because "what did I
      // send" is unanswerable once the picture is gone.
      await supabaseRest(`receipt_campaign_uploads?entry_id=eq.${pgValue(existing.id)}&is_current=is.true`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ is_current: false }),
      }).catch(() => {});
    } else {
      const [row] = await supabaseRest<ReceiptEntryRow[]>("receipt_campaign_entries", {
        method: "POST",
        body: JSON.stringify({
          campaign_key: CAMPAIGN,
          user_id: uid,
          ...(test && order ? { manual_receipt_no: TEST_MARKER } : {}),
          ...fields,
        }),
      });
      entryId = row?.id;
    }

    if (entryId) {
      await supabaseRest("receipt_campaign_uploads", {
        method: "POST",
        returning: false,
        body: JSON.stringify({
          entry_id: entryId,
          user_id: uid,
          receipt_photo_path: path,
          ai_check: aiCheck,
          is_current: true,
        }),
      }).catch((err) => console.error("[receipts] could not record upload", err));
    }

    return NextResponse.json({
      ok: true,
      entry: {
        id: entryId,
        status: "pending_review",
        entries: order ? computeEntries(amounts, rules) : 0,
        manual: !order,
        aiCheck,
      },
    });
  } catch (err) {
    // No row means the photo is litter; it holds someone's address.
    await removeReceiptPhoto(path);
    console.error("[receipts] could not record entry", err);
    return NextResponse.json({ ok: false, error: "บันทึกใบเสร็จไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
