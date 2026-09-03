import { NextRequest, NextResponse } from "next/server";
import { isRateLimited, clientIp } from "@/lib/rate-limit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

// The AI endpoints (translate, skin analysis, skin coach) each spend real money
// on the Anthropic API per call, and none of them require an account — which is
// deliberate, since making a shopper sign up before they can try the skin
// advisor would gut the feature. That leaves the bill open to anyone with curl.
//
// So: a small allowance for anonymous visitors, a much larger one once they
// have an account. Enough for genuine use either way, not enough to be worth
// scripting. Signed-in users are keyed by user id rather than IP so a whole
// office behind one NAT doesn't share a single budget.
const ANON_MAX_PER_HOUR = 10;
const SIGNED_IN_MAX_PER_HOUR = 60;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Returns a 429 response when the caller is over budget, or null to proceed.
 * `feature` keeps the three endpoints on separate allowances — using the skin
 * advisor shouldn't eat into the translation budget of the same page.
 */
export function aiRateLimit(req: NextRequest, feature: string): NextResponse | null {
  const uid = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  const key = uid ? `ai:${feature}:user:${uid}` : `ai:${feature}:ip:${clientIp(req)}`;
  const max = uid ? SIGNED_IN_MAX_PER_HOUR : ANON_MAX_PER_HOUR;

  if (!isRateLimited(key, max, WINDOW_MS)) return null;

  return NextResponse.json(
    {
      ok: false,
      error: uid
        ? "ใช้งานบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่ค่ะ"
        : "ใช้งานครบจำนวนครั้งของผู้เยี่ยมชมแล้ว — เข้าสู่ระบบเพื่อใช้งานต่อได้เลยค่ะ",
      needsSignIn: !uid,
    },
    { status: 429 }
  );
}
