import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { linkOrCreateShopifyCustomer } from "@/lib/link-shopify-customer";

const GENDERS = new Set(["male", "female", "other"]);

export async function PATCH(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบก่อนครับ" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    if (!body.name.trim()) return NextResponse.json({ ok: false, error: "กรุณากรอกชื่อ" }, { status: 400 });
    patch.display_name = body.name.trim();
  }
  if (typeof body.phone === "string") {
    const digits = body.phone.replace(/\D/g, "");
    if (digits && digits.length !== 10) {
      return NextResponse.json({ ok: false, error: "เบอร์มือถือต้องมี 10 หลัก" }, { status: 400 });
    }
    patch.phone = digits || null;
  }
  if (body.gender === null || (typeof body.gender === "string" && GENDERS.has(body.gender))) {
    patch.gender = body.gender;
  }
  if (typeof body.birthdate === "string" || body.birthdate === null) {
    patch.birthdate = body.birthdate || null;
  }
  if (typeof body.avatar === "string" || body.avatar === null) {
    if (typeof body.avatar === "string" && body.avatar.length > 500_000) {
      return NextResponse.json({ ok: false, error: "ไฟล์รูปใหญ่เกินไป" }, { status: 400 });
    }
    patch.avatar_url = body.avatar || null;
  }

  // Only for accounts that don't have an email identity yet (e.g. LINE,
  // whose "profile" scope never hands one over) — never lets someone
  // change an existing email through this route.
  let emailError: string | null = null;
  if (typeof body.email === "string" && body.email.trim()) {
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const normalizedEmail = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(normalizedEmail)) {
      return NextResponse.json({ ok: false, error: "อีเมลไม่ถูกต้อง" }, { status: 400 });
    }
    const existing = await supabaseRest<{ user_id: string }[]>(
      `auth_identities?user_id=eq.${uid}&provider=eq.email&select=user_id`
    );
    if (!existing.length) {
      try {
        await supabaseRest("auth_identities", {
          method: "POST",
          returning: false,
          body: JSON.stringify({ user_id: uid, provider: "email", provider_uid: normalizedEmail }),
        });
      } catch (err) {
        emailError = String(err).includes("duplicate")
          ? "อีเมลนี้ถูกใช้งานแล้ว"
          : "บันทึกอีเมลไม่สำเร็จ กรุณาลองใหม่";
      }
    }
  }

  if (Object.keys(patch).length === 0 && !emailError && typeof body.email !== "string") {
    return NextResponse.json({ ok: false, error: "ไม่มีข้อมูลที่จะบันทึก" }, { status: 400 });
  }

  if (Object.keys(patch).length > 0) {
    const [updated] = await supabaseRest<{ id: string }[]>(`users?id=eq.${uid}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
    if (!updated) return NextResponse.json({ ok: false, error: "ไม่พบบัญชีผู้ใช้" }, { status: 404 });
  }

  if (emailError) return NextResponse.json({ ok: false, error: emailError }, { status: 409 });

  // Backfill the Shopify link here too — this is where a LINE signup (whose
  // login scope never hands over an email/phone) actually gets one, via the
  // complete-profile step. Only bother if it isn't already linked.
  const [current] = await supabaseRest<
    { display_name: string | null; phone: string | null; shopify_customer_id: string | null }[]
  >(`users?id=eq.${uid}&select=display_name,phone,shopify_customer_id`);
  if (current && !current.shopify_customer_id) {
    const [emailIdentity] = await supabaseRest<{ provider_uid: string }[]>(
      `auth_identities?user_id=eq.${uid}&provider=eq.email&select=provider_uid`
    );
    await linkOrCreateShopifyCustomer(uid, {
      email: emailIdentity?.provider_uid || null,
      phone: current.phone,
      currentDisplayName: current.display_name,
      currentPhone: current.phone,
    });
  }

  return NextResponse.json({ ok: true });
}
