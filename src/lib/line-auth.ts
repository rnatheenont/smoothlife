// Server-only helpers for the real LINE Login OAuth flow (replaces the old
// client-only demo in LineLoginModal.tsx). Never import from a "use client"
// component — only from Route Handlers.

export const LINE_STATE_COOKIE = "sl_line_state";
export const LINE_RETURN_COOKIE = "sl_line_return";

export function lineConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
}

/**
 * Whether to ask LINE for the member's email address.
 *
 * Worth having because LINE is the one login that cannot recognise a member it
 * has already met: `profile` carries no email, so there is nothing to match on
 * and a returning customer gets a second, empty account. The email fixes that.
 *
 * Behind a flag because the scope needs LINE's own approval first, and LINE
 * rejects the whole authorization request if a channel asks for a permission it
 * has not been granted — turning "no email" into "nobody can log in at all".
 * Set LINE_EMAIL_SCOPE=1 once the LINE console shows the email permission as
 * approved, and not before.
 */
export function lineEmailScopeEnabled() {
  return process.env.LINE_EMAIL_SCOPE === "1";
}

/**
 * The email out of an OpenID id_token, or null.
 *
 * Verified through LINE rather than just decoded: the token arrives over a
 * direct TLS call, but this costs one request and removes the question.
 */
export async function lineEmailFromIdToken(idToken: string | undefined): Promise<string | null> {
  if (!idToken) return null;
  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: process.env.LINE_CHANNEL_ID! }),
    });
    if (!res.ok) {
      console.error("[line] id_token verify failed", res.status, await res.text());
      return null;
    }
    const claims: { email?: string } = await res.json();
    return claims.email?.toLowerCase() || null;
  } catch (err) {
    // A missing email must never cost someone their login — they simply get
    // the pre-email behaviour for this sign-in.
    console.error("[line] id_token verify threw", err);
    return null;
  }
}

export const lineOauthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Safari has a long-standing bug (bugs.webkit.org #219650) where a
  // SameSite=Lax cookie set on a redirect response — exactly what /start
  // does right before sending the browser to LINE — isn't reliably sent
  // back on the callback redirect, surfacing as "session expired"/state
  // mismatch. `none` sidesteps it; this is a short-lived CSRF-style
  // transaction cookie, not a tracking one, so the relaxed policy is safe.
  sameSite: "none" as const,
  path: "/",
  maxAge: 300, // 5 minutes — just long enough to complete the LINE redirect round trip
};
