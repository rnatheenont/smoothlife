import { NextRequest, NextResponse } from "next/server";
import { supabaseConfigured, supabaseRest } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

// What the admin desk has done, where an admin can read it.
//
// Every write worth questioning already lands in admin_audit_log — approvals,
// rejections, draws, merges, refunds, settings changes — and until now the
// only way to read any of it was a database client. A record nobody can see
// is a record nobody checks.
//
// The admin's own name is resolved here rather than stored on each row: an
// id tells you which account, a name tells you who, and the two drift apart
// when somebody is renamed.

type AuditRow = {
  id: string;
  action: string;
  actor: string | null;
  admin_user_id: string | null;
  target: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
};

const PAGE = 300;

export async function GET(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const action = (req.nextUrl.searchParams.get("action") ?? "").trim();

  const [rows, admins] = await Promise.all([
    supabaseRest<AuditRow[]>(
      "admin_audit_log?select=id,action,actor,admin_user_id,target,detail,created_at" +
        "&order=created_at.desc&limit=1000"
    ).catch((): AuditRow[] => []),
    supabaseRest<{ id: string; display_name: string | null; email: string }[]>(
      "admin_users?select=id,display_name,email"
    ).catch((): { id: string; display_name: string | null; email: string }[] => []),
  ]);

  const nameOf = new Map(admins.map((a) => [a.id, a.display_name || a.email]));

  // The whole row is searched, detail included: "which receipt was this" and
  // "what did the settings change to" are both questions whose answer is in
  // there, and neither is worth its own filter.
  const filtered = rows.filter((r) => {
    if (action && r.action !== action) return false;
    if (!q) return true;
    const text = [r.action, r.target, r.actor, nameOf.get(r.admin_user_id ?? ""), JSON.stringify(r.detail ?? {})]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return text.includes(q);
  });

  return NextResponse.json(
    {
      ok: true,
      total: filtered.length,
      // Every action that has ever been written, so the filter offers what
      // the log actually contains rather than a list someone kept updating.
      actions: [...new Set(rows.map((r) => r.action))].sort(),
      entries: filtered.slice(0, PAGE).map((r) => ({
        id: r.id,
        action: r.action,
        who: nameOf.get(r.admin_user_id ?? "") ?? null,
        actor: r.actor,
        target: r.target,
        detail: r.detail,
        at: r.created_at,
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
