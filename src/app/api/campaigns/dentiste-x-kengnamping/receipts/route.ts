import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { isRateLimitedShared } from "@/lib/rate-limit";
import {
  TEST_MARKER,
  amountsFromLineItems,
  computeEntries,
  isTestMode,
  withinCampaign,
  type LineItem,
} from "@/lib/receipt-campaign";
import { checkReceiptPhoto } from "@/lib/receipt-vision";
import { orderNameByGid, orderNamesByGid } from "@/lib/shopify-admin";
import { loadCampaignContent, windowOf } from "@/lib/receipt-campaign-content";
import { holdsPrize } from "@/lib/receipt-campaign";
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

const CAMPAIGN = "dentiste-x-kengnamping";

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

/** Every paid order of this customer that the campaign would accept. */
async function eligibleOrders(userId: string, anyOrder = false): Promise<TxRow[]> {
  const [rows, content] = await Promise.all([
    supabaseRest<TxRow[]>(
      `payment_transactions?user_id=eq.${pgValue(userId)}&status=eq.success` +
        `&select=id,invoice_no,amount,confirmed_at,line_items,shopify_order_id&order=confirmed_at.desc&limit=100`
    ).catch(() => [] as TxRow[]),
    loadCampaignContent(CAMPAIGN),
  ]);
  const window = windowOf(content);
  return rows.filter(
    (tx) => withinCampaign(tx.confirmed_at, anyOrder, window) && amountsFromLineItems(tx.line_items).dentisteAmount > 0
  );
}

export async function GET(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return unauthorised();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const test = isTestMode(req.nextUrl.searchParams.get("test"));
  const [orders, entries, uploads, profile, prizes] = await Promise.all([
    eligibleOrders(uid, test),
    entriesForUser(CAMPAIGN, uid),
    supabaseRest<UploadRow[]>(
      `receipt_campaign_uploads?user_id=eq.${pgValue(uid)}` +
        `&select=id,entry_id,ai_check,is_current,created_at&order=created_at.desc&limit=60`
    ).catch(() => [] as UploadRow[]),
    // Every drawn place for this campaign, not only this customer's: whether
    // they hold a prize depends on who above them gave theirs up.
    // The account's own name and number, as the first guess at who to call.
    supabaseRest<{ display_name: string | null; phone: string | null }[]>(
      `users?id=eq.${pgValue(uid)}&select=display_name,phone&limit=1`
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
  // the ones they already did.
  const names = await orderNamesByGid([
    ...orders.map((tx) => tx.shopify_order_id),
    ...entries.map((e) => e.payment_transactions?.shopify_order_id),
  ]);
  const nameOf = (gid: string | null | undefined) => names.get(gid ?? "") ?? null;

  return NextResponse.json(
    {
      ok: true,
      test,
      prizes: myPrizes,
      // Their last answer wins over the account's: someone who corrected the
      // name on a previous receipt meant it.
      profile: {
        name: entries[0]?.contact_name ?? profile[0]?.display_name ?? "",
        phone: entries[0]?.contact_phone ?? profile[0]?.phone ?? "",
      },
      orders: orders.map((tx) => {
        const amounts = amountsFromLineItems(tx.line_items);
        return {
          id: tx.id,
          orderNumber: nameOf(tx.shopify_order_id),
          invoiceNo: tx.invoice_no,
          paidAt: tx.confirmed_at,
          total: Number(tx.amount),
          dentisteAmount: amounts.dentisteAmount,
          keychainAmount: amounts.keychainAmount,
          entries: computeEntries(amounts),
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

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return unauthorised();
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  // Uploading costs storage and review time; a person sends a handful.
  if (await isRateLimitedShared(`receipt:${uid}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "ส่งใบเสร็จบ่อยเกินไป กรุณาลองใหม่ในอีกสักครู่" }, { status: 429 });
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
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return NextResponse.json({ ok: false, error: "กรุณาเลือกคำสั่งซื้อ" }, { status: 400 });
  }

  // Who to call about a prize. Asked at the moment they send the receipt
  // rather than chased in November, when a winner has a deadline to meet.
  const contactName = String(form?.get("contactName") ?? "").trim().slice(0, 120);
  const contactPhone = String(form?.get("contactPhone") ?? "").replace(/[^0-9+]/g, "").slice(0, 20);
  if (contactName.length < 2) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ-นามสกุล" }, { status: 400 });
  }
  if (contactPhone.replace(/\D/g, "").length < 9) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกเบอร์โทรให้ครบถ้วน" }, { status: 400 });
  }

  // The order has to be theirs, paid, inside the window and actually contain
  // Dentiste — checked here rather than trusted from the form.
  const test = isTestMode(req.nextUrl.searchParams.get("test"));
  const orders = await eligibleOrders(uid, test);
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    return NextResponse.json(
      { ok: false, error: "ไม่พบคำสั่งซื้อนี้ หรือไม่เข้าเงื่อนไขของแคมเปญ" },
      { status: 409 }
    );
  }

  const amounts = amountsFromLineItems(order.line_items);
  const bytes = await photo.arrayBuffer();

  // Read before storing: the customer is still here, and a photo that cannot
  // be read is worth saying so about now rather than in a rejection later.
  // Never blocks — a check that fails to run leaves the receipt exactly where
  // it would have been anyway, in front of a person.
  const aiCheck = await checkReceiptPhoto({
    bytes,
    contentType: photo.type,
    order: {
      orderNumber: await orderNameByGid(order.shopify_order_id),
      invoiceNo: order.invoice_no,
      total: Number(order.amount),
      paidAt: order.confirmed_at,
      items: (order.line_items ?? []).map((li) => `variant ${li.variantId} x${li.quantity}`),
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
    dentiste_net_amount: amounts.dentisteAmount,
    keychain_amount: amounts.keychainAmount,
    computed_entries: computeEntries(amounts),
    status: "pending_review",
    reject_reason: null,
    // Whatever a reviewer decided about the old photo does not carry over.
    entries_override: null,
    reviewed_by: null,
    reviewed_at: null,
  };

  try {
    const [existing] = await supabaseRest<{ id: string; receipt_photo_path: string }[]>(
      `receipt_campaign_entries?campaign_key=eq.${CAMPAIGN}&payment_transaction_id=eq.${pgValue(order.id)}` +
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
          payment_transaction_id: order.id,
          ...(test ? { manual_receipt_no: TEST_MARKER } : {}),
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
      entry: { id: entryId, status: "pending_review", entries: computeEntries(amounts), aiCheck },
    });
  } catch (err) {
    // No row means the photo is litter; it holds someone's address.
    await removeReceiptPhoto(path);
    console.error("[receipts] could not record entry", err);
    return NextResponse.json({ ok: false, error: "บันทึกใบเสร็จไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
