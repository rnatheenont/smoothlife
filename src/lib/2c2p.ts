// Direct integration with 2C2P's Payment Gateway API (separate merchant
// credentials from whatever gateway Shopify's own hosted checkout uses) —
// powers real recurring "Subscribe & Save" billing via 2C2P's Recurring
// Payment Plan (RPP) feature. Requires TWOC2P_MERCHANT_ID/TWOC2P_SECRET_KEY
// requested directly from 2C2P (not Shopify) with RPP enabled on the
// account. Until those env vars are set, twoC2PConfigured() is false and
// every export here throws — callers must check it first and fall back,
// never assume it's live.
//
// Shape verified against 2C2P's public developer docs (Payment Token API
// v4.3, JWT HS256): https://developer.2c2p.com/docs/api-payment-token,
// https://developer.2c2p.com/docs/api-payment-token-request-parameter,
// https://developer.2c2p.com/docs/api-payment-response-backend,
// https://developer.2c2p.com/docs/json-web-tokens-jwt — NOT verified
// end-to-end against a real sandbox account (none was available this
// session). Two things flagged below need confirming against 2C2P support
// or real sandbox testing before this goes live with real charges:
//   1. Exact semantics of `recurringInterval` (days) vs `chargeOnDate`
//      (ddMM, monthly-billing-day) for a strict "every calendar month"
//      cadence — implemented here as recurringInterval=30, which drifts
//      slightly against real calendar months over a 12-cycle term.
//   2. cancelRecurringPlan() below — 2C2P's docs describe the Recurring
//      Payment Maintenance (cancel) API on a *different* legacy endpoint
//      (PaymentAction/2.0/action, XML payload, JWE+JWS with an RSA key
//      exchange) rather than the same HS256 JWT scheme as paymentToken.
//      That RSA key-exchange detail can't be fabricated without a real
//      2C2P sandbox account — do not ship "unsubscribe" as calling this
//      until it's been confirmed to actually stop future charges.
import { createHmac } from "crypto";

const MERCHANT_ID = process.env.TWOC2P_MERCHANT_ID;
const SECRET_KEY = process.env.TWOC2P_SECRET_KEY;
const IS_PRODUCTION = process.env.TWOC2P_ENV === "production";

const PAYMENT_TOKEN_URL = IS_PRODUCTION
  ? "https://pgw.2c2p.com/payment/4.3/paymentToken"
  : "https://sandbox-pgw.2c2p.com/payment/4.3/paymentToken";

export function twoC2PConfigured() {
  return Boolean(MERCHANT_ID && SECRET_KEY);
}

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

// 2C2P wraps every request/response body as a bare HS256 JWT (header +
// payload + HMAC-SHA256 signature, all base64url) — no JWT library needed
// for this one fixed shape, matching this codebase's existing no-dependency
// HMAC token pattern (lib/session.ts, lib/admin-auth.ts).
function signJwt(payload: Record<string, unknown>): string {
  const encodedHeader = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = createHmac("sha256", SECRET_KEY!).update(`${encodedHeader}.${encodedPayload}`).digest();
  return `${encodedHeader}.${encodedPayload}.${base64url(signature)}`;
}

function verifyJwt<T>(token: string): T {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed 2C2P JWT");
  const [encodedHeader, encodedPayload, signature] = parts;
  const expected = base64url(createHmac("sha256", SECRET_KEY!).update(`${encodedHeader}.${encodedPayload}`).digest());
  if (expected !== signature) throw new Error("Invalid 2C2P JWT signature");
  return JSON.parse(base64urlDecode(encodedPayload)) as T;
}

export type RecurringPaymentTokenRequest = {
  invoiceNo: string; // our own unique id for the first charge
  invoicePrefix: string; // <=15 chars — 2C2P appends 5 digits per subsequent recurring cycle's own invoiceNo
  description: string;
  amountPerCycle: number; // THB, applies to every cycle including the first
  recurringCount: number; // total cycles in the term (3, 6, or 12)
  chargeNextDate: Date; // when the *second* charge should fire (first charge is now)
  frontendReturnUrl: string;
  backendReturnUrl: string;
  customer: { name?: string; email?: string; mobileNo?: string };
  shippingAddress: { address1: string; city: string; postalCode: string; countryCode: string; state?: string };
};

