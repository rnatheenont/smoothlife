import { NextRequest, NextResponse } from "next/server";
import { CompactEncrypt, CompactSign, importPKCS8, importSPKI, importX509 } from "jose";
import { createPublicKey, createHash, X509Certificate } from "crypto";
import { checkAdminPassword } from "@/lib/admin-auth";

// Temporary diagnostic endpoint — DELETE once the maintenance API works.
//
// The Recurring Payment Maintenance API (cancel + refund) answers HTTP 401,
// which is a rejection before any decryption happens, so the payload contents
// are not the problem. Two things about *how* the envelope is built could
// still explain it, and both are cheap to test against the real endpoint:
//
//   1. No `kid` in the JWS header. 2C2P has to pick which merchant public key
//      to verify a signature with; without an identifier in the one part they
//      can read before decrypting, they may simply refuse.
//   2. Encrypt-then-sign vs sign-then-encrypt. 2C2P's docs say "JWE + JWS"
//      without ever stating the nesting order, and the current code guessed
//      encrypt-then-sign.
//
// This posts an inquiry for a plan ID that cannot exist, in all four
// combinations, and reports what each gets back. Nothing is created or
// changed on 2C2P's side by an inquiry.
const MAINTENANCE_URL = "https://t.2c2p.com/PaymentAction/2.0/action";

function timestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

