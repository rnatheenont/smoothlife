import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  getAdminSession,
  verifyAdminToken,
} from "@/lib/admin-auth";
import {
  pgValue,
  supabaseConfigured,
  supabaseRest,
} from "@/lib/supabase-server";

// Editing one of a customer's saved addresses, by id.
//
// ../profile already writes an address, but only ever the default one — it
// was built for the account that has none, where "the address" is
// unambiguous. The customer screen lists every address a person has saved,
// and a screen that shows three while being able to change one is half a
// screen: staff fix the wrong one, or give up and read the right one out
// over the phone.
//
// Two things can be done to a row here and no more: correct what it says,
// and make it the one orders default to. There is deliberately no create and
// no delete. Adding a second address from the admin side is how a parcel
// goes to the address the customer did not choose, and deleting one throws
// away the only copy of something they typed — both belong to the customer,
// in their own account, where they already are.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

const COLUMNS =
  "id,user_id,label,recipient_name,phone,address_line,subdistrict,district,province,postal_code,country,is_default,created_at,updated_at";

/** Every part of a Thai address is required by the table, so a half-filled
 *  form is rejected rather than stored as a parcel that cannot arrive. */
const PARTS: [string, string][] = [
  ["recipient_name", "ชื่อผู้รับ"],
  ["phone", "เบอร์โทรผู้รับ"],
  ["address_line", "ที่อยู่"],
  ["subdistrict", "ตำบล/แขวง"],
  ["district", "อำเภอ/เขต"],
  ["province", "จังหวัด"],
  ["postal_code", "รหัสไปรษณีย์"],
];

const LIMITS: Record<string, number> = {
  label: 60,
  recipient_name: 200,
  phone: 40,
  address_line: 500,
  subdistrict: 120,
  district: 120,
  province: 120,
  postal_code: 20,
};

function str(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json(
      { ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" },
      { status: 401 },
    );
  }
  if (!supabaseConfigured())
    return NextResponse.json(
      { ok: false, error: "ระบบยังไม่พร้อมใช้งาน" },
      { status: 503 },
    );

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId : "";
  const addressId = typeof body?.addressId === "string" ? body.addressId : "";
  if (!UUID.test(userId) || !UUID.test(addressId))
    return NextResponse.json(
      { ok: false, error: "ระบุที่อยู่ไม่ถูกต้อง" },
      { status: 400 },
    );

  // Matched on both ids, not just the address: the owner comes from the
  // request, and an id typed into the wrong screen would otherwise edit a
  // stranger's address and report success.
  const [before] = await supabaseRest<Record<string, string | boolean>[]>(
    `addresses?id=eq.${pgValue(addressId)}&user_id=eq.${pgValue(userId)}&select=${COLUMNS}&limit=1`,
  ).catch((): Record<string, string | boolean>[] => []);
  if (!before)
    return NextResponse.json(
      { ok: false, error: "ไม่พบที่อยู่นี้ในบัญชีดังกล่าว" },
      { status: 404 },
    );

  const patch: Record<string, string | boolean> = {};
  if (body?.address && typeof body.address === "object") {
    for (const field of Object.keys(LIMITS)) {
      if (!(field in body.address)) continue;
      patch[field] = str(body.address[field], LIMITS[field]);
    }
    if ("country" in body.address)
      patch.country = str(body.address.country, 2).toUpperCase() || "TH";

    const missing = PARTS.filter(([field]) =>
      field in patch ? !patch[field] : !before[field],
    ).map(([, label]) => label);
    if (missing.length > 0)
      return NextResponse.json(
        { ok: false, error: `ที่อยู่ยังไม่ครบ: ${missing.join(", ")}` },
        { status: 400 },
      );
    if (!patch.label && "label" in patch) patch.label = "บ้าน";
  }

  const makeDefault = body?.makeDefault === true;
  if (Object.keys(patch).length === 0 && !makeDefault)
    return NextResponse.json(
      { ok: false, error: "ไม่มีอะไรให้บันทึก" },
      { status: 400 },
    );

  // Cleared first, then set: the table allows more than one default per
  // account, so skipping this leaves two and whichever is read first wins.
  if (makeDefault && before.is_default !== true) {
    await supabaseRest(
      `addresses?user_id=eq.${pgValue(userId)}&is_default=eq.true`,
      {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ is_default: false }),
      },
    );
    patch.is_default = true;
  }

  const [after] = await supabaseRest<Record<string, string | boolean>[]>(
    `addresses?id=eq.${pgValue(addressId)}&select=${COLUMNS}`,
    {
      method: "PATCH",
      body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
    },
  );

  // Only the fields that actually moved, with what they used to say. Staff
  // typing what a customer told them is a guess about a real person, and a
  // guess written onto the wrong row is the kind of thing somebody has to be
  // able to look up later.
  const changed: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of Object.keys(patch)) {
    if (before[field] !== patch[field])
      changed[field] = { from: before[field], to: patch[field] };
  }
  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: "account.address_edit",
      target: userId,
      detail: { addressId, ...changed },
      admin_user_id: getAdminSession(token)?.userId ?? null,
    }),
  }).catch((err) =>
    console.error("[admin/customers/addresses] audit write failed", err),
  );

  return NextResponse.json({ ok: true, address: after ?? null });
}
