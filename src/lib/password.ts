import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// scrypt with a per-password random salt — stored as "salt:hash", both hex.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, 64);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
