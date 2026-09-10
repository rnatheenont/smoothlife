import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";
import { recalculateLoyaltyForUser } from "@/lib/loyalty-cron";

// Folding a customer's duplicate account into the one they keep.
//
// Duplicates are ours, not theirs: someone bought before, signed up with a new
// email, saw no orders, and signed up again with the old address. The work of
// joining the two — identities, points, chat, checkins, loyalty totals — is one
// database function so it either all happens or none of it does; this route is
// the authorisation and the audit trail around it.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const survivorId = typeof body?.survivorId === "string" ? body.survivorId : "";
  const loserId = typeof body?.loserId === "string" ? body.loserId : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(survivorId) || !uuid.test(loserId)) {
    return NextResponse.json({ ok: false, error: "ระบุบัญชีไม่ถูกต้อง" }, { status: 400 });
  }
  if (survivorId === loserId) {
    return NextResponse.json({ ok: false, error: "เป็นบัญชีเดียวกัน" }, { status: 400 });
  }
  // Merging is the one action here with no undo — the losing account's row is
  // gone afterwards — so the reason is required and written down first.
  if (note.length < 3) {
    return NextResponse.json({ ok: false, error: "กรุณาระบุเหตุผลว่ายืนยันได้อย่างไรว่าเป็นคนเดียวกัน" }, { status: 400 });
  }

  // Written before the merge, not after: if the merge half-fails the record of
  // what was attempted still exists, and after it succeeds the losing id can
  // no longer be looked up anywhere else.
  const [before] = await supabaseRest<{ id: string; display_name: string | null; shopify_customer_id: string | null }[]>(
    `users?id=eq.${pgValue(loserId)}&select=id,display_name,shopify_customer_id&limit=1`
  );
  if (!before) return NextResponse.json({ ok: false, error: "ไม่พบบัญชีที่จะรวมเข้ามา" }, { status: 404 });

  const identities = await supabaseRest<{ provider: string; provider_uid: string }[]>(
    `auth_identities?user_id=eq.${pgValue(loserId)}&select=provider,provider_uid`
  ).catch(() => []);

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: "account.merge",
      target: survivorId,
      detail: { merged: loserId, note, mergedIdentities: identities, mergedShopify: before.shopify_customer_id },
    }),
  }).catch((err) => console.error("[admin/customers/merge] audit write failed", err));

  try {
    const result = await supabaseRest<Record<string, unknown>>("rpc/merge_web_accounts", {
      method: "POST",
      body: JSON.stringify({ p_survivor: survivorId, p_loser: loserId }),
    });
    // The survivor may have just inherited the Shopify link, and with it a
    // purchase history its tier was never calculated from.
    void recalculateLoyaltyForUser(survivorId).catch(() => {});
    return NextResponse.json({ ok: true, moved: result });
  } catch (err) {
    console.error("[admin/customers/merge] failed", err);
    return NextResponse.json({ ok: false, error: `รวมบัญชีไม่สำเร็จ: ${err}` }, { status: 500 });
  }
}
