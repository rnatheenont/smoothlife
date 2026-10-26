import { createHmac, timingSafeEqual } from "crypto";

// A short-lived note that says "this person just proved they hold that
// channel, and the channel belongs to that other account".
//
// It exists because proving a channel and agreeing to merge are two steps,
// and the proof is used up by the first one. The OTP code is consumed the
// moment it is checked — that is what stops it being replayed — so by the
// time the shopper has read what the merge will do and pressed the button,
// there is nothing left to re-verify. Asking for a second code would be
// asking them to prove the same thing twice.
//
// Signed with the session secret, valid for ten minutes, and bound to the
// session it was issued to: a ticket lifted from a response body is worth
// nothing without that session's cookie, and it can only ever authorise the
// one merge it names.

const TTL_MS = 10 * 60 * 1000;

// Read when used rather than when imported. A module-scope read bakes in
// whatever the environment held at import time, which is a different value
// under the test runner than under the server, and the difference only
// shows up as tickets that mysteriously never verify.
function secret(): string {
  return process.env.SESSION_SECRET || "";
}

export type MergeTicket = {
  /** The account the shopper is signed in as. */
  session: string;
  /** The account that holds the channel they just proved. */
  other: string;
  /** How they proved it, for the audit row. */
  via: string;
  uid: string;
};

/**
 * Where a ticket waits when it was earned by a redirect rather than a fetch.
 *
 * Signing in with Google or LINE ends in a browser navigation, so there is
 * no response body for the ticket to ride in — and it is a credential, so
 * it does not go in the URL either, where it would reach server logs,
 * browser history and the `Referer` of the next request. A cookie with the
 * same ten-minute life as the ticket inside it.
 */
export const MERGE_TICKET_COOKIE = "sl_merge";

export const mergeTicketCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TTL_MS / 1000,
};

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function createMergeTicket(t: MergeTicket): string {
  const encoded = Buffer.from(JSON.stringify({ ...t, iat: Date.now() })).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

/**
 * Returns the ticket only when it is intact, unexpired, and was issued to
 * this session. `sessionUserId` is the caller's own session, never anything
 * read out of the ticket — that check is the whole point of it.
 */
export function readMergeTicket(token: unknown, sessionUserId: string): MergeTicket | null {
  if (typeof token !== "string" || !secret()) return null;
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(encoded));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
    if (Date.now() - payload.iat > TTL_MS) return null;
    if (payload.session !== sessionUserId) return null;
    if (!payload.other || payload.other === payload.session) return null;
    return { session: payload.session, other: payload.other, via: payload.via, uid: payload.uid };
  } catch {
    return null;
  }
}