export type PaymentTokenResult = { webPaymentUrl: string; paymentToken: string; respCode: string; respDesc: string };

function ddMMyyyy(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}${mm}${d.getFullYear()}`;
}

export async function createRecurringPaymentToken(req: RecurringPaymentTokenRequest): Promise<PaymentTokenResult> {
  if (!twoC2PConfigured()) throw new Error("2C2P not configured — set TWOC2P_MERCHANT_ID and TWOC2P_SECRET_KEY");

  const payload = {
    merchantID: MERCHANT_ID,
    invoiceNo: req.invoiceNo,
    description: req.description,
    amount: req.amountPerCycle,
    currencyCode: "THB",
    recurring: true,
    invoicePrefix: req.invoicePrefix,
    recurringAmount: req.amountPerCycle,
    recurringInterval: 30, // see file header note — approximation, not a calendar month
    recurringCount: req.recurringCount,
    chargeNextDate: ddMMyyyy(req.chargeNextDate),
    allowAccumulate: false,
    maxAccumulateAmount: req.amountPerCycle,
    frontendReturnUrl: req.frontendReturnUrl,
    backendReturnUrl: req.backendReturnUrl,
    userInfo: req.customer.name || req.customer.email || req.customer.mobileNo
      ? { name: req.customer.name, email: req.customer.email, mobileNo: req.customer.mobileNo }
      : undefined,
    customerAddress: {
      billing: {
        address1: req.shippingAddress.address1,
        city: req.shippingAddress.city,
        postalCode: req.shippingAddress.postalCode,
        countryCode: req.shippingAddress.countryCode,
        state: req.shippingAddress.state,
      },
    },
  };

  const res = await fetch(PAYMENT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: signJwt(payload) }),
  });
  if (!res.ok) throw new Error(`2C2P paymentToken HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data?.payload) throw new Error("2C2P paymentToken response missing payload");
  const decoded = verifyJwt<PaymentTokenResult>(data.payload);
  if (decoded.respCode !== "0000") throw new Error(`2C2P paymentToken failed: ${decoded.respCode} ${decoded.respDesc}`);
  return decoded;
}

export type PaymentCallback = {
  merchantID: string;
  invoiceNo: string;
  amount: number;
  currencyCode: string;
  tranRef: string;
  referenceNo: string;
  approvalCode?: string;
  transactionDateTime: string;
  respCode: string;
  respDesc: string;
  recurringUniqueID?: string;
};

// Verifies and decodes the JWT-wrapped body 2C2P posts to backendReturnUrl
// — both for the first (browser-initiated) charge and every subsequent
// automatic recurring charge, since 2C2P uses the same callback URL for
// both. Throws on a bad/forged signature rather than returning null, so a
// caller can never accidentally treat an unverified payload as real.
export function verifyPaymentCallback(rawPayload: string): PaymentCallback {
  if (!twoC2PConfigured()) throw new Error("2C2P not configured — set TWOC2P_MERCHANT_ID and TWOC2P_SECRET_KEY");
  return verifyJwt<PaymentCallback>(rawPayload);
}

// NOT SAFE TO CALL YET — see file header note #2. Left as an explicit
// unimplemented stub (rather than a guessed implementation) so a caller
// gets a loud, obvious failure instead of silently no-op'ing what looks
// like a successful cancellation while 2C2P keeps charging the customer.
export async function cancelRecurringPlan(_recurringUniqueId: string): Promise<never> {
  throw new Error(
    "cancelRecurringPlan() is not implemented — 2C2P's Recurring Payment Maintenance (cancel) API uses a different auth scheme (JWE+JWS with an RSA key exchange) than paymentToken's HS256 JWT, which needs confirming against a real 2C2P sandbox account before this can be built safely."
  );
}
