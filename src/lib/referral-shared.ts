// Constants/helpers safe to import from BOTH server code and "use client"
// components — no Node-only APIs. Crypto-based code generation lives in
// @/lib/referral instead (server-only, imports node:crypto).
export const REFERRAL_COOKIE = "sl_referral";
export const REFEREE_DISCOUNT_AMOUNT = 100; // ฿ off the friend's first order
export const REFEREE_MIN_SUBTOTAL = 500; // ฿ minimum to use that discount
export const REFERRAL_LINK_WINDOW_DAYS = 30; // friend's discount code validity from link click
export const REFERRAL_HOLD_DAYS = 14; // delivery -> reward release, covers the return window
export const REFERRER_REWARD_AMOUNT = 100; // ฿ coupon credited to the referrer
export const REFERRAL_ANNUAL_CAP = 20; // successful referrals per referrer per year
export const REFERRER_ACTIVE_MONTHS = 3; // referrer must have ordered within this window to refer

export type ReferralCookiePayload = {
  referralId: string;
  code: string;
  discountCode: string;
  expiresAt: string; // ISO — mirrors the row's discount_expires_at
};

export function parseReferralCookie(raw: string | undefined | null): ReferralCookiePayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.referralId === "string" && typeof parsed.discountCode === "string") {
      return parsed as ReferralCookiePayload;
    }
    return null;
  } catch {
    return null;
  }
}

// Not httpOnly: the cart needs to read this client-side to auto-apply the
// discount. It only ever carries a referral id + a discount code that
// Shopify itself enforces (single-use, min subtotal) — same trust level as
// the rest of this app's client-visible coupon-code system.
export function referralCookieOptions(expiresAt: Date) {
  return {
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
  };
}

// Client-side read of the same cookie, for the cart to auto-apply the
// friend's discount without a round trip. Returns null past its own
// expiresAt even if the browser hasn't evicted the cookie yet.
export function readReferralCookie(): ReferralCookiePayload | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${REFERRAL_COOKIE}=([^;]*)`));
  if (!match) return null;
  const payload = parseReferralCookie(decodeURIComponent(match[1]));
  if (!payload) return null;
  if (new Date(payload.expiresAt).getTime() <= Date.now()) return null;
  return payload;
}
