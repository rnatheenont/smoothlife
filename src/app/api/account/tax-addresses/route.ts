import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export type TaxAddressRow = {
  id: string;
  label: string | null;
  is_company: boolean;
  recipient_name: string;
  tax_id: string;
  phone: string;
  email: string | null;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  country: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

function requireUid(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) return NextResponse.json({ addresses: [] });
  const addresses = await supabaseRest<TaxAddressRow[]>(
    `tax_invoice_addresses?user_id=eq.${uid}&select=*&order=is_default.desc,created_at.desc`
  );
  return NextResponse.json({ addresses });
}

export async function POST(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const {
    label,
    is_company,
    recipient_name,
    tax_id,
    phone,
    email,
    address_line,
    subdistrict,
    district,
    province,
    postal_code,
    country,
    is_default,
  } = body || {};
  if (!recipient_name || !tax_id || !phone || !address_line || !subdistrict || !district || !province || !postal_code) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }
  const taxIdDigits = String(tax_id).replace(/\D/g, "");
  if (taxIdDigits.length !== 13) {
    return NextResponse.json({ ok: false, error: "เลขประจำตัวผู้เสียภาษีต้องมี 13 หลัก" }, { status: 400 });
  }

  const existing = await supabaseRest<{ id: string }[]>(`tax_invoice_addresses?user_id=eq.${uid}&select=id&limit=1`);
  const makeDefault = Boolean(is_default) || existing.length === 0;

  if (makeDefault) {
    await supabaseRest(`tax_invoice_addresses?user_id=eq.${uid}`, {
      method: "PATCH",
      body: JSON.stringify({ is_default: false }),
      returning: false,
    });
  }

  const [created] = await supabaseRest<TaxAddressRow[]>("tax_invoice_addresses", {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      label: label || "ที่อยู่ใบกำกับภาษี",
      is_company: Boolean(is_company),
      recipient_name,
      tax_id: taxIdDigits,
      phone,
      email: email || null,
      address_line,
      subdistrict,
      district,
      province,
      postal_code,
      country: country || "TH",
      is_default: makeDefault,
    }),
  });
  return NextResponse.json({ ok: true, address: created });
}
