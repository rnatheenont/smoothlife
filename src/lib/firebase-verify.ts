// Server-only verification of Firebase Phone Auth ID tokens. Deliberately
// does NOT use firebase-admin — that needs a service-account credential
// (a real secret to manage) just to verify tokens. Firebase ID tokens are
// standard RS256 JWTs signed by Google; we verify the signature directly
// against Google's published certs, the same trick used to avoid pulling in
// a heavy SDK in edge/serverless contexts. Never import from a "use client"
// component.
import { createVerify } from "crypto";

const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export function firebaseVerifyConfigured() {
  return Boolean(PROJECT_ID);
}

let certsCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (certsCache && certsCache.expiresAt > Date.now()) return certsCache.certs;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`fetching Google certs failed: ${res.status}`);
  const certs = (await res.json()) as Record<string, string>;
  certsCache = { certs, expiresAt: Date.now() + 60 * 60 * 1000 }; // 1h, Google rotates rarely
  return certs;
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export type VerifiedPhoneToken = { uid: string; phoneNumber: string };

// Returns the verified {uid, phoneNumber} or null if the token is invalid,
// expired, or wasn't a phone sign-in. Never throws on a bad/malicious token
// — only on genuine infra failure (can't reach Google's certs endpoint).
export async function verifyFirebasePhoneIdToken(idToken: string): Promise<VerifiedPhoneToken | null> {
  if (!PROJECT_ID) return null;
  const parts = idToken.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  let header: { alg?: string; kid?: string };
  let payload: Record<string, any>;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf8"));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;

  const certs = await getGoogleCerts();
  const cert = certs[header.kid];
  if (!cert) return null;

  const signature = base64UrlDecode(sigB64);
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  const validSignature = verifier.verify(cert, signature);
  if (!validSignature) return null;

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.iss !== `https://securetoken.google.com/${PROJECT_ID}` ||
    payload.aud !== PROJECT_ID ||
    typeof payload.exp !== "number" ||
    payload.exp < now ||
    typeof payload.iat !== "number" ||
    payload.iat > now + 60 || // small clock-skew allowance
    payload.firebase?.sign_in_provider !== "phone" ||
    !payload.phone_number ||
    !payload.sub
  ) {
    return null;
  }

  return { uid: payload.sub, phoneNumber: payload.phone_number };
}
