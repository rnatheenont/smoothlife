import { createHmac } from "crypto";
import { clientIp, isRateLimitedShared } from "@/lib/rate-limit";

// What stops one person with a script from being a hundred customers.
//
// The per-account limits already in place answer "how fast is this one person
// going". They say nothing about a hundred accounts doing one thing each,
// which is exactly the shape of a flash-sale bot: sign up a hundred times,
// queue once from each, hold every slot until the clock runs out. One account
// one slot is the right rule and it does not help here at all.
//
// So two things live here. A ceiling per source address, generous enough that
// a household, an office or a university campus never notices it and tight
// enough that a farm does. And a way to notice afterwards: a fingerprint
// stored beside a queue entry, so "these nine places in line came from one
// address" is a question the admin screen can answer.

/**
 * The address, hashed, so the record cannot be read back as a location.
 *
 * Keyed on SESSION_SECRET rather than stored raw: comparing two entries only
 * needs the values to match each other, never to be readable. An address that
 * is missing hashes to a constant, which would make every unknown look like
 * the same source — so it stays distinguishable as "unknown".
 */
export function sourceFingerprint(req: Request): string | null {
  const ip = clientIp(req);
  if (!ip || ip === "unknown") return null;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

/**
 * A ceiling on one source address, whatever accounts it is wearing.
 *
 * Deliberately loose. A shared office address doing ordinary shopping should
 * never see this, which means the number has to be well above what a real
 * crowd does and well below what a script does — there is a wide gap between
 * those two and the limit belongs in the middle of it, not at the edge of
 * normal use.
 */
export function ipLimited(req: Request, name: string, max: number, windowMs: number): Promise<boolean> {
  return isRateLimitedShared(`${name}:ip:${clientIp(req)}`, max, windowMs);
}

/** The same answer in the two words a customer needs. */
export const TOO_MANY_TH = "มีการใช้งานถี่ผิดปกติจากเครือข่ายนี้ กรุณารอสักครู่แล้วลองใหม่";
