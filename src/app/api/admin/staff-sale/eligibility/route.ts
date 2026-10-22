import { NextRequest, NextResponse } from "next/server";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { auditStaffSale, badRequest, guard } from "@/lib/staff-sale-admin";
import {
  ELIGIBILITY_COLUMNS,
  canonStaffDomain,
  canonStaffEmail,
  type EligibilityKind,
  type StaffEligibility,
} from "@/lib/staff-sale";

// Admin: who may buy — allowed domains, individual exceptions, and the
// blocklist. One list in the console because it is one question.

const KINDS: EligibilityKind[] = ["allow_domain", "allow_email", "block_email"];

export async function GET(req: NextRequest) {
  const stop = guard(req);
  if (stop) return stop;

  const rows = await supabaseRest<StaffEligibility[]>(
    `staff_eligibility?select=${ELIGIBILITY_COLUMNS}&order=kind.asc,created_at.desc&limit=5000`,
  );
  return NextResponse.json({ ok: true, rules: rows ?? [] });
}

export async function POST(req: NextRequest) {
  const stop = guard(req);
  if (stop) return stop;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return badRequest("ข้อมูลไม่ถูกต้อง");

  const kind = body.kind as EligibilityKind;
  if (!KINDS.includes(kind)) return badRequest("ประเภทสิทธิ์ไม่ถูกต้อง");

  const raw = typeof body.value === "string" ? body.value : "";
  // Canonicalised here as well as in the RPC, so the row that goes in is
  // the row the RPC will look for. An exception stored as
  // `Somchai+x@SMOOTH-E.com` would simply never match.
  const value = kind === "allow_domain" ? canonStaffDomain(raw) : canonStaffEmail(raw);
  if (!value) {
    return badRequest(kind === "allow_domain" ? "โดเมนไม่ถูกต้อง" : "อีเมลไม่ถูกต้อง");
  }

  const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim() : null;
  let expires_at: string | null = null;
  if (typeof body.expires_at === "string" && body.expires_at) {
    const d = new Date(body.expires_at);
    if (Number.isNaN(d.getTime())) return badRequest("วันหมดอายุไม่ถูกต้อง");
    expires_at = d.toISOString();
  }

  // A rule revoked earlier and added again is the same rule coming back, not
  // a second one — the partial unique index only covers live rows, so the
  // old revoked row stays as history and this one goes in beside it.
  const live = await supabaseRest<{ id: string }[]>(
    `staff_eligibility?kind=eq.${pgValue(kind)}&value=eq.${pgValue(value)}&revoked_at=is.null&select=id&limit=1`,
  );
  if (live?.[0]) return badRequest("มีรายการนี้อยู่แล้ว");

  const rows = await supabaseRest<StaffEligibility[]>(
    `staff_eligibility?select=${ELIGIBILITY_COLUMNS}`,
    {
      method: "POST",
      body: JSON.stringify({ kind, value, reason, expires_at, created_by: null }),
    },
  );

  await auditStaffSale(req, "staff_sale.eligibility_add", rows?.[0]?.id ?? null, {
    kind,
    value,
    reason,
    expires_at,
  });

  return NextResponse.json({ ok: true, rule: rows?.[0] ?? null });
}

export async function PATCH(req: NextRequest) {
  const stop = guard(req);
  if (stop) return stop;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return badRequest("ไม่พบรายการที่จะยกเลิก");

  const rows = await supabaseRest<StaffEligibility[]>(
    `staff_eligibility?id=eq.${pgValue(id)}&select=${ELIGIBILITY_COLUMNS}&limit=1`,
  );
  const rule = rows?.[0];
  if (!rule) return NextResponse.json({ ok: false, error: "ไม่พบรายการนี้" }, { status: 404 });
  if (rule.revoked_at) return badRequest("ยกเลิกไปแล้ว");

  // Revoked, never deleted: who was allowed to buy at staff prices, and
  // when that stopped, is exactly what an audit of this page would ask.
  await supabaseRest(`staff_eligibility?id=eq.${pgValue(id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ revoked_at: new Date().toISOString() }),
  });

  await auditStaffSale(req, "staff_sale.eligibility_revoke", id, {
    kind: rule.kind,
    value: rule.value,
  });

  // Said out loud because it is the thing people get wrong about this page:
  // revoking an allow row does not cancel a verification that already
  // happened. The blocklist is what stops somebody mid-round.
  return NextResponse.json({
    ok: true,
    note:
      rule.kind === "block_email"
        ? undefined
        : "คนที่ยืนยันอีเมลในรอบนี้ไปแล้วยังซื้อได้ — ถ้าต้องหยุดทันที ให้เพิ่มอีเมลนั้นในรายชื่อระงับสิทธิ์",
  });
}
