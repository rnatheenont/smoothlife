import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { amountsFromLineItems, computeEntries, type LineItem } from "@/lib/receipt-campaign";

// Approving or rejecting one receipt.
//
// Approving is what turns a photo into a claim on a ฿55,000 prize, so it is
// written down: who decided, when, and — when they corrected the number — what
// the system had worked out before they did. A prize draw that cannot be
// explained afterwards is one the shop has to defend on its word alone.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CAMPAIGN = "dentiste-x-kengnamping";

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
async function recalculate(id: string, token: string | undefined) {
  const [entry] = await supabaseRest<
    {
      id: string;
      computed_entries: number;
      entries_override: number | null;
      payment_transactions: { line_items: LineItem[] | null } | null;
    }[]
  >(
    `receipt_campaign_entries?id=eq.${pgValue(id)}&campaign_key=eq.${CAMPAIGN}` +
      `&select=id,computed_entries,entries_override,payment_transactions(line_items)&limit=1`
  );
  if (!entry) return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 404 });
  if (!entry.payment_transactions) {
    return NextResponse.json(
      { ok: false, error: "ใบเสร็จนี้ไม่ได้ผูกกับคำสั่งซื้อในระบบ คำนวณใหม่ไม่ได้" },
      { status: 409 }
    );
  }

  const amounts = amountsFromLineItems(entry.payment_transactions.line_items);
  const entries = computeEntries(amounts);

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
      action: "receipt.recalculate",
      target: id,
      detail: {
        campaign: CAMPAIGN,
        before: { entries: entry.computed_entries, override: entry.entries_override },
        after: { entries, dentisteAmount: amounts.dentisteAmount, keychainAmount: amounts.keychainAmount },
        by: getAdminSession(token)?.userId ?? null,
      },
    }),
  }).catch((err) => console.error("[admin/receipts] audit write failed", err));

  return NextResponse.json({ ok: true, entries, dentisteAmount: amounts.dentisteAmount });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
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
  if (action === "recalculate") return recalculate(id, token);
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "action ต้องเป็น approve, reject หรือ recalculate" }, { status: 400 });
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

  const [entry] = await supabaseRest<{ id: string; computed_entries: number; status: string }[]>(
    `receipt_campaign_entries?id=eq.${pgValue(id)}&campaign_key=eq.${CAMPAIGN}&select=id,computed_entries,status&limit=1`
  );
  if (!entry) return NextResponse.json({ ok: false, error: "ไม่พบใบเสร็จรายการนี้" }, { status: 404 });
  if (entry.status !== "pending_review") {
    return NextResponse.json({ ok: false, error: "ใบเสร็จนี้ถูกตรวจไปแล้ว" }, { status: 409 });
  }

  const adminId = getAdminSession(token)?.userId ?? null;
  const now = new Date().toISOString();

  await supabaseRest(`receipt_campaign_entries?id=eq.${pgValue(id)}&status=eq.pending_review`, {
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
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
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
          link: "/campaigns/dentiste-x-kengnamping",
          metadata: { campaign_key: CAMPAIGN, entry_id: id },
        }),
      }).catch((err) => console.error("[admin/receipts] notify failed", err));
    }
  }

  return NextResponse.json({ ok: true });
}
