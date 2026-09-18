import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { checkOwnerSession } from "@/lib/admin-permissions";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";
import { UUID_RE } from "@/lib/flash-sale";

// Same owner-only gate as ../route.ts — see the comment there for why this
// isn't routed through the general permission system.
async function requireOwner(
  req: NextRequest
): Promise<{ res: NextResponse; session: null } | { res: null; session: { userId: string; role: string } | null }> {
  const result = await checkOwnerSession(req.cookies.get(ADMIN_COOKIE)?.value);
  // `"reason" in result`, not `!result.ok` — see checkOwnerSession's doc
  // comment for why this codebase avoids narrowing a `{ok:true}|{ok:false}`
  // union on the boolean field itself (tsconfig has strictNullChecks off,
  // under which that pattern silently fails to narrow).
  if ("reason" in result) {
    const status = result.reason === "unauthenticated" ? 401 : 403;
    const error = result.reason === "unauthenticated" ? "กรุณาเข้าสู่ระบบแอดมิน" : "เฉพาะเจ้าของระบบเท่านั้นที่จัดการผู้ใช้ได้";
    return { res: NextResponse.json({ ok: false, error }, { status }), session: null };
  }
  return { res: null, session: result.session };
}

// PATCH body is one of:
//   { role_key }          — change what this person can do
//   { status }             — suspend / reactivate
//   { reset_password: true } — issue a new temporary password, returned once
export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner(req);
  if (auth.res) return auth.res;
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้นี้" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ ok: false, error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });

  // A per-user session cannot demote or suspend itself — the only way to end
  // up with zero working owners is a bug, not a click, so that path is
  // closed off entirely rather than trusted to "are you sure" alone. A
  // legacy shared-password session has no userId to compare against and
  // this check simply does not apply to it.
  if (auth.session?.userId === id && (body.role_key !== undefined || body.status !== undefined)) {
    return NextResponse.json({ ok: false, error: "แก้ไขสิทธิ์หรือสถานะของบัญชีตัวเองไม่ได้" }, { status: 400 });
  }

  if (body.reset_password === true) {
    const tempPassword = randomBytes(16).toString("base64url");
    await supabaseRest(`admin_users?id=eq.${pgValue(id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ password_hash: hashPassword(tempPassword) }),
    });
    return NextResponse.json({ ok: true, tempPassword });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.role_key === "string") patch.role_key = body.role_key;
  if (body.status === "active" || body.status === "suspended") patch.status = body.status;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });

  const [updated] = await supabaseRest<{ id: string; email: string; role_key: string; status: string }[]>(
    `admin_users?id=eq.${pgValue(id)}&select=id,email,role_key,status`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  if (!updated) return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้นี้" }, { status: 404 });
  return NextResponse.json({ ok: true, user: updated });
}
