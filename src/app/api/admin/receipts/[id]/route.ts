import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { amountsFromLineItems, computeEntries, type LineItem } from "@/lib/receipt-campaign";
import { ordersByName, normalizeOrderName, orderPaymentByGid } from "@/lib/shopify-admin";
import { loadCampaignContent } from "@/lib/receipt-campaign-content";
import { campaignKeyFrom } from "@/lib/receipt-campaign-keys";
import { removeReceiptPhoto } from "@/lib/receipt-photos";

// Approving or rejecting one receipt.
//
// Approving is what turns a photo into a claim on a ฿55,000 prize, so it is
// written down: who decided, when, and — when they corrected the number — what
// the system had worked out before they did. A prize draw that cannot be
// explained afterwards is one the shop has to defend on its word alone.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which campaign this console is looking at; the first one when unstated. */
const campaignOf = (req: NextRequest) => campaignKeyFrom(req.nextUrl.searchParams.get("campaign"));

/**
 * Work the entries out again from the order behind the receipt.
 *
 * The number stored on an entry is a snapshot of the rules at the moment the
 * photo arrived. Those move: TIERED against FLAT is still an open question
 * with the marketing team, KEYCHAIN_SLUGS is empty until they name the sets,
 * and an order can be refunded after the fact. Re-reading the line items is
 * cheaper and far more trustworthy than asking a reviewer to do the sum.
 *
 * It never touches the status, and it clears any manual override — a reviewer
 * who typed a number over the old calculation was correcting *that* one.
 */
async function recalculate(CAMPAIGN: string, id: string, token: string | undefined) {
  const [entry] = await supabaseRest<
    {
      id: string;
      computed_entries: number;
      entries_override: number | null;
      manual_receipt_no: string | null;
      declared_order_number: string | null;
      payment_transactions: { line_items: LineItem[] | null } | null;
    }[]
  >(
    `receipt_campaign_entries?id=eq.${pgValue(id)}&campaign_key=eq.${CAMPAIGN}` +
      `&select=id,computed_entries,entries_override,manual_receipt_no,declared_order_number,` +
      `payment_transactions(line_items)&limit=1`
  );
  if (!entry) return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 404 });

  // Where the line items come from, most trustworthy first.
  //
  // payment_transactions is our own record of a 2C2P payment taken on this
  // site, so when it exists it is the closest thing to a receipt we have. It
  // only exists for that one checkout path, though, and a customer who paid
  // any other way used to land here with nothing to count — the button said
  // "ไม่ได้ผูกกับคำสั่งซื้อในระบบ" and the entry stayed at zero for a reviewer
  // to type over. The order number they declared is checkable against Shopify,
  // which is the same check the approve step already makes before awarding
  // anything, so its lines are read here too rather than asking a person to do
  // the sum from a photo.
  let lineItems: LineItem[] | null = entry.payment_transactions?.line_items ?? null;
  let source: "payment" | "shopify" = "payment";

  if (!entry.payment_transactions) {
    const key = normalizeOrderName(entry.manual_receipt_no ?? entry.declared_order_number);
    const claimed = key ? (await ordersByName([key]).catch(() => new Map())).get(key) : null;
    if (!claimed) {
      return NextResponse.json(
        { ok: false, error: "ใบเสร็จนี้ไม่มีคำสั่งซื้อให้คำนวณ — ไม่พบทั้งในระบบและในร้าน" },
        { status: 409 }
      );
    }
    // A refunded order is not worth entries, and saying so here is cheaper
    // than letting a reviewer approve a number this button just produced.
    if (claimed.financialStatus && claimed.financialStatus.toUpperCase() !== "PAID") {
      return NextResponse.json(
        {
          ok: false,
          error: `คำนวณไม่ได้ — คำสั่งซื้อ ${claimed.name} ในร้านอยู่ในสถานะ ${claimed.financialStatus} ไม่ใช่ PAID`,
        },
        { status: 409 }
      );
    }
    lineItems = claimed.lineItems;
    source = "shopify";
  }

  // Today's rules, which is the whole point of the button: the stored number
  // is the rules as they were when the photo arrived.
  const { rules } = await loadCampaignContent(CAMPAIGN);
  const amounts = amountsFromLineItems(lineItems, rules);
  const entries = computeEntries(amounts, rules);

  await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      dentiste_net_amount: amounts.dentisteAmount,
      keychain_amount: amounts.keychainAmount,
      computed_entries: entries,
      entries_override: null,
    }),
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      admin_user_id: getAdminSession(token)?.userId ?? null,
      action: "receipt.recalculate",
      target: id,
      detail: {
        campaign: CAMPAIGN,
        before: { entries: entry.computed_entries, override: entry.entries_override },
        after: { entries, dentisteAmount: amounts.dentisteAmount, keychainAmount: amounts.keychainAmount },
        source,
        rules,
        by: getAdminSession(token)?.userId ?? null,
      },
    }),
  }).catch((err) => console.error("[admin/receipts] audit write failed", err));

  return NextResponse.json({ ok: true, entries, dentisteAmount: amounts.dentisteAmount, source });
}

