// Server-only helpers for the real LINE Login OAuth flow (replaces the old
// client-only demo in LineLoginModal.tsx). Never import from a "use client"
// component — only from Route Handlers.

export const LINE_STATE_COOKIE = "sl_line_state";
export const LINE_RETURN_COOKIE = "sl_line_return";

export function lineConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ID && process.env.LINE_CHANNEL_SECRET);
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
