import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { checkOwnerSession } from "@/lib/admin-permissions";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";

// Managing who can sign in at all — deliberately narrower than the general
// permission system (see admin-permissions.ts): only "owner" may reach this,
// even though "admin" also holds the '*' wildcard for every other screen.
// An admin who could edit admin_users could hand themselves the owner role,
// or lock the real owner out, so this goes through checkOwnerSession()
// instead of checkAdminPermission().
async function requireOwner(req: NextRequest): Promise<{ res: NextResponse | null }> {
  const result = await checkOwnerSession(req.cookies.get(ADMIN_COOKIE)?.value);
  // `"reason" in result`, not `!result.ok` — see checkOwnerSession's doc
  // comment for why this codebase avoids narrowing a `{ok:true}|{ok:false}`
  // union on the boolean field itself (tsconfig has strictNullChecks off,
  // under which that pattern silently fails to narrow).
  if ("reason" in result) {
    const status = result.reason === "unauthenticated" ? 401 : 403;
    const error = result.reason === "unauthenticated" ? "กรุณาเข้าสู่ระบบแอดมิน" : "เฉพาะเจ้าของระบบเท่านั้นที่จัดการผู้ใช้ได้";
    return { res: NextResponse.json({ ok: false, error }, { status }) };
  }
  return { res: null };
}

export type AdminUserListItem = {
  id: string;
  email: string;
  display_name: string;
  role_key: string;
  status: "active" | "suspended";
  created_at: string;
  last_login_at: string | null;
};

export async function GET(req: NextRequest) {
  const auth = await requireOwner(req);
  if (auth.res) return auth.res;
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const [users, roles] = await Promise.all([
    supabaseRest<AdminUserListItem[]>(
      "admin_users?select=id,email,display_name,role_key,status,created_at,last_login_at&order=created_at.asc"
    ),
    supabaseRest<{ key: string; label: string }[]>("roles?select=key,label&order=key.asc"),
  ]);
  return NextResponse.json({ ok: true, users, roles });
}

// Creates the account directly with a one-time temporary password shown once
// in the response, rather than emailing an invite link — this app has no
// transactional-email sending set up for staff-facing mail yet. The owner
// relays the password to the new teammate themselves; the account's
// `status` and the fact that `last_login_at` stays null give a visible sign
// of who has actually logged in with it.
export async function POST(req: NextRequest) {
  const auth = await requireOwner(req);
  if (auth.res) return auth.res;
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const displayName = typeof body?.display_name === "string" ? body.display_name.trim() : "";
  const roleKey = typeof body?.role_key === "string" ? body.role_key : "";
  if (!email || !email.includes("@")) return NextResponse.json({ ok: false, error: "กรุณากรอกอีเมลให้ถูกต้อง" }, { status: 400 });
  if (!displayName) return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อที่ใช้แสดงผล" }, { status: 400 });
  if (!roleKey) return NextResponse.json({ ok: false, error: "กรุณาเลือกสิทธิ์" }, { status: 400 });

  const existing = await supabaseRest<{ id: string }[]>(`admin_users?email=eq.${pgValue(email)}&select=id&limit=1`);
  if (existing.length > 0) return NextResponse.json({ ok: false, error: "มีบัญชีนี้อยู่แล้ว" }, { status: 409 });

  // 16 random bytes as base64url reads as ~22 characters of mixed case,
  // digits and symbols — well past any reasonable brute-force floor for a
  // password that is only ever shown once and meant to be changed.
  const tempPassword = randomBytes(16).toString("base64url");
  const session = getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);

  const [created] = await supabaseRest<{ id: string }[]>("admin_users?select=id", {
    method: "POST",
    body: JSON.stringify({
      email,
      display_name: displayName,
      password_hash: hashPassword(tempPassword),
      role_key: roleKey,
      invited_by: session?.userId ?? null,
    }),
  });

  return NextResponse.json({ ok: true, user: { id: created.id, email, tempPassword } });
}