/**
 * The qualifying amounts, as a reviewer corrects them.
 *
 * Recalculating reads the order's own line items, which is right whenever
 * there is an order to read. There is not always: a receipt whose order the
 * shop cannot find, a payment taken outside this site, a bill where the
 * lines are there but tagged wrong — all of them land on a reviewer with a
 * legible photo in front of them and no way to put the number in. Before
 * this the only thing they could type was the entry count, which is the
 * answer rather than the input: it records what a person decided, not what
 * the rules make of what they read, and it goes stale the moment the rules
 * move.
 *
 * So the amounts are what can be typed, and the entries are worked out from
 * them by the same function the recalculation uses. The two buckets stay
 * separate because the rules treat them differently — a threshold per ฿690
 * of DENTISTE', a fixed number of entries per keychain set.
 */
async function setAmounts(CAMPAIGN: string, id: string, token: string | undefined, body: Record<string, unknown>) {
  const read = (v: unknown) => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    // Money, to the satang, and never negative. The ceiling is only there to
    // stop a slipped keyboard from writing a number nobody meant.
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return NaN;
    return Math.round(n * 100) / 100;
  };
  const dentiste = read(body.dentisteAmount);
  const keychain = read(body.keychainAmount);
  if (Number.isNaN(dentiste) || Number.isNaN(keychain)) {
    return NextResponse.json({ ok: false, error: "ยอดเงินไม่ถูกต้อง" }, { status: 400 });
  }
  if (dentiste === null && keychain === null) {
    return NextResponse.json({ ok: false, error: "กรุณาใส่ยอดอย่างน้อยหนึ่งช่อง" }, { status: 400 });
  }

  const [entry] = await supabaseRest<
    {
      id: string;
      dentiste_net_amount: number | string | null;
      keychain_amount: number | string | null;
      computed_entries: number;
      entries_override: number | null;
    }[]
  >(
    `receipt_campaign_entries?id=eq.${pgValue(id)}&campaign_key=eq.${pgValue(CAMPAIGN)}` +
      `&select=id,dentiste_net_amount,keychain_amount,computed_entries,entries_override&limit=1`
  ).catch(() => []);
  if (!entry) return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 404 });

  // A field left out keeps what the receipt already had, so correcting one
  // bucket does not quietly zero the other.
  const was = {
    dentisteAmount: Number(entry.dentiste_net_amount ?? 0),
    keychainAmount: Number(entry.keychain_amount ?? 0),
  };
  const amounts = {
    dentisteAmount: dentiste ?? was.dentisteAmount,
    keychainAmount: keychain ?? was.keychainAmount,
  };

  const { rules } = await loadCampaignContent(CAMPAIGN);
  const entries = computeEntries(amounts, rules);

  await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      dentiste_net_amount: amounts.dentisteAmount,
      keychain_amount: amounts.keychainAmount,
      computed_entries: entries,
      // The typed amount is the correction now; an entry count typed over an
      // older calculation was a correction to that one.
      entries_override: null,
    }),
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      admin_user_id: getAdminSession(token)?.userId ?? null,
      action: "receipt.amounts",
      target: id,
      detail: {
        campaign: CAMPAIGN,
        before: { ...was, entries: entry.computed_entries, override: entry.entries_override },
        after: { ...amounts, entries },
        rules,
        by: getAdminSession(token)?.userId ?? null,
      },
    }),
  }).catch((err) => console.error("[admin/receipts] audit write failed", err));

  return NextResponse.json({ ok: true, entries, ...amounts });
}

/**
 * Puts a decided receipt back in the queue.
 *
 * Approving is a judgement made in a few seconds about somebody's claim on a
 * ฿55,000 prize, and judgements made in a few seconds are sometimes wrong. The
 * alternative to a way back is an admin editing the database by hand, which is
 * the same act without the record of it.
 *
 * The decision is cleared, not overwritten: who decided and why goes to the
 * audit log on the way past, so the history of a receipt survives being
 * changed. A draw already made is not touched — entries move, a drawn result
 * is a record of what happened, and reconciling the two is a person's call.
 */
