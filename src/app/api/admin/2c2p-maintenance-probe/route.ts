import { NextRequest, NextResponse } from "next/server";
import { CompactEncrypt, CompactSign, importPKCS8, importSPKI, importX509 } from "jose";
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

  const xml =
    `<RecurringMaintenanceRequest><version>2.4</version><timeStamp>${timestamp(new Date())}</timeStamp>` +
    `<merchantID>${merchantId}</merchantID><recurringUniqueID>PROBE-NONEXISTENT</recurringUniqueID>` +
    `<processType>I</processType></RecurringMaintenanceRequest>`;
  const bytes = new TextEncoder().encode(xml);

  async function build(order: "encrypt-then-sign" | "sign-then-encrypt", withKid: boolean): Promise<string> {
    const signHeader: Record<string, string> = { alg: "PS256" };
    if (withKid) signHeader.kid = merchantId!;

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

  const variants: { name: string; order: "encrypt-then-sign" | "sign-then-encrypt"; kid: boolean }[] = [
    { name: "encrypt-then-sign, no kid (current code)", order: "encrypt-then-sign", kid: false },
    { name: "encrypt-then-sign, with kid", order: "encrypt-then-sign", kid: true },
    { name: "sign-then-encrypt, no kid", order: "sign-then-encrypt", kid: false },
    { name: "sign-then-encrypt, with kid", order: "sign-then-encrypt", kid: true },
  ];

  const results = [];
  for (const v of variants) {
    try {
      const token = await build(v.order, v.kid);
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

  return NextResponse.json({ ok: true, endpoint: MAINTENANCE_URL, results });
}