async function importTheirKey(pem: string, alg: string) {
  return pem.includes("BEGIN CERTIFICATE") ? importX509(pem, alg) : importSPKI(pem, alg);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!bearer || !checkAdminPassword(bearer)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const merchantId = process.env.TWOC2P_MERCHANT_ID;
  const privatePem = process.env.TWOC2P_MERCHANT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const theirPem = process.env.TWOC2P_PUBLIC_KEY?.replace(/\\n/g, "\n");
  if (!merchantId || !privatePem || !theirPem) {
    return NextResponse.json({ ok: false, error: "maintenance keys not configured" }, { status: 412 });
  }

  // The guide lists recurringStatus and amount as REQUIRED even for an
  // inquiry, and says the elements must appear in the documented order — the
  // "minimal" shape below omits both, which is the most likely reason every
  // JWE-wrapped attempt so far came back 400.
  const minimalXml = (planId: string) =>
    `<RecurringMaintenanceRequest><version>2.4</version><timeStamp>${timestamp(new Date())}</timeStamp>` +
    `<merchantID>${merchantId}</merchantID><recurringUniqueID>${planId}</recurringUniqueID>` +
    `<processType>I</processType></RecurringMaintenanceRequest>`;

  const fullXml = (planId: string) =>
    `<RecurringMaintenanceRequest><version>2.4</version><timeStamp>${timestamp(new Date())}</timeStamp>` +
    `<merchantID>${merchantId}</merchantID><recurringUniqueID>${planId}</recurringUniqueID>` +
    `<processType>I</processType><recurringStatus>Y</recurringStatus><amount>0.00</amount>` +
    `<allowAccumulate></allowAccumulate><maxAccumulateAmount></maxAccumulateAmount>` +
    `<recurringInterval></recurringInterval><recurringCount></recurringCount>` +
    `<chargeNextDate></chargeNextDate><chargeOnDate></chargeOnDate></RecurringMaintenanceRequest>`;

  async function build(
    order: "encrypt-then-sign" | "sign-then-encrypt" | "encrypt-only",
    withKid: boolean,
    planId: string,
    full: boolean
  ): Promise<string> {
    const bytes = new TextEncoder().encode(full ? fullXml(planId) : minimalXml(planId));
    const signHeader: Record<string, string> = { alg: "PS256" };
    if (withKid) signHeader.kid = merchantId!;

    if (order === "encrypt-only") {
      return new CompactEncrypt(bytes)
        .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" })
        .encrypt(await importTheirKey(theirPem!, "RSA-OAEP"));
    }
    if (order === "encrypt-then-sign") {
      const jwe = await new CompactEncrypt(bytes)
        .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" })
        .encrypt(await importTheirKey(theirPem!, "RSA-OAEP"));
      return new CompactSign(new TextEncoder().encode(jwe))
        .setProtectedHeader(signHeader as never)
        .sign(await importPKCS8(privatePem!, "PS256"));
    }
    const jws = await new CompactSign(bytes)
      .setProtectedHeader(signHeader as never)
      .sign(await importPKCS8(privatePem!, "PS256"));
    return new CompactEncrypt(new TextEncoder().encode(jws))
      .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" })
      .encrypt(await importTheirKey(theirPem!, "RSA-OAEP"));
  }

  // Round 1 established that a JWS on the outside gets an IIS-level 401
  // ("access denied") while a JWE on the outside reaches the application and
  // gets a plain 400 — so sign-then-encrypt is the shape 2C2P expects. Round 2
  // narrows down what the surviving 400 is actually complaining about, since
  // "PROBE-NONEXISTENT" is not a plausible recurringUniqueID and could be the
  // entire reason on its own.
  const variants: {
    name: string;
    order: "encrypt-then-sign" | "sign-then-encrypt" | "encrypt-only";
    kid: boolean;
    full: boolean;
  }[] = [
    { name: "sign-then-encrypt, FULL xml", order: "sign-then-encrypt", kid: false, full: true },
    { name: "sign-then-encrypt, FULL xml, kid", order: "sign-then-encrypt", kid: true, full: true },
    { name: "encrypt-only, FULL xml", order: "encrypt-only", kid: false, full: true },
    { name: "sign-then-encrypt, minimal xml (control)", order: "sign-then-encrypt", kid: false, full: false },
  ];

  // Baselines first. Three rounds of comparing our own envelope shapes against
  // each other established nothing, because the endpoint's *neutral* answer was
  // never measured. If plain garbage also returns 400, then 400 just means
  // "unparseable" and the JWS-outer 401 is the more meaningful reply — it would
  // mean 2C2P parsed the request and rejected the credentials, which points at
  // key registration rather than envelope nesting.
  const baselines: { name: string; body: string }[] = [
    { name: "BASELINE: plain text 'hello'", body: "hello" },
    { name: "BASELINE: empty body", body: "" },
    { name: "BASELINE: random base64url, JWS-shaped (3 parts)", body: "aaaa.bbbb.cccc" },
    { name: "BASELINE: random base64url, JWE-shaped (5 parts)", body: "aaaa.bbbb.cccc.dddd.eeee" },
  ];

  // Derives the public half of the key sitting in Vercel. Whatever was pasted
  // into 2C2P's portal has to match this exactly — if it doesn't, 2C2P can
  // never verify anything we sign, and no amount of envelope tweaking helps.
  // The public half is not a secret, so returning it in full is fine and is
  // the only way to actually compare the two by eye.
  let keyCheck: Record<string, unknown>;
  try {
    const ourPublicPem = createPublicKey(privatePem).export({ type: "spki", format: "pem" }).toString();
    const theirCert = theirPem.includes("BEGIN CERTIFICATE") ? new X509Certificate(theirPem) : null;
    keyCheck = {
      ourPublicKeyToUploadToPortal: ourPublicPem.trim(),
      ourPublicKeySha256: createHash("sha256").update(ourPublicPem.trim()).digest("hex").slice(0, 16),
      twoC2PKeyIsCertificate: Boolean(theirCert),
      twoC2PCertSubject: theirCert?.subject ?? null,
      twoC2PCertIssuer: theirCert?.issuer ?? null,
      twoC2PCertValidTo: theirCert?.validTo ?? null,
    };
  } catch (err) {
    keyCheck = { error: err instanceof Error ? err.message : String(err) };
  }

  const results = [];
  for (const b of baselines) {
    try {
      const res = await fetch(MAINTENANCE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: b.body,
      });
      const body = await res.text();
      results.push({ variant: b.name, httpStatus: res.status, bodyPrefix: body.slice(0, 120), bodyLength: body.length });
    } catch (err) {
      results.push({ variant: b.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  for (const v of variants) {
    try {
      const token = await build(v.order, v.kid, "123456789", v.full);
      const res = await fetch(MAINTENANCE_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: token,
      });
      const body = await res.text();
      results.push({
        variant: v.name,
        httpStatus: res.status,
        // Anything other than 401 is progress worth seeing verbatim, even an
        // error — it would mean 2C2P got far enough to read the request.
        bodyPrefix: body.slice(0, 300),
        bodyLength: body.length,
      });
    } catch (err) {
      results.push({ variant: v.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, endpoint: MAINTENANCE_URL, keyCheck, results });
}
