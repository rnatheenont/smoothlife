// Server-only helpers for the real Google Sign-In OAuth flow, mirroring
// line-auth.ts's shape. Needs a Google Cloud OAuth client (Client ID +
// Client Secret) from console.cloud.google.com. Never import from a
// "use client" component — only from Route Handlers.

export const GOOGLE_STATE_COOKIE = "sl_google_state";
export const GOOGLE_RETURN_COOKIE = "sl_google_return";

export function googleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export const googleOauthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  // Safari has a long-standing bug (bugs.webkit.org #219650) where a
  // SameSite=Lax cookie set on a redirect response — exactly what /start
  // does right before sending the browser to Google — isn't reliably sent
  // back on the callback redirect, surfacing as "session expired"/state
  // mismatch. `none` sidesteps it; this is a short-lived CSRF-style
  // transaction cookie, not a tracking one, so the relaxed policy is safe.
  sameSite: "none" as const,
  path: "/",
  maxAge: 300, // 5 minutes — just long enough to complete the Google redirect round trip
};
