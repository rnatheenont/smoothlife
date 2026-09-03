// Server-side verification for a LIFF ID token (liff.getIDToken() on the
// client).
// Docs: https://developers.line.biz/en/docs/line-login/verify-id-token/
//
// A LIFF app is not necessarily under the same LINE Login channel the website
// uses. This project's LIFF app is `2010904503-…` while LINE_CHANNEL_ID (the
// web login) is a different channel, and LINE issues the ID token with `aud`
// set to the LIFF app's own channel — so verifying against LINE_CHANNEL_ID
// rejected every LIFF login outright.
//
// A LIFF ID is `{channelId}-{suffix}`, so the channel to verify against is
// already in the value we ship to the browser; no extra env var, and the web
// login keeps using its own channel untouched.

export type LiffProfile = {
  userId: string; // `sub`
  displayName: string | null;
  pictureUrl: string | null;
};

/** The channel that issued LIFF ID tokens, falling back to the login channel. */
function liffChannelId(): string | undefined {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
  const fromLiff = liffId?.split("-")[0];
  return fromLiff && /^\d+$/.test(fromLiff) ? fromLiff : process.env.LINE_CHANNEL_ID;
}

export function liffConfigured() {
  return Boolean(liffChannelId());
}

export async function verifyLiffIdToken(idToken: string): Promise<LiffProfile | null> {
  const channelId = liffChannelId();
  if (!channelId) return null;
  try {
    const res = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
    });
    if (!res.ok) {
      // Worth the log line: this is the failure mode a channel/LIFF mismatch
      // produces, and it is otherwise invisible — the customer just sees a
      // generic "couldn't sign in".
      console.error("[line-liff-verify] LINE rejected the id token", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = await res.json();
    if (!data.sub) return null;
    if (data.aud !== channelId) {
      console.error("[line-liff-verify] token audience mismatch", { expected: channelId, got: data.aud });
      return null;
    }
    return { userId: data.sub, displayName: data.name || null, pictureUrl: data.picture || null };
  } catch (err) {
    console.error("[line-liff-verify]", err);
    return null;
  }
}
