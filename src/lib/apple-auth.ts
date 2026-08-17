// Server-only helpers for Sign in with Apple, mirroring line-auth.ts's
// shape. Needs a paid Apple Developer account: a Services ID (the "client
// id"), a Sign in with Apple private key (.p8) + its Key ID, and the Team
// ID — none of which can be generated from here, only from
// developer.apple.com by whoever owns that account. Never import from a
// "use client" component — only from Route Handlers.
import { createSign } from "crypto";

export const APPLE_STATE_COOKIE = "sl_apple_state";
export const APPLE_RETURN_COOKIE = "sl_apple_return";

export function appleConfigured() {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
  );
}

export const appleOauthCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "none" as const, // Apple's callback is a cross-site POST (form_post) — Lax would drop these cookies
  path: "/",
  maxAge: 300,
};

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

// Apple's token endpoint doesn't take a static secret — it wants a JWT,
// signed with the Sign in with Apple private key, that's valid for at most
// 6 months. Generating one fresh per request (short 5-minute expiry) is
// simplest and avoids caching a signed token across deployments.
export function generateAppleClientSecret(): string {
  const teamId = process.env.APPLE_TEAM_ID!;
  const keyId = process.env.APPLE_KEY_ID!;
  const clientId = process.env.APPLE_CLIENT_ID!;
  // Vercel env vars can't hold real newlines cleanly — the key is stored
  // with literal "\n" sequences and unescaped here.
  const privateKey = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "ES256", kid: keyId };
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + 300,
    aud: "https://appleid.apple.com",
    sub: clientId,
  };

  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // Apple requires the raw (r||s) signature format for ES256 JWTs, not the
  // DER format Node's crypto produces by default.
  const signature = createSign("SHA256").update(signingInput).sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${base64url(signature)}`;
}

export type AppleIdTokenClaims = {
  sub: string;
  email?: string;
};

// Decodes (not cryptographically verifies) the id_token payload — the token
// just came back over a direct HTTPS POST to Apple that we authenticated
// with our own signed client secret, so the transport itself is the trust
// boundary here rather than a separate JWKS signature check.
export function decodeAppleIdToken(idToken: string): AppleIdTokenClaims | null {
  try {
    const payload = idToken.split(".")[1];
    const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!json.sub) return null;
    return { sub: json.sub, email: json.email };
  } catch {
    return null;
  }
}
