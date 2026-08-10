import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export type AddressRow = {
  id: string;
  label: string | null;
  recipient_name: string;
  phone: string;
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
  const addresses = await supabaseRest<AddressRow[]>(
    `addresses?user_id=eq.${uid}&select=*&order=is_default.desc,created_at.desc`
  );
  return NextResponse.json({ addresses });
}

export async function POST(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { label, recipient_name, phone, address_line, subdistrict, district, province, postal_code, country, is_default } =
    body || {};
  if (!recipient_name || !phone || !address_line || !subdistrict || !district || !province || !postal_code) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกข้อมูลให้ครบถ้วน" }, { status: 400 });
  }

  const existing = await supabaseRest<{ id: string }[]>(`addresses?user_id=eq.${uid}&select=id&limit=1`);
  const makeDefault = Boolean(is_default) || existing.length === 0;

  if (makeDefault) {
    await supabaseRest(`addresses?user_id=eq.${uid}`, {
      method: "PATCH",
      body: JSON.stringify({ is_default: false }),
      returning: false,
    });
  }

  const [created] = await supabaseRest<AddressRow[]>("addresses", {
    method: "POST",
    body: JSON.stringify({
      user_id: uid,
      label: label || "บ้าน",
      recipient_name,
      phone,
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
