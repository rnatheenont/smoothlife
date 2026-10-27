import { createHash, createHmac, timingSafeEqual } from "crypto";

// Gates the internal /admin/* panel. Two kinds of session share one cookie
// and one token shape now:
//   - legacy: { admin: true, iat } — the original single shared password.
//     Kept working indefinitely so rolling out personal logins can never
//     lock the team out mid-migration; treated as "owner" everywhere a
//     permission is checked (see hasPermission below), matching today's
//     behaviour where the shared password could do anything.
//   - per-user: { admin: true, iat, userId, role } — issued after a real
//     admin_users row authenticates. Carries who they are so audit_log
//     writes and the permission matrix have something to check against.
// Signed with a key of its own. It used to reuse SESSION_SECRET so there was
// one less secret to manage, but that made the two blast radii the same: a
// SESSION_SECRET leaking anywhere in the customer-facing code would let
// anyone mint an admin token, and the payload is a base64url JSON object
// whose shape takes seconds to guess.
//
// The fallback keeps the team logged in while ADMIN_SESSION_SECRET is being
// added to each environment. Drop it — and this comment — once the variable
// is set everywhere.
const SECRET = process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || "";

/** False when neither signing secret is configured, so callers can answer
 *  with a clear 503 instead of a 500 from the throw below. */
export function adminSigningConfigured(): boolean {
  return SECRET.length > 0;
}
export const ADMIN_COOKIE = "sl_admin";
const MAX_AGE_SECONDS = 60 * 60 * 12; // 12h — shorter than customer sessions since admin access is more sensitive

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("hex");
}

export type AdminSession = { userId: string; role: string } | null;

export function createAdminToken(session?: { userId: string; role: string }): string {
  // An empty key still produces a valid-looking HMAC, and every token signed
  // with it is forgeable by anyone who notices. Refuse rather than hand one out.
  if (!SECRET) {
    throw new Error("admin-auth: neither ADMIN_SESSION_SECRET nor SESSION_SECRET is set — refusing to sign an admin token");
  }
  const payload = JSON.stringify({ admin: true, iat: Date.now(), ...(session ?? {}) });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function decodeAdminToken(token: string | undefined | null): { admin: boolean; iat: number; userId?: string; role?: string } | null {
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
    if (payload.admin !== true) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminToken(token: string | undefined | null): boolean {
  return decodeAdminToken(token) !== null;
}

/** When this token was signed, in epoch ms — null if it is invalid or
 *  expired. Compared against admin_users.sessions_valid_from so an account
 *  can be signed out everywhere without a session table. */
export function adminTokenIssuedAt(token: string | undefined | null): number | null {
  return decodeAdminToken(token)?.iat ?? null;
}

/** Who is actually signed in, if this is a per-user token — null for a
 *  legacy shared-password session (there is no "who" to name) or an
 *  invalid one. */
export function getAdminSession(token: string | undefined | null): AdminSession {
  const decoded = decodeAdminToken(token);
  if (!decoded?.userId || !decoded.role) return null;
  return { userId: decoded.userId, role: decoded.role };
}

export function checkAdminPassword(password: string): boolean {
  const secret = process.env.ADMIN_PANEL_SECRET || "";
  if (!secret) return false;
  // Compare digests, not the raw strings. Comparing the strings has to bail
  // out when the lengths differ, and that early return times differently —
  // enough to read the secret's length off the response.
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