async function reopen(CAMPAIGN: string, id: string, token: string | undefined) {
  const [entry] = await supabaseRest<
    { id: string; status: string; reject_reason: string | null; revoke_reason: string | null }[]
  >(
    `receipt_campaign_entries?id=eq.${pgValue(id)}&campaign_key=eq.${CAMPAIGN}` +
      `&select=id,status,reject_reason,revoke_reason&limit=1`
  );
  if (!entry) return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 404 });
  if (entry.status === "pending_review") {
    return NextResponse.json({ ok: false, error: "ใบเสร็จนี้อยู่ในคิวตรวจอยู่แล้ว" }, { status: 409 });
  }

  await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: "pending_review",
      reject_reason: null,
      revoked_at: null,
      revoke_reason: null,
      reviewed_by: null,
      reviewed_at: null,
      // A number typed over the old calculation was a correction to a decision
      // that is being taken back with it.
      entries_override: null,
    }),
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      admin_user_id: getAdminSession(token)?.userId ?? null,
      action: "receipt.reopen",
      target: id,
      detail: {
        campaign: CAMPAIGN,
        from: entry.status,
        reason: entry.reject_reason ?? entry.revoke_reason ?? null,
        by: getAdminSession(token)?.userId ?? null,
      },
    }),
  }).catch((err) => console.error("[admin/receipts] audit write failed", err));

  return NextResponse.json({ ok: true });
}

/**
 * The number on the receipt, as a reviewer reads it.
 *
 * Customers copy whatever their slip shows. One wrote 2610002021242 — the
 * 2C2P invoice — for an order the shop calls #4418, so the lookup found
 * nothing, the amount totalled ฿0 and the entries could not be computed. The
 * photo was legible the whole time; only the number was in the wrong
 * alphabet, and nobody could correct it.
 *
 * It writes manual_receipt_no rather than editing what the customer said:
 * their words stay on the record beside the correction, which is what makes
 * the audit trail worth keeping. Then it recalculates, because a number
 * nobody acts on is just another thing to remember to press.
 */
type Claim = {
  id: string;
  status: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  manual_receipt_no: string | null;
  declared_order_number: string | null;
};

const STATUS_WORD: Record<string, string> = {
  pending_review: "รอตรวจ",
  approved: "อนุมัติแล้ว",
  rejected: "ตีกลับแล้ว",
};

/** The digits the unique index is built on — see the index definition. */
const claimDigits = (value: string | null | undefined) => (value ?? "").replace(/\D/g, "");

/**
 * The entry in this campaign that already claims this order number, if any.
 *
 * PostgREST cannot filter on the index's expression, so this casts a wider
 * net on either column and settles it here with the same normalisation the
 * index uses.
 */
async function findClaim(CAMPAIGN: string, typed: string, exceptId: string): Promise<Claim | null> {
  const digits = claimDigits(typed);
  if (!digits) return null;
  const like = encodeURIComponent(`*${digits}*`);
  const rows = await supabaseRest<Claim[]>(
    `receipt_campaign_entries?campaign_key=eq.${pgValue(CAMPAIGN)}` +
      `&or=(manual_receipt_no.ilike.${like},declared_order_number.ilike.${like})` +
      `&select=id,status,contact_name,contact_phone,manual_receipt_no,declared_order_number&limit=50`,
  ).catch((): Claim[] => []);
  return (
    rows.find(
      (row) =>
        row.id !== exceptId &&
        claimDigits(row.manual_receipt_no || row.declared_order_number) === digits,
    ) ?? null
  );
}

/** Said in full: who has it, what state it is in, and what to do about it. */
function claimTakenMessage(claim: Claim) {
  const who = [claim.contact_name?.trim(), claim.contact_phone?.trim()].filter(Boolean).join(" · ");
  const state = STATUS_WORD[claim.status ?? ""] ?? claim.status ?? "ไม่ทราบสถานะ";
  const number = claim.manual_receipt_no || claim.declared_order_number || "";
  return (
    `เลขคำสั่งซื้อ ${number} ถูกใบเสร็จอีกใบใช้ไปแล้ว (${who || "ไม่ระบุชื่อ"} · ${state}) — ` +
    `หนึ่งคำสั่งซื้อรับสิทธิ์ได้ครั้งเดียว ถ้าใบนั้นกรอกเลขผิด ให้ไปแก้หรือตีกลับใบนั้นก่อน แล้วค่อยกลับมาแก้ใบนี้`
  );
}

