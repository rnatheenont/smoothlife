import { NextRequest, NextResponse } from "next/server";
import { verifyAdminToken, getAdminSession, ADMIN_COOKIE } from "@/lib/admin-auth";
import { supabaseRest, supabaseConfigured, pgValue } from "@/lib/supabase-server";

// Writing down what a customer told staff: their name, their phone, where to
// send it.
//
// Signing up on the web asks for an email and a code, so everything else is
// filled in afterwards or not at all; the accounts that never were show as
// "สมาชิกใหม่" with no way to reach them. Details are taken from the
// customer's Shopify record wherever there is one (link-shopify-customer.ts),
// which leaves the accounts that have no record anywhere — a customer who
// said it over chat or on the phone, and nobody could write it down.
//
// This writes to the customer's own account, which is the point: it is their
// name and their address as told to staff, the same fields they would have
// typed themselves, not a note about them. Nothing here is sent to Shopify —
// a Shopify record is that store's copy, and changing it from this screen
// would overwrite what the customer entered at that store's checkout.
//
// Every field is optional and only what is sent is written, so saving a name
// cannot blank an address somebody else filled in from the same screen.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

type AddressInput = {
  recipient_name: string;
  phone: string;
  address_line: string;
  subdistrict: string;
  district: string;
  province: string;
  postal_code: string;
  label?: string;
  country?: string;
};

type AddressRow = AddressInput & { id: string; is_default: boolean };

const ADDRESS_COLUMNS =
  "id,label,recipient_name,phone,address_line,subdistrict,district,province,postal_code,country,is_default";

/** Every part of a Thai address is required by the table, so a half-filled
 *  form is rejected rather than stored as a package that cannot be
 *  delivered. */
const ADDRESS_PARTS: [keyof AddressInput, string][] = [
  ["recipient_name", "ชื่อผู้รับ"],
  ["phone", "เบอร์โทรผู้รับ"],
  ["address_line", "ที่อยู่"],
  ["subdistrict", "ตำบล/แขวง"],
  ["district", "อำเภอ/เขต"],
  ["province", "จังหวัด"],
  ["postal_code", "รหัสไปรษณีย์"],
];

function str(raw: unknown, max: number): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

export async function PATCH(req: NextRequest) {
  if (!verifyAdminToken(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }
  if (!supabaseConfigured())
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!UUID.test(userId))
    return NextResponse.json({ ok: false, error: "ระบุบัญชีไม่ถูกต้อง" }, { status: 400 });

  const [before] = await supabaseRest<{ id: string; display_name: string | null; phone: string | null }[]>(
    `users?id=eq.${pgValue(userId)}&select=id,display_name,phone&limit=1`,
  );
  if (!before) return NextResponse.json({ ok: false, error: "ไม่พบบัญชีนี้" }, { status: 404 });

  const patch: Record<string, string | null> = {};

  if ("name" in body) {
    const name = str(body.name, 200);
    if (!name) return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
    if (name.length > 120)
      return NextResponse.json({ ok: false, error: "ชื่อยาวเกินไป (ไม่เกิน 120 ตัวอักษร)" }, { status: 400 });
    patch.display_name = name;
  }

  if ("phone" in body) {
    // Cleared on purpose is a real edit: a wrong number is worse than none,
    // because somebody will ring it.
    const phone = str(body.phone, 40);
    patch.phone = phone || null;
  }

  if (Object.keys(patch).length > 0) {
    await supabaseRest(`users?id=eq.${pgValue(userId)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify(patch),
    });
  }

  // The address, when one was sent. Written to the account's default
  // address, since that is the one everything else reaches for — and created
  // as the default if the account has none, which is the case this screen
  // exists for.
  let address: AddressRow | null = null;
  if (body?.address && typeof body.address === "object") {
    const input: AddressInput = {
      recipient_name: str(body.address.recipient_name, 200) || str(body.name, 200) || before.display_name || "",
      phone: str(body.address.phone, 40) || str(body.phone, 40) || before.phone || "",
      address_line: str(body.address.address_line, 500),
      subdistrict: str(body.address.subdistrict, 120),
      district: str(body.address.district, 120),
      province: str(body.address.province, 120),
      postal_code: str(body.address.postal_code, 20),
      label: str(body.address.label, 60) || "บ้าน",
      country: str(body.address.country, 2).toUpperCase() || "TH",
    };

    const missing = ADDRESS_PARTS.filter(([key]) => !input[key]).map(([, label]) => label);
    if (missing.length > 0) {
      return NextResponse.json(
        { ok: false, error: `ที่อยู่ยังไม่ครบ: ${missing.join(", ")}` },
        { status: 400 },
      );
    }

    const existing = await supabaseRest<AddressRow[]>(
      `addresses?user_id=eq.${pgValue(userId)}&select=${ADDRESS_COLUMNS}&order=is_default.desc,created_at.asc&limit=1`,
    ).catch((): AddressRow[] => []);

    if (existing[0]) {
      [address] = await supabaseRest<AddressRow[]>(
        `addresses?id=eq.${pgValue(existing[0].id)}&select=${ADDRESS_COLUMNS}`,
        {
          method: "PATCH",
          body: JSON.stringify({ ...input, updated_at: new Date().toISOString() }),
        },
      );
    } else {
      [address] = await supabaseRest<AddressRow[]>(`addresses?select=${ADDRESS_COLUMNS}`, {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify([{ ...input, user_id: userId, is_default: true }]),
      });
    }
  }

  // Afterwards, and with the old values. Staff typing what a customer told
  // them is a guess about a real person, and a guess written onto the wrong
  // account is the kind of thing somebody has to be able to look up later.
  await supabaseRest("admin_audit_log", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      action: "account.profile_edit",
      target: userId,
      detail: {
        ...("display_name" in patch
          ? { name: { from: before.display_name, to: patch.display_name } }
          : {}),
        ...("phone" in patch ? { phone: { from: before.phone, to: patch.phone } } : {}),
        ...(address ? { address: { id: address.id } } : {}),
      },
      admin_user_id: getAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)?.userId ?? null,
    }),
  }).catch((err) => console.error("[admin/customers/profile] audit write failed", err));

  return NextResponse.json({
    ok: true,
    user: {
      id: userId,
      display_name: "display_name" in patch ? patch.display_name : before.display_name,
      phone: "phone" in patch ? patch.phone : before.phone,
    },
    address,
  });
}
