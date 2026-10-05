import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";

// Typing in a customer's name when nothing else can supply it.
//
// Signing up on the web asks for an email and a code, so the name is filled in
// afterwards or not at all; the ones that are not show as "สมาชิกใหม่"
// everywhere staff look. A name is taken from the customer's Shopify record
// wherever there is one (see link-shopify-customer.ts), which leaves the
// accounts that have no name anywhere — a customer who said it over chat or on
// the phone, and nobody could write it down.
//
// Only over to the account's own display name: this is the name the customer
// sees on their own account page, so it is their name as told to staff, not a
// note about them.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!UUID.test(userId)) return NextResponse.json({ ok: false, error: "ระบุบัญชีไม่ถูกต้อง" }, { status: 400 });
  if (!name) return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
  if (name.length > 120) {
    return NextResponse.json({ ok: false, error: "ชื่อยาวเกินไป (ไม่เกิน 120 ตัวอักษร)" }, { status: 400 });
  }

  const [before] = await supabaseRest<{ id: string; display_name: string | null }[]>(
    `users?id=eq.${pgValue(userId)}&select=id,display_name&limit=1`
  );
  if (!before) return NextResponse.json({ ok: false, error: "ไม่พบบัญชีนี้" }, { status: 404 });

  await supabaseRest(`users?id=eq.${pgValue(userId)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ display_name: name }),
  });

  // The old name is only here afterwards. Staff typing a name they were told
  // is a guess about a real person, and a guess about the wrong account is
  // the kind of thing somebody has to be able to look up later.
  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: "account.rename",
      target: userId,
      detail: { from: before.display_name, to: name },
      admin_user_id: getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)?.userId ?? null,
    }),
  }).catch((err) => console.error("[admin/customers/name] audit write failed", err));

  return NextResponse.json({ ok: true, user: { id: userId, display_name: name } });
}
