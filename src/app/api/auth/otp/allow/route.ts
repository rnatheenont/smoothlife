import { NextRequest, NextResponse } from "next/server";
import { clientIp, isRateLimitedShared } from "@/lib/rate-limit";
import { toE164Thai } from "@/lib/thai-phone";

// Permission to send one SMS.
//
// The code itself is sent by Firebase, from the browser — our server never
// sees it and cannot refuse it after the fact. The only place a ceiling can
// go is in front: the form asks here first, and only reaches for Firebase
// when the answer is yes.
//
// That makes this a gate on *our* form rather than on Firebase, and it is
// worth being clear about the difference. Someone who writes their own
// script against the public Firebase config skips it entirely — Firebase's
// own abuse protection and App Check are what answer that. What this stops
// is the ordinary shape of the problem: one person, one form, one finger on
// the button, and a bill that grows while nobody is watching.
//
// Nothing here is security. A refusal costs the shopper a message asking
// them to wait or use email; it never decides who they are.

/** Per number. Three in an hour is somebody not receiving them. */
const PER_PHONE_HOUR = 3;
/** Per number, per day. Past this the number is not the problem. */
const PER_PHONE_DAY = 6;
/**
 * Per network. Households, offices and mobile carriers share an address, so
 * this is deliberately loose — it is the backstop for a script, not a quota
 * for a family.
 */
const PER_IP_DAY = 20;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const raw = typeof body?.phone === "string" ? body.phone : "";
  // Canonical first, then checked. Counting digits on what was typed
  // rejected "+66..." for being eleven digits long — a number this very
  // function then converts correctly. The allowance is keyed on the
  // canonical form too, so 08x, +668x and 668x are one number rather than
  // three separate ones.
  const phone = toE164Thai(raw);
  if (!/^\+66\d{8,9}$/.test(phone)) {
    return NextResponse.json({ ok: false, error: "เบอร์โทรศัพท์ไม่ถูกต้อง" }, { status: 400 });
  }
  const ip = clientIp(req);

  if (await isRateLimitedShared(`otp-send:phone:${phone}:h`, PER_PHONE_HOUR, HOUR)) {
    return NextResponse.json(
      { ok: false, error: "ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ หรือเข้าสู่ระบบด้วยอีเมล" },
      { status: 429 },
    );
  }
  if (await isRateLimitedShared(`otp-send:phone:${phone}:d`, PER_PHONE_DAY, DAY)) {
    return NextResponse.json(
      { ok: false, error: "ขอรหัสสำหรับเบอร์นี้ครบจำนวนของวันนี้แล้ว กรุณาเข้าสู่ระบบด้วยอีเมล" },
      { status: 429 },
    );
  }
  if (await isRateLimitedShared(`otp-send:ip:${ip}:d`, PER_IP_DAY, DAY)) {
    return NextResponse.json(
      { ok: false, error: "ขอรหัสจากเครือข่ายนี้บ่อยเกินไป กรุณาเข้าสู่ระบบด้วยอีเมล" },
      { status: 429 },
    );
  }

  return NextResponse.json({ ok: true });
}
