import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminSession, verifyAdminToken } from "@/lib/admin-auth";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

// The three lines every /api/admin/staff-sale route repeats, in one place.
//
// Six routes share them, and the audit write is the one that matters: a
// price list and a spending cap are money, so who changed what from what is
// not optional. Writing it by hand six times is how one of them ends up
// without it.

export function unauthorized() {
  return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
}

export function unavailable() {
  return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
}

export function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

/**
 * Returns null when the request may proceed, or the response to send back.
 *
 * The permission itself is checked by the proxy against
 * admin-route-permissions.ts before Next ever resolves the route — this is
 * only "is there a session at all", which is what the rest of the console's
 * routes check too.
 */
export function guard(req: NextRequest): NextResponse | null {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) return unauthorized();
  if (!supabaseConfigured()) return unavailable();
  return null;
}

export function adminUserId(req: NextRequest): string | null {
  return getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)?.userId ?? null;
}

/**
 * One line in admin_audit_log.
 *
 * Deliberately not awaited by callers that have already written: the audit
 * row must not be what fails a price change that already happened. It is
 * awaited where the write is the whole point (a refund, a revoked
 * exception) so the console can report a half-done action honestly.
 */
export async function auditStaffSale(
  req: NextRequest,
  action: string,
  target: string | null,
  detail: Record<string, unknown>,
) {
  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action,
      target,
      detail,
      admin_user_id: adminUserId(req),
    }),
  }).catch((err) => {
    console.error("[staff-sale] audit write failed", action, err);
  });
}
