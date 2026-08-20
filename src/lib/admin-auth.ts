import { createHmac, timingSafeEqual } from "crypto";

// Gates the internal /admin/* panel — a single shared password (this app has
// no staff/role system), not a per-user account. Reuses SESSION_SECRET as
// the signing key so no separate secret has to be managed.
const SECRET = process.env.SESSION_SECRET || "";
export const ADMIN_COOKIE = "sl_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h — shorter than customer sessions since it's one shared credential

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export function createAdminToken(): string {
  const payload = JSON.stringify({ admin: true, iat: Date.now() });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  if (!token || !SECRET) return false;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return false;
  const expected = sign(encoded);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (Date.now() - payload.iat > MAX_AGE_SECONDS * 1000) return false;
    return payload.admin === true;
  } catch {
    return false;
  }
}

export function checkAdminPassword(password: string): boolean {
  const secret = process.env.ADMIN_PANEL_SECRET || "";
  if (!secret) return false;
  const a = Buffer.from(password);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
