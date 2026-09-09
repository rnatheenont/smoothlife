// When a Shopify record provably belongs to an account, and when it only
// looks like it does.
//
// The difference decides whether the system may link the two on its own or
// whether a person has to vouch for it, so the rule lives in one place and
// both the admin screen and the link endpoint ask it the same question. Proof
// means an identity the customer has actually authenticated — an email they
// signed in with, a phone they answered an OTP on. A name, an address, or a
// phone number typed into a profile is a resemblance, and linking on a
// resemblance shows one person another person's orders.

export type AccountIdentity = { provider: string; uid: string; verified: boolean };

/** Thai numbers are written +66…, 66… and 0… for the same phone. */
function samePhone(a: string | null | undefined, b: string | null | undefined) {
  const norm = (v: string) => v.replace(/[^\d]/g, "").replace(/^66/, "0").replace(/^0*/, "0");
  if (!a || !b) return false;
  return norm(a) === norm(b) && norm(a).length >= 9;
}

/**
 * Why this Shopify record certainly belongs to this account, or null.
 *
 * The returned string is written into the audit log, so it has to read as a
 * reason someone can check later rather than a boolean nobody can question.
 */
export function provenMatch(
  identities: AccountIdentity[],
  candidate: { email?: string | null; phone?: string | null }
): string | null {
  for (const i of identities) {
    if (!i.verified) continue;
    if (i.provider === "email" && candidate.email && i.uid.trim().toLowerCase() === candidate.email.trim().toLowerCase()) {
      return `อีเมลที่ยืนยันแล้ว (${i.uid}) ตรงกับอีเมลในใบ Shopify`;
    }
    if (i.provider === "phone_otp" && samePhone(i.uid, candidate.phone)) {
      return `เบอร์ที่ยืนยันด้วย OTP (${i.uid}) ตรงกับเบอร์ในใบ Shopify`;
    }
  }
  return null;
}
