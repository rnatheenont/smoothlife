import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import type { TaxAddressRow } from "../route";

function requireUid(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

const ALLOWED_FIELDS = [
  "label",
  "is_company",
  "recipient_name",
  "tax_id",
  "phone",
  "email",
  "address_line",
  "subdistrict",
  "district",
  "province",
  "postal_code",
  "country",
  "is_default",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  if (body.is_default === true) {
    await supabaseRest(`tax_invoice_addresses?user_id=eq.${uid}`, {
      method: "PATCH",
      body: JSON.stringify({ is_default: false }),
      returning: false,
    });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of ALLOWED_FIELDS) if (key in body) patch[key] = body[key];
  if (typeof patch.tax_id === "string") patch.tax_id = patch.tax_id.replace(/\D/g, "");

  const [updated] = await supabaseRest<TaxAddressRow[]>(`tax_invoice_addresses?id=eq.${params.id}&user_id=eq.${uid}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!updated) return NextResponse.json({ ok: false, error: "ไม่พบที่อยู่นี้" }, { status: 404 });
  return NextResponse.json({ ok: true, address: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  await supabaseRest(`tax_invoice_addresses?id=eq.${params.id}&user_id=eq.${uid}`, {
    method: "DELETE",
    returning: false,
  });
  return NextResponse.json({ ok: true });
}