async function setOrderNumber(
  CAMPAIGN: string,
  id: string,
  token: string | undefined,
  raw: unknown,
) {
  const typed = typeof raw === "string" ? raw.trim().slice(0, 64) : "";
  // Digits are what the lookup normalises to, so a value with none of them
  // can only ever find nothing — better to say so than to save it and let
  // the recalculation below report a failure it was handed.
  if (!/\d/.test(typed)) {
    return NextResponse.json(
      { ok: false, error: "กรุณาใส่เลขคำสั่งซื้อ (ต้องมีตัวเลข)" },
      { status: 400 },
    );
  }

  const [entry] = await supabaseRest<
    { id: string; manual_receipt_no: string | null; declared_order_number: string | null }[]
  >(
    `receipt_campaign_entries?id=eq.${pgValue(id)}&campaign_key=eq.${pgValue(CAMPAIGN)}` +
      `&select=id,manual_receipt_no,declared_order_number&limit=1`,
  ).catch(() => []);
  if (!entry) {
    return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 404 });
  }

  // One order, one claim. The database enforces it on the digits of
  // whichever number is in play (receipt_campaign_entries_one_claim_per_number),
  // and without this check the write throws, Next answers with a 500 that is
  // not JSON, and the reviewer gets "แก้เลขคำสั่งซื้อไม่สำเร็จ" — which is
  // how somebody ends up pressing the same button five times. Looked up
  // first so the answer can say who already has it.
  const taken = await findClaim(CAMPAIGN, typed, id);
  if (taken) {
    return NextResponse.json({ ok: false, error: claimTakenMessage(taken) }, { status: 409 });
  }

  try {
    await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ manual_receipt_no: typed }),
    });
  } catch (err) {
    // The check above lost a race, or the number collides in a way it did not
    // look for. Either way this is the same answer, not a 500.
    if (String(err).includes("receipt_campaign_entries_one_claim_per_number")) {
      const clash = await findClaim(CAMPAIGN, typed, id);
      return NextResponse.json(
        { ok: false, error: clash ? claimTakenMessage(clash) : `เลขคำสั่งซื้อ ${typed} ถูกใช้ไปแล้วในใบเสร็จอื่นของกิจกรรมนี้` },
        { status: 409 },
      );
    }
    console.error("[admin/receipts] order-number save failed", err);
    return NextResponse.json({ ok: false, error: "บันทึกเลขคำสั่งซื้อไม่สำเร็จ" }, { status: 500 });
  }

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      admin_user_id: getAdminSession(token)?.userId ?? null,
      action: "receipt.order_number",
      target: id,
      detail: {
        campaign: CAMPAIGN,
        from: entry.manual_receipt_no,
        to: typed,
        customerTyped: entry.declared_order_number,
      },
    }),
  }).catch(() => {});

  // Straight into the recalculation, which does the looking up: it reads
  // manual_receipt_no first, so it sees the number just written.
  return recalculate(CAMPAIGN, id, token);
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const CAMPAIGN = campaignOf(req);
  const { id } = await props.params;
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const action = body?.action;
  if (action === "recalculate") return recalculate(CAMPAIGN, id, token);
  if (action === "reopen") return reopen(CAMPAIGN, id, token);
  if (action === "order-number") return setOrderNumber(CAMPAIGN, id, token, body?.orderNumber);
  if (action === "amounts") return setAmounts(CAMPAIGN, id, token, body ?? {});
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { ok: false, error: "action ต้องเป็น approve, reject, recalculate, reopen, order-number หรือ amounts" },
      { status: 400 }
    );
  }

  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 300) : "";
  if (action === "reject" && reason.length < 3) {
    // The customer is told this word for word, and it is the only thing they
    // get to act on — "ไม่ผ่าน" with no reason just produces a support ticket.
    return NextResponse.json({ ok: false, error: "กรุณาระบุเหตุผลที่ตีกลับ" }, { status: 400 });
  }

  const override = body?.entries;
  if (override !== undefined && (!Number.isInteger(override) || override < 0 || override > 100)) {
    return NextResponse.json({ ok: false, error: "จำนวนสิทธิ์ไม่ถูกต้อง" }, { status: 400 });
  }

  const [entry] = await supabaseRest<
    {
      id: string;
      computed_entries: number;
      status: string;
      payment_transaction_id: string | null;
      manual_receipt_no: string | null;
      declared_order_number: string | null;
      payment_transactions: { shopify_order_id: string | null } | null;
    }[]
  >(
    `receipt_campaign_entries?id=eq.${pgValue(id)}&campaign_key=eq.${CAMPAIGN}` +
      `&select=id,computed_entries,status,payment_transaction_id,manual_receipt_no,declared_order_number,payment_transactions(shopify_order_id)&limit=1`
  );
  if (!entry) return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 404 });
  if (entry.status !== "pending_review") {
    return NextResponse.json({ ok: false, error: "ใบเสร็จนี้ถูกตรวจไปแล้ว" }, { status: 409 });
  }

  // Approving is the step that turns a photo into a claim on a ฿55,000 prize,
  // so it needs the money to still be there — and our own row cannot say that.
  // payment_transactions.status stays "success" through a refund, a void, and
  // a pre-order that was never captured. Shopify is asked instead, and an
  // unanswered question is treated as a no: an approval we could not verify is
  // the expensive mistake here, while a reviewer waiting five minutes is not.
  // Rejecting stays open — nothing about the money should stop someone saying
  // a photo is wrong.
  //
  // A receipt with no order row at all is the one exception: the customer
  // bought, something on our side lost the order, and the only record is the
  // photo. There is nothing for Shopify to answer about, so the check that
  // stands between it and a prize is a person — which is what this screen is.
  // The entries are theirs to type, because nothing computed them.
  const manual = action === "approve" && !entry.payment_transaction_id && Boolean(entry.manual_receipt_no);
  if (manual && override === undefined) {
    return NextResponse.json(
      { ok: false, error: "ใบเสร็จเคสพิเศษไม่มีคำสั่งซื้อให้คำนวณ กรุณาระบุจำนวนสิทธิ์เอง" },
      { status: 400 }
    );
  }

  // A special case whose number does turn out to be an order in the shop is
  // only special in that we never recorded the purchase — the money is as
  // checkable as any other, and approving a refunded one hands out entries
  // for a purchase that was handed back. The screen says the same thing; this
  // is here so it is true whatever the screen was showing.
  if (action === "approve" && manual) {
    const key = normalizeOrderName(entry.manual_receipt_no ?? entry.declared_order_number);
    const claimed = key ? (await ordersByName([key]).catch(() => new Map())).get(key) : null;
    if (claimed && claimed.financialStatus !== "PAID") {
      return NextResponse.json(
        {
          ok: false,
          error: `อนุมัติไม่ได้ — คำสั่งซื้อ ${claimed.name} ในร้านอยู่ในสถานะ ${claimed.financialStatus ?? "ไม่ทราบ"} ไม่ใช่ PAID`,
        },
        { status: 409 }
      );
    }
  }

  if (action === "approve" && !manual) {
    const gid = entry.payment_transactions?.shopify_order_id ?? null;
    if (!gid) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "ใบเสร็จนี้ยังไม่มีคำสั่งซื้อใน Shopify — เงินเข้าแล้วแต่ออเดอร์สร้างไม่สำเร็จ กรุณาแก้ออเดอร์ให้เรียบร้อยก่อนอนุมัติ",
        },
        { status: 409 }
      );
    }
    const status = (await orderPaymentByGid([gid])).get(gid)?.financialStatus ?? null;
    if (status !== "PAID") {
      return NextResponse.json(
        {
          ok: false,
          error: status
            ? `อนุมัติไม่ได้ — สถานะการชำระเงินของคำสั่งซื้อนี้คือ ${status} ไม่ใช่ PAID`
            : "อนุมัติไม่ได้ — อ่านสถานะการชำระเงินจาก Shopify ไม่ได้ กรุณาลองใหม่อีกครั้ง",
        },
        { status: 409 }
      );
    }
  }

  const adminId = getAdminSession(token)?.userId ?? null;
  const now = new Date().toISOString();

  // The database keeps one live claim per order number, so approving a second
  // claim on a number somebody else already holds is refused down there. Said
  // plainly here, because "approve failed" tells a reviewer nothing and the
  // fact — two people claiming one receipt — is the whole reason to look.
  const decided = await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(id)}&status=eq.pending_review`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({
      status: action === "approve" ? "approved" : "rejected",
      reject_reason: action === "reject" ? reason : null,
      // Only recorded when it differs; an override equal to the calculation is
      // not a correction and should not read like one later.
      ...(action === "approve" && override !== undefined && override !== entry.computed_entries
        ? { entries_override: override }
        : {}),
      reviewed_by: adminId,
      reviewed_at: now,
    }),
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("receipt_campaign_entries_one_claim_per_number") || message.includes("23505")) {
      return "duplicate" as const;
    }
    throw err;
  });

  if (decided === "duplicate") {
    return NextResponse.json(
      {
        ok: false,
        error: `เลขคำสั่งซื้อ ${entry.manual_receipt_no ?? ""} ถูกอนุมัติให้ลูกค้ารายอื่นไปแล้ว — ตรวจว่าใบเสร็จเป็นของใครก่อนอนุมัติ`,
      },
      { status: 409 }
    );
  }

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      admin_user_id: getAdminSession(token)?.userId ?? null,
      action: `receipt.${action}`,
      target: id,
      detail: {
        campaign: CAMPAIGN,
        computedEntries: entry.computed_entries,
        ...(override !== undefined ? { entriesOverride: override } : {}),
        ...(action === "reject" ? { reason } : {}),
      },
    }),
  }).catch((err) => console.error("[admin/receipts] audit write failed", err));

  // Rejection is the only outcome the customer has to do something about, and
  // the bell already exists — see the review flow this mirrors.
  if (action === "reject") {
    const [owner] = await supabaseRest<{ user_id: string }[]>(
      `receipt_campaign_entries?id=eq.${pgValue(id)}&select=user_id&limit=1`
    ).catch(() => []);
    if (owner?.user_id) {
      await supabaseRest("notifications", {
        method: "POST",
        returning: false,
        body: JSON.stringify({
          user_id: owner.user_id,
          type: "receipt_rejected",
          title: "ใบเสร็จของคุณถูกตีกลับ",
          body: `${reason} — ส่งรูปใหม่ได้ที่หน้าแคมเปญ`,
          link: `/campaigns/${CAMPAIGN}`,
          metadata: { campaign_key: CAMPAIGN, entry_id: id },
        }),
      }).catch((err) => console.error("[admin/receipts] notify failed", err));
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Deletes one receipt for good — the row, every photo ever uploaded for it,
 * and the files behind them.
 *
 * Clearing a campaign's test data used to mean somebody with database access
 * writing DELETE by hand, and the photos then stayed in the bucket because
 * nothing else knew where they were. A receipt photo carries a name, a phone
 * number and an address, so leaving the files behind is the part that actually
 * matters.
 *
 * Deliberately not offered as a bulk action: this is a row at a time, behind
 * the panel, with what it is about to destroy named in the confirmation.
 */
export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const CAMPAIGN = campaignOf(req);
  const { id } = await props.params;
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 400 });
  }

  const [entry] = await supabaseRest<
    { id: string; status: string; receipt_photo_path: string | null; contact_name: string | null; computed_entries: number }[]
  >(
    `receipt_campaign_entries?id=eq.${pgValue(id)}&campaign_key=eq.${CAMPAIGN}` +
      `&select=id,status,receipt_photo_path,contact_name,computed_entries&limit=1`
  );
  if (!entry) return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 404 });

  const uploads = await supabaseRest<{ id: string; receipt_photo_path: string | null }[]>(
    `receipt_campaign_uploads?entry_id=eq.${pgValue(id)}&select=id,receipt_photo_path`
  ).catch(() => []);

  // Written down before anything is destroyed, because afterwards there is
  // nothing left to describe: who deleted what, and which files went with it.
  const photos = [...new Set([entry.receipt_photo_path, ...uploads.map((u) => u.receipt_photo_path)].filter((p): p is string => Boolean(p)))];
  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      admin_user_id: getAdminSession(token)?.userId ?? null,
      action: "receipt.delete",
      target: id,
      detail: {
        campaign: CAMPAIGN,
        status: entry.status,
        entries: entry.computed_entries,
        contactName: entry.contact_name,
        photos,
        by: getAdminSession(token)?.userId ?? null,
      },
    }),
  }).catch((err) => console.error("[admin/receipts] delete audit write failed", err));

  // Files first: a row still standing is a row that still names them, so a
  // failure here is recoverable. The other order leaves orphans nobody can find.
  await Promise.all(photos.map((path) => removeReceiptPhoto(path)));

  await supabaseRest(`receipt_campaign_uploads?entry_id=eq.${pgValue(id)}`, { method: "DELETE", returning: false });
  await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(id)}&campaign_key=eq.${CAMPAIGN}`, {
    method: "DELETE",
    returning: false,
  });

  return NextResponse.json({ ok: true, deleted: { uploads: uploads.length, photos: photos.length } });
}
