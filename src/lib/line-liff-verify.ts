// Server-side verification for a LIFF ID token (liff.getIDToken() on the
// client). Same channel as LINE Login (LINE_CHANNEL_ID/SECRET) — a LIFF app
// is added under a LINE Login channel, not a separate Messaging API one, so
// no extra credentials are needed here.
// Docs: https://developers.line.biz/en/docs/line-login/verify-id-token/

export type LiffProfile = {
  userId: string; // `sub`
  displayName: string | null;
  pictureUrl: string | null;
};

export function liffConfigured() {
  return Boolean(process.env.LINE_CHANNEL_ID);
}

export async function verifyLiffIdToken(idToken: string): Promise<LiffProfile | null> {
  if (!liffConfigured()) return null;
  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: process.env.LINE_CHANNEL_ID! }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.sub || data.aud !== process.env.LINE_CHANNEL_ID) return null;
    return { userId: data.sub, displayName: data.name || null, pictureUrl: data.picture || null };
  } catch (err) {
    console.error("[line-liff-verify]", err);
    return null;
  }
}
