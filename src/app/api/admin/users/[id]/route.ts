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
//   { display_name }       — rename the account
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
  // Renaming is allowed on your own account, unlike role and status: a name
  // is how you are shown, not what you may do. It is also the one field the
  // rest of the console reads back — the audit log and the product-content
  // list both resolve the name live from here — so a typo keeps turning up
  // on old work until it is fixed, which is the reason this exists.
  if (body.display_name !== undefined) {
    const name = typeof body.display_name === "string" ? body.display_name.trim() : "";
    if (!name) return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อที่ใช้แสดงผล" }, { status: 400 });
    if (name.length > 80) return NextResponse.json({ ok: false, error: "ชื่อยาวเกินไป (ไม่เกิน 80 ตัวอักษร)" }, { status: 400 });
    patch.display_name = name;
  }
  if (typeof body.role_key === "string") patch.role_key = body.role_key;
  if (body.status === "active" || body.status === "suspended") patch.status = body.status;
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: false, error: "ไม่มีข้อมูลให้แก้ไข" }, { status: 400 });

  const [updated] = await supabaseRest<{ id: string; email: string; display_name: string; role_key: string; status: string }[]>(
    `admin_users?id=eq.${pgValue(id)}&select=id,email,display_name,role_key,status`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  if (!updated) return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้นี้" }, { status: 404 });
  return NextResponse.json({ ok: true, user: updated });
}


// Where an account's name is attached to work it did. Deleting the row would
// take the name off all of it: the audit log, the product-content list and
// the SEO screen all resolve a name from admin_users by id at read time, and
// a receipt's reviewer column is SET NULL on delete. So an account that has
// done anything is not deletable — it is suspendable, which stops the login
// without rewriting what happened. Delete stays for the accounts worth
// deleting: duplicates, typos, test logins that were never used.
const TRACES: { table: string; column: string; label: string }[] = [
  { table: "admin_audit_log", column: "admin_user_id", label: "บันทึกการใช้งาน" },
  { table: "product_content_overrides", column: "updated_by", label: "เนื้อหาสินค้า" },
  { table: "seo_overrides", column: "updated_by", label: "SEO หน้าเว็บ" },
  { table: "receipt_campaign_entries", column: "reviewed_by", label: "ตรวจใบเสร็จ" },
  { table: "receipt_campaign_draws", column: "drawn_by", label: "จับรางวัล" },
];

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner(req);
  if (auth.res) return auth.res;
  if (!supabaseConfigured()) return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  const { id } = await props.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้นี้" }, { status: 404 });

  // Same reason the self-guard exists on PATCH, only harder: deleting your own
  // account ends the session that was allowed to do it, and there may be no
  // other owner left to undo it.
  if (auth.session?.userId === id) {
    return NextResponse.json({ ok: false, error: "ลบบัญชีตัวเองไม่ได้" }, { status: 400 });
  }

  const [user] = await supabaseRest<{ id: string; email: string; display_name: string; role_key: string }[]>(
    `admin_users?id=eq.${pgValue(id)}&select=id,email,display_name,role_key&limit=1`
  );
  if (!user) return NextResponse.json({ ok: false, error: "ไม่พบผู้ใช้นี้" }, { status: 404 });

  // Existence, not counts: the answer either way is "use ระงับ instead", and
  // which screens to go and look at is the part that helps.
  const found = await Promise.all(
    TRACES.map(async (t) => {
      const rows = await supabaseRest<{ [k: string]: unknown }[]>(
        `${t.table}?${t.column}=eq.${pgValue(id)}&select=${t.column}&limit=1`
      ).catch((): { [k: string]: unknown }[] => []);
      return rows.length > 0 ? t.label : null;
    })
  );
  const traces = found.filter((v): v is string => Boolean(v));
  if (traces.length > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `บัญชีนี้มีงานที่ทำไว้แล้ว (${traces.join(", ")}) ถ้าลบ ชื่อจะหายไปจากงานเก่าทั้งหมด — ใช้ “ระงับ” แทนเพื่อปิดการเข้าระบบโดยยังเก็บประวัติไว้`,
        traces,
      },
      { status: 409 }
    );
  }

  // `invited_by` points here too, but it is bookkeeping no screen reads, so
  // it is cleared rather than treated as work worth keeping a name on.
  await supabaseRest(`admin_users?invited_by=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ invited_by: null }),
  });

  await supabaseRest(`admin_users?id=eq.${pgValue(id)}`, { method: "DELETE", returning: false });

  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: "admin-user.delete",
      target: user.email,
      // The deleted row itself is the only copy of these, and the log is
      // where "who used to have access" gets answered later.
      detail: { display_name: user.display_name, role_key: user.role_key },
      admin_user_id: auth.session?.userId ?? null,
    }),
  }).catch((err) => console.error("[admin/users] audit write failed", err));

  return NextResponse.json({ ok: true });
}
