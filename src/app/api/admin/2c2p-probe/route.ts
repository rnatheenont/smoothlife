import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { checkAdminPassword } from "@/lib/admin-auth";

// Temporary diagnostic endpoint — DELETE once the 2C2P blocker is resolved.
// Same pattern as the Shopify scope probe that preceded it: TWOC2P_* are
// Vercel env vars the deployed app can read and nothing local can.
//
// Splits the one question we can't answer from the outside: is respCode 9007
// ("Invalid merchant", per 2C2P's own response-code table) coming from a
// wrong *account*, or from pointing the right account at the wrong
// *environment*? 2C2P issues separate sandbox and production credentials, so
// production keys sent to sandbox-pgw return exactly this error. This posts
// the same minimal, mandatory-fields-only request to BOTH hosts and reports
// what each says.
//
// Requesting a payment token moves no money — it only returns a URL a
// customer would have to visit and pay on — so running this against the
// production host is safe.
//
//   curl -H "Authorization: Bearer $ADMIN_PANEL_SECRET" https://.../api/admin/2c2p-probe
//
// Never returns the merchant ID or secret key — only their shape, and 2C2P's
// own reply.
const HOSTS = {
  sandbox: "https://sandbox-pgw.2c2p.com/payment/4.3/paymentToken",
  production: "https://pgw.2c2p.com/payment/4.3/paymentToken",
};

function base64url(input: Buffer | string): string {
  return (Buffer.isBuffer(input) ? input : Buffer.from(input))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(input.length + ((4 - (input.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64url(JSON.stringify(payload));
  return `${header}.${body}.${base64url(createHmac("sha256", secret).update(`${header}.${body}`).digest())}`;
}

async function probe(url: string, payload: Record<string, unknown>, secret: string) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload: signJwt(payload, secret) }),
    });
    const rawText = await res.text();
    let parsed: { payload?: string; respCode?: string; respDesc?: string } | null = null;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      /* non-JSON body — reported raw below */
    }

    // A JWT-signed reply is itself the strongest possible signal: 2C2P can
    // only sign with a secret key it has on file for this merchant, so a
    // signature that verifies means the credentials ARE recognised here.
    if (parsed?.payload) {
      const [h, b, sig] = parsed.payload.split(".");
      const signatureVerified = sig === base64url(createHmac("sha256", secret).update(`${h}.${b}`).digest());
      const decoded = JSON.parse(base64urlDecode(b)) as { respCode?: string; respDesc?: string };
      return {
        httpStatus: res.status,
        replyWasJwtSigned: true,
        signatureVerified,
        respCode: decoded.respCode ?? null,
        respDesc: decoded.respDesc ?? null,
      };
    }
    return {
      httpStatus: res.status,
      replyWasJwtSigned: false,
      signatureVerified: false,
      respCode: parsed?.respCode ?? null,
      respDesc: parsed?.respDesc ?? null,
      rawBody: parsed ? undefined : rawText.slice(0, 300),
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!bearer || !checkAdminPassword(bearer)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const merchantId = process.env.TWOC2P_MERCHANT_ID;
  const secretKey = process.env.TWOC2P_SECRET_KEY;
  if (!merchantId || !secretKey) {
    return NextResponse.json({ ok: false, error: "TWOC2P_MERCHANT_ID / TWOC2P_SECRET_KEY not set" }, { status: 412 });
  }

  // Shape only — a stray space or newline pasted into the Vercel dashboard
  // would produce exactly the same 9007 as a genuinely wrong ID.
  const credentialShape = {
    merchantIdLength: merchantId.length,
    merchantIdHasSurroundingWhitespace: merchantId !== merchantId.trim(),
    merchantIdIsAlphanumeric: /^[A-Za-z0-9]+$/.test(merchantId.trim()),
    secretKeyLength: secretKey.length,
    secretKeyHasSurroundingWhitespace: secretKey !== secretKey.trim(),
    twoC2PEnv: process.env.TWOC2P_ENV ?? null,
  };

  // Subscribe & Save rides on 2C2P's Recurring Payment Plan, which is a
  // separately provisioned feature — an account can be perfectly valid for
  // one-time payments and still reject `recurring: true`. Unsubscribing is
  // a different API again (Recurring Payment Maintenance), gated on an RSA
  // key exchange rather than these credentials, so report whether those
  // keys exist at all.
  const subscriptionReadiness = {
    merchantPrivateKeySet: Boolean(process.env.TWOC2P_MERCHANT_PRIVATE_KEY),
    twoC2PPublicKeySet: Boolean(process.env.TWOC2P_PUBLIC_KEY),
  };

  const origin = req.nextUrl.origin;
  const results: Record<string, unknown> = {};
  for (const [name, url] of Object.entries(HOSTS)) {
    // Mandatory fields only (merchantID, invoiceNo, description, amount,
    // currencyCode) plus the return URLs — nothing optional, so a payload
    // problem would surface as 9004/9005/9006 rather than hiding behind
    // 9007. Unique invoiceNo per host so neither can trip 9015 ("Existing
    // Invoice Number") on the other's behalf.
    const payload = {
      merchantID: merchantId.trim(),
      invoiceNo: `PROBE${Date.now().toString(36).toUpperCase()}${name === "sandbox" ? "S" : "P"}`,
      description: "Integration probe - no payment is collected",
      amount: 20.0,
      currencyCode: "THB",
      frontendReturnUrl: `${origin}/checkout/success`,
      backendReturnUrl: `${origin}/api/webhooks/2c2p-checkout`,
    };
    results[name] = await probe(url, payload, secretKey.trim());
  }

  // Same request plus the recurring block, against whichever host just
  // accepted the one-time call — isolates "is RPP enabled?" from "are the
  // credentials right?", which the one-time probe has already settled.
  // Still creates nothing chargeable: no plan exists until a customer
  // completes the first payment on the returned URL.
  const liveHost = (results.production as { respCode?: string })?.respCode === "0000" ? "production" : "sandbox";
  const chargeNextDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const dd = String(chargeNextDate.getDate()).padStart(2, "0");
  const mm = String(chargeNextDate.getMonth() + 1).padStart(2, "0");
  const recurring = await probe(
    HOSTS[liveHost],
    {
      merchantID: merchantId.trim(),
      invoiceNo: `PROBER${Date.now().toString(36).toUpperCase()}`,
      description: "Recurring probe - no payment is collected",
      amount: 20.0,
      currencyCode: "THB",
      recurring: true,
      invoicePrefix: "PROBER",
      recurringAmount: 20.0,
      recurringInterval: 30,
      recurringCount: 2,
      chargeNextDate: `${dd}${mm}${chargeNextDate.getFullYear()}`,
      allowAccumulate: false,
      maxAccumulateAmount: 20.0,
      frontendReturnUrl: `${origin}/checkout/success`,
      backendReturnUrl: `${origin}/api/webhooks/2c2p`,
    },
    secretKey.trim()
  );

  return NextResponse.json({
    ok: true,
    credentialShape,
    results,
    subscriptionReadiness: { ...subscriptionReadiness, recurringProbeHost: liveHost, recurringProbe: recurring },
  });
}
