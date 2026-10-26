import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { supabaseConfigured, supabaseRest, pgValue } from "@/lib/supabase-server";
import { verifyFirebasePhoneIdToken } from "@/lib/firebase-verify";
import { isRateLimitedShared } from "@/lib/rate-limit";
import { createMergeTicket } from "@/lib/merge-ticket";
import { channelLabel } from "@/lib/account-identities";

// Attach a channel to the account the shopper is already signed in as.
//
// Three endings, and the third is the one this exists for:
//
//   linked          the channel was free, it is theirs now
//   merge_required  it belongs to another account — here is what that
//                   account holds, and a ticket to fold the two together
//   (an error)      they did not prove it
//
// Nothing here ever switches the session to a different account, and
// nothing here merges. Proving a channel and agreeing to give up an account
// are separate decisions, and the second one is the shopper's to make with
// the numbers in front of them.

const MAX_ATTEMPTS = 5;

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/** Burns the emailed code, or says why it cannot be burned. */
async function consumeEmailCode(email: string, code: string): Promise<string | null> {
  const [challenge] = await supabaseRest<
    { id: string; code_hash: string; expires_at: string; attempt_count: number }[]
  >(
    `otp_challenges?provider=eq.email&target=eq.${encodeURIComponent(email)}&consumed_at=is.null` +
      `&order=created_at.desc&limit=1&select=id,code_hash,expires_at,attempt_count`,
  );
  if (!challenge || new Date(challenge.expires_at).getTime() < Date.now()) {
    return "รหัสหมดอายุ กรุณาขอรหัสใหม่";
  }
  if (challenge.attempt_count >= MAX_ATTEMPTS) {
    return "กรอกรหัสผิดหลายครั้งเกินไป กรุณาขอรหัสใหม่";
  }
  if (challenge.code_hash !== hashCode(code.trim())) {
    await supabaseRest(`otp_challenges?id=eq.${challenge.id}`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ attempt_count: challenge.attempt_count + 1 }),
    });
    return "รหัสไม่ถูกต้อง";
  }
  await supabaseRest(`otp_challenges?id=eq.${challenge.id}`, {
    method: "PATCH",
    returning: false,
    body: JSON.stringify({ consumed_at: new Date().toISOString() }),
  });
  return null;
}

export async function POST(req: NextRequest) {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!uid) return NextResponse.json({ ok: false, error: "กรุณาเข้าสู่ระบบ" }, { status: 401 });
  if (!supabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "ระบบยังไม่พร้อมใช้งาน" }, { status: 503 });
  }
  // Each attempt costs a code somebody had to receive; this is the ceiling
  // on guessing at them from one account.
  if (await isRateLimitedShared(`link-identity:${uid}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json(
      { ok: false, error: "ลองเชื่อมช่องทางบ่อยเกินไป รอสักครู่แล้วลองใหม่" },
      { status: 429 },
    );
  }

  const body = await req.json().catch(() => null);
  const provider = body?.provider;

  let uidValue: string;
  if (provider === "email") {
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const code = typeof body?.code === "string" ? body.code : "";
    if (!email || !code) {
      return NextResponse.json({ ok: false, error: "คำขอไม่ถูกต้อง" }, { status: 400 });
    }
    const failure = await consumeEmailCode(email, code);
    if (failure) return NextResponse.json({ ok: false, error: failure }, { status: 401 });
    uidValue = email;
  } else if (provider === "phone_otp") {
    // The phone is proved by Firebase, the same way signing in with it is;
    // this route only reads the number out of the token it hands back.
    const verified = await verifyFirebasePhoneIdToken(
      typeof body?.idToken === "string" ? body.idToken : "",
    );
    if (!verified?.phoneNumber) {
      return NextResponse.json({ ok: false, error: "ยืนยันเบอร์ไม่สำเร็จ กรุณาลองใหม่" }, { status: 401 });
    }
    uidValue = verified.phoneNumber;
  } else {
    return NextResponse.json({ ok: false, error: "ช่องทางนี้ยังไม่รองรับ" }, { status: 400 });
  }

  const [owner] = await supabaseRest<{ user_id: string }[]>(
    `auth_identities?provider=eq.${pgValue(provider)}&provider_uid=eq.${pgValue(uidValue)}` +
      `&select=user_id&limit=1`,
  ).catch(() => []);

  if (owner?.user_id === uid) {
    return NextResponse.json({ ok: true, state: "linked", alreadyMine: true, provider });
  }

  if (owner?.user_id) {
    // Somebody else's — almost always their own other account, which is the
    // whole reason this page exists. The preview is read fresh here so the
    // numbers the shopper agrees to are the numbers at the moment they
    // agree, not whatever the page loaded with.
    const preview = await supabaseRest<Record<string, unknown>>("rpc/account_merge_preview", {
      method: "POST",
      body: JSON.stringify({ p_a: uid, p_b: owner.user_id }),
    }).catch(() => null);

    return NextResponse.json({
      ok: true,
      state: "merge_required",
      provider,
      message: `${channelLabel(provider)}นี้ผูกอยู่กับอีกบัญชีหนึ่ง`,
      preview,
      ticket: createMergeTicket({ session: uid, other: owner.user_id, via: provider, uid: uidValue }),
    });
  }

  await supabaseRest("auth_identities", {
    method: "POST",
    returning: false,
    body: JSON.stringify({
      user_id: uid,
      provider,
      provider_uid: uidValue,
      verified_at: new Date().toISOString(),
    }),
  });

  // A phone proved here is the account's phone number too, unless one is
  // already on file — the account page and the courier read that column,
  // not auth_identities.
  if (provider === "phone_otp") {
    await supabaseRest(`users?id=eq.${pgValue(uid)}&phone=is.null`, {
      method: "PATCH",
      returning: false,
      body: JSON.stringify({ phone: uidValue }),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, state: "linked", provider });
}
