import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { pgValue, supabaseConfigured, supabaseRest } from "@/lib/supabase-server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { emailConfigured, sendEmail, otpEmailHtml } from "@/lib/email";
import { emailSendLimited, isRateLimitedShared } from "@/lib/rate-limit";
import { canonStaffEmail, reasonTh } from "@/lib/staff-sale";
import { staffRpc, type RpcResult } from "@/lib/staff-sale-rpc";
import { currentStaffRound } from "@/lib/staff-shop";

// Proving a company mailbox, once per round.
//
// POST          → send a code to the address
// POST ?confirm → check the code, then staff_verify
//
// This is not a login. The person is already signed in as whoever they are;
// the code proves they can still read mail at @smooth-e.com, which is what
// stands in for asking HR whether they still work here — somebody who left
// cannot open that mailbox any more.
//
// provider = 'staff_email', never 'email'. With one namespace, a code
// requested here could be typed into the login form and would sign the
// requester in as that employee. See the migration's own note.

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const PROVIDER = "staff_email";

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * The same words whether the address is unknown, blocked, or already used by
 * another account.
 *
 * Telling somebody *why* they were refused tells them whether they are on a
 * blocklist, and tells anyone with a list of addresses which of them work
 * here. The console knows the real reason; the person gets one sentence and
 * somebody to ask.
 */
const VAGUE = "อีเมลนี้ยังไม่มีสิทธิ์ซื้อในรอบนี้ ถ้าคิดว่าผิดพลาด ติดต่อฝ่ายบุคคล";

export async function POST(req: NextRequest) {
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }
  const userId = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });

  const round = await currentStaffRound();
  if (!round) return NextResponse.json({ ok: false, error: "ยังไม่มีรอบการซื้อที่เปิดอยู่" }, { status: 409 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? canonStaffEmail(body.email) : null;
  if (!email) return NextResponse.json({ ok: false, error: "อีเมลไม่ถูกต้อง" }, { status: 400 });

  const confirming = req.nextUrl.searchParams.get("confirm") === "1";

  if (!confirming) {
    // Three limits, because there are three things to protect: the mailbox
    // from being used as a doorbell, this account from grinding through a
    // list of addresses, and Resend's reputation from the network that
    // tries it.
    if (await isRateLimitedShared(`staff-otp:${userId}`, 8, 60 * 60 * 1000)) {
      return NextResponse.json(
        { ok: false, error: "ขอรหัสบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429 },
      );
    }
    if (await emailSendLimited(req)) {
      return NextResponse.json(
        { ok: false, error: "มีการขอรหัสจากเครือข่ายนี้บ่อยเกินไป กรุณารอสักครู่" },
        { status: 429 },
      );
    }
    const recent = await supabaseRest<{ created_at: string }[]>(
      `otp_challenges?provider=eq.${PROVIDER}&target=eq.${pgValue(email)}&order=created_at.desc&limit=1&select=created_at`,
    );
    if (recent[0] && Date.now() - new Date(recent[0].created_at).getTime() < RESEND_COOLDOWN_MS) {
      return NextResponse.json({ ok: false, error: "กรุณารอสักครู่ก่อนขอรหัสใหม่" }, { status: 429 });
    }

    // Eligibility is checked before a single mail goes out. Not for the
    // person's benefit — the answer they get is the same either way — but
    // because sending a code to an address that can never pass is sending
    // mail to strangers on request.
    const [blocked, allowed] = await Promise.all([
      supabaseRest<{ id: string }[]>(
        `staff_eligibility?kind=eq.block_email&value=eq.${pgValue(email)}&revoked_at=is.null&select=id&limit=1`,
      ),
      supabaseRest<{ id: string }[]>(
        `staff_eligibility?revoked_at=is.null&or=(and(kind.eq.allow_email,value.eq.${pgValue(email)}),and(kind.eq.allow_domain,value.eq.${pgValue(email.split("@")[1])}))&select=id,expires_at&limit=5`,
      ),
    ]);
    if (blocked?.[0] || !allowed?.[0]) {
      return NextResponse.json({ ok: false, error: VAGUE }, { status: 403 });
    }

    const code = String(randomInt(100000, 1000000));
    await supabaseRest("otp_challenges", {
      method: "POST",
      returning: false,
      body: JSON.stringify({
        provider: PROVIDER,
        target: email,
        code_hash: hashCode(code),
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      }),
    });

    if (!emailConfigured()) {
      // Same rule as the login OTP: never hand the code back in production,
      // or anyone could read a code for somebody else's mailbox off their
      // own screen.
      if (process.env.VERCEL_ENV !== "production") {
        return NextResponse.json({ ok: true, emailSent: false, devCode: code });
      }
      return NextResponse.json(
        { ok: false, error: "ระบบส่งอีเมลยังไม่พร้อมใช้งาน กรุณาติดต่อฝ่ายบุคคล" },
        { status: 503 },
      );
    }

    try {
      await sendEmail(email, "รหัสยืนยันสิทธิ์พนักงาน Smoothlife.com", otpEmailHtml(code));
    } catch (err) {
      console.error("[staff/verify] send failed", err);
      return NextResponse.json({ ok: false, error: "ส่งอีเมลไม่สำเร็จ กรุณาลองใหม่" }, { status: 502 });
    }
    return NextResponse.json({ ok: true, emailSent: true });
  }

  // --- confirming ---

  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "กรุณากรอกรหัส 6 หลัก" }, { status: 400 });
  }
  if (await isRateLimitedShared(`staff-otp-try:${userId}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, error: "ลองบ่อยเกินไป กรุณารอสักครู่" }, { status: 429 });
  }

  const [challenge] = await supabaseRest<
    { id: string; code_hash: string; expires_at: string; attempt_count: number }[]
  >(
    `otp_challenges?provider=eq.${PROVIDER}&target=eq.${pgValue(email)}&consumed_at=is.null&order=created_at.desc&limit=1&select=id,code_hash,expires_at,attempt_count`,
  );
  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "รหัสหมดอายุ กรุณาขอรหัสใหม่" }, { status: 401 });
  }
  if (challenge.attempt_count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { ok: false, error: "กรอกรหัสผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่" },
      { status: 429 },
    );
  }
  if (challenge.code_hash !== hashCode(code)) {
    await supabaseRest(`otp_challenges?id=eq.${pgValue(challenge.id)}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ attempt_count: challenge.attempt_count + 1 }),
    });
    return NextResponse.json({ ok: false, error: "รหัสไม่ถูกต้อง" }, { status: 401 });
  }

  // Consumed before staff_verify, not after: a code that has been read out
  // correctly is spent whatever the RPC then decides, so it cannot be
  // replayed against a different account.
  await supabaseRest(`otp_challenges?id=eq.${pgValue(challenge.id)}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
  });

  const res = await staffRpc<RpcResult>("staff_verify", {
    p_round: round.id,
    p_user: userId,
    p_email: email,
  });
  if (!res?.ok) {
    // The one refusal worth explaining: this mailbox is already tied to a
    // different account in this round, and the person needs to know it is
    // not the code that was wrong.
    const error =
      res?.reason === "email_or_account_taken" ? reasonTh(res.reason) : VAGUE;
    return NextResponse.json({ ok: false, error, reason: res?.reason }, { status: 403 });
  }

  return NextResponse.json({ ok: true, email, cap_thb: res.cap_thb });
}
