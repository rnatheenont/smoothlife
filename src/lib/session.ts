import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.SESSION_SECRET || "";
export const SESSION_COOKIE = "sl_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export function createSessionToken(userId: string): string {
  const payload = JSON.stringify({ uid: userId, iat: Date.now() });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifySessionToken(token: string | undefined | null): string | null {
  if (!token || !SECRET) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const expected = sign(encoded);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (Date.now() - payload.iat > MAX_AGE_SECONDS * 1000) return null;
    return payload.uid as string;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
