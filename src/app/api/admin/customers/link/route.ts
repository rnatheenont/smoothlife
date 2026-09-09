import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { provenMatch } from "@/lib/account-match";
import { searchShopifyCustomers } from "@/lib/shopify-admin";

// Point a site account at a Shopify customer, or cut it loose.
//
// This is the one place in the app where staff can attach someone's purchase
// history to a login, so it is also the one place where attaching the WRONG
// history is possible — a stranger's addresses, phone number and orders shown
// to whoever asked nicely. Every change is written to the audit log with what
// it replaced, and the note field is required, so a wrong link can be found
// and undone rather than argued about.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  // null means unlink — spelled as an explicit flag so a bug that drops the
  // field cannot silently unlink an account.
  const unlink = body?.unlink === true;
  const shopifyCustomerId = typeof body?.shopifyCustomerId === "string" ? body.shopifyCustomerId : "";
  const auto = body?.auto === true;

  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    return NextResponse.json({ ok: false, error: "ไม่พบบัญชีผู้ใช้" }, { status: 400 });
  }
  if (!unlink && !/^gid:\/\/shopify\/Customer\/\d+$/.test(shopifyCustomerId)) {
    return NextResponse.json({ ok: false, error: "รหัสลูกค้า Shopify ไม่ถูกต้อง" }, { status: 400 });
  }
  // An automatic link is proved here, never taken on the caller's word: the
  // browser saying "this one matches" is not evidence, and this endpoint is
  // the thing standing between an account and someone else's order history.
  let reason = note;
  if (auto && !unlink) {
    const identities = await supabaseRest<{ provider: string; provider_uid: string; verified_at: string | null }[]>(
      `auth_identities?user_id=eq.${pgValue(userId)}&select=provider,provider_uid,verified_at`
    ).catch(() => []);
    const numericId = shopifyCustomerId.split("/").pop() || "";
    const [candidate] = await searchShopifyCustomers(`id:${numericId}`, 1);
    const proof =
      candidate &&
      provenMatch(
        identities.map((i) => ({ provider: i.provider, uid: i.provider_uid, verified: Boolean(i.verified_at) })),
        candidate
      );
    if (!proof) {
      return NextResponse.json(
        { ok: false, error: "ยืนยันอัตโนมัติไม่ได้ — ต้องตรวจสอบเองและระบุเหตุผล" },
        { status: 409 }
      );
    }
    reason = `ระบบยืนยันอัตโนมัติ: ${proof}`;
  }

  if (reason.length < 3) {
    return NextResponse.json({ ok: false, error: "กรุณาระบุเหตุผลสั้นๆ ว่ายืนยันตัวตนลูกค้าจากอะไร" }, { status: 400 });
  }

  const [current] = await supabaseRest<{ id: string; shopify_customer_id: string | null }[]>(
    `users?id=eq.${pgValue(userId)}&select=id,shopify_customer_id&limit=1`
  );
  if (!current) return NextResponse.json({ ok: false, error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });

  // Refused rather than reassigned: two site accounts pointing at one Shopify
  // customer means two people can see the same orders, and the fix for a
  // duplicate account is to merge it, not to double-link it.
  if (!unlink) {
    const clash = await supabaseRest<{ id: string }[]>(
      `users?shopify_customer_id=eq.${pgValue(shopifyCustomerId)}&id=neq.${pgValue(userId)}&select=id&limit=1`
    ).catch(() => []);
    if (clash.length > 0) {
      return NextResponse.json(
        { ok: false, error: `ใบ Shopify นี้ถูกผูกกับอีกบัญชีอยู่แล้ว (${clash[0].id}) — ต้องปลดจากบัญชีนั้นก่อน` },
        { status: 409 }
      );
    }
  }

  await supabaseRest(`users?id=eq.${pgValue(userId)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ shopify_customer_id: unlink ? null : shopifyCustomerId }),
  });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: unlink ? "account.unlink-shopify" : "account.link-shopify",
      target: userId,
      detail: { from: current.shopify_customer_id, to: unlink ? null : shopifyCustomerId, note: reason, auto },
    }),
  }).catch((err) => console.error("[admin/customers/link] audit write failed", err));

  return NextResponse.json({ ok: true, shopifyCustomerId: unlink ? null : shopifyCustomerId });
}
