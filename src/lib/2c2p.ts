// Direct integration with 2C2P's Payment Gateway API (separate merchant
// credentials from whatever gateway Shopify's own hosted checkout uses) —
// powers real recurring "Subscribe & Save" billing via 2C2P's Recurring
// Payment Plan (RPP) feature (createRecurringPaymentToken), and, further
// below, one-time regular-purchase payments for the custom checkout
// (createPaymentToken, inquireTransactionStatus) plus refunds
// (refundTransaction). Requires TWOC2P_MERCHANT_ID/TWOC2P_SECRET_KEY
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
// session). Things still flagged for confirming against 2C2P support or
// real sandbox testing before this goes live with real charges:
//   1. `recurringCount: 0` is documented as "charge indefinitely until
//      terminated manually" — exactly what an auto-renewing term
//      subscription needs, but never exercised against a live account.
//      `recurringInterval` is always a day-count (no calendar-month unit;
//      `chargeOnDate` is a same-day-every-month alternative, not usable for
//      a multi-month term), so a 3/6/12-month term is passed as
//      recurringIntervalDays ≈ 90/180/365 and will drift slightly against
//      real calendar months the longer a subscription auto-renews.
//   2. cancelRecurringPlan()/inquireRecurringPlan() further below — now
//      implemented (see that section's own header comment for exactly
//      what's confirmed vs. still assumed), but still never exercised
//      against a live 2C2P response, since that requires completing an
//      RSA key exchange through their merchant portal first.
import { createHmac } from "crypto";

const MERCHANT_ID = process.env.TWOC2P_MERCHANT_ID;
const SECRET_KEY = process.env.TWOC2P_SECRET_KEY;
const IS_PRODUCTION = process.env.TWOC2P_ENV === "production";

const PAYMENT_TOKEN_URL = IS_PRODUCTION
  ? "https://pgw.2c2p.com/payment/4.3/paymentToken"
  : "https://sandbox-pgw.2c2p.com/payment/4.3/paymentToken";
const PAYMENT_INQUIRY_URL = IS_PRODUCTION
  ? "https://pgw.2c2p.com/payment/4.3/paymentinquiry"
  : "https://sandbox-pgw.2c2p.com/payment/4.3/paymentinquiry";

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
  recurringCount: number; // 0 = recur indefinitely until cancelRecurringPlan() is called (confirmed against 2C2P's docs); a positive N stops after N charges
  recurringIntervalDays: number; // days between charges — 2C2P has no calendar-month unit, so a 3/6/12-month term is passed as ~90/180/365 days and will drift slightly against real calendar months over time
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
    recurringInterval: req.recurringIntervalDays,
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

// One-time (non-recurring) equivalent of createRecurringPaymentToken above —
// for regular cart purchases, not Subscribe & Save. Same Payment Token API
// v4.3 endpoint/JWT wrapper; the request simply omits every recurring-only
// field (recurring/invoicePrefix/recurringAmount/recurringInterval/
// recurringCount/chargeNextDate/allowAccumulate/maxAccumulateAmount) —
// 2C2P's own docs confirm there's no explicit "one-time" flag, a payment
// is one-time by default when those are absent. `paymentChannel` restricts
// which methods 2C2P offers on its Drop-In UI — ["CC","PPQR"] for the
// card + QR PromptPay MVP scope (channel codes verified against 2C2P's
// Payment Channel reference: CC = all global card schemes, PPQR = Thai
// PromptPay QR specifically, under the THQR group — not the generic "QR"
// code, which is a different scheme). NOT verified end-to-end against a
// real sandbox account (see file header) — shape only, from docs.
export type OneTimePaymentTokenRequest = {
  invoiceNo: string;
  description: string;
  amount: number; // THB
  paymentChannel?: string[]; // e.g. ["CC", "PPQR"] — omit to let 2C2P offer every enabled channel
  frontendReturnUrl: string;
  backendReturnUrl: string;
  customer: { name?: string; email?: string; mobileNo?: string };
  shippingAddress: { address1: string; city: string; postalCode: string; countryCode: string; state?: string };
};

export async function createPaymentToken(req: OneTimePaymentTokenRequest): Promise<PaymentTokenResult> {
  if (!twoC2PConfigured()) throw new Error("2C2P not configured — set TWOC2P_MERCHANT_ID and TWOC2P_SECRET_KEY");

  const payload = {
    merchantID: MERCHANT_ID,
    invoiceNo: req.invoiceNo,
    description: req.description,
    amount: req.amount,
    currencyCode: "THB",
    paymentChannel: req.paymentChannel && req.paymentChannel.length > 0 ? req.paymentChannel : undefined,
    frontendReturnUrl: req.frontendReturnUrl,
    backendReturnUrl: req.backendReturnUrl,
    userInfo:
      req.customer.name || req.customer.email || req.customer.mobileNo
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

// Server-side Payment Inquiry — the "never trust the redirect/webhook
// alone" verification step: confirms a transaction's real status directly
// from 2C2P before an order is ever marked paid. Same HS256 JWT wrapper as
// paymentToken (request/response both {"payload": "<jwt>"}), a separate
// endpoint. Request only needs merchantID + invoiceNo (verified against
// 2C2P's Payment Inquiry Response Parameters doc); response carries the
// full transaction detail plus respCode/respDesc. Response-field shape
// only, not exercised against a live account — see file header.
export type PaymentInquiryResult = {
  invoiceNo: string;
  amount: number;
  currencyCode: string;
  transactionDateTime: string;
  approvalCode?: string;
  referenceNo: string;
  tranRef?: string;
  channelCode: string;
  respCode: string;
  respDesc: string;
};

export async function inquireTransactionStatus(invoiceNo: string): Promise<PaymentInquiryResult> {
  if (!twoC2PConfigured()) throw new Error("2C2P not configured — set TWOC2P_MERCHANT_ID and TWOC2P_SECRET_KEY");

  const payload = { merchantID: MERCHANT_ID, invoiceNo };
  const res = await fetch(PAYMENT_INQUIRY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload: signJwt(payload) }),
  });
  if (!res.ok) throw new Error(`2C2P paymentinquiry HTTP ${res.status}`);
  const data = await res.json().catch(() => null);
  if (!data?.payload) throw new Error("2C2P paymentinquiry response missing payload");
  return verifyJwt<PaymentInquiryResult>(data.payload);
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

// ---------------------------------------------------------------------
// Recurring Payment Maintenance (cancel / inquire an existing plan) —
// a separate legacy API from paymentToken above, on its own endpoint,
// with its own auth scheme: XML payloads wrapped in encrypt-then-sign
// JOSE (JWE with RSA-OAEP+A256GCM, then JWS PS256), NOT the HS256 JWT
// used for paymentToken. Shape verified against 2C2P's docs:
// https://developer.2c2p.com/docs/payment-maintenance-recurring-payment-guide
// https://developer.2c2p.com/docs/reference-jwt-with-key
//
// This needs an RSA key *exchange* with 2C2P before it can work — not
// just an API key:
//   1. We generate an RSA keypair (done — see scripts/generate-2c2p-keys.js)
//      and upload the PUBLIC key at 2C2P's merchant portal: Account >
//      Options > Merchant Public Keys (must be x509/SPKI PEM format).
//   2. We download 2C2P's own public key from the same portal: Account >
//      Options > 2C2P Public Keys.
//   3. Our private key → TWOC2P_MERCHANT_PRIVATE_KEY (PEM), 2C2P's public
//      key → TWOC2P_PUBLIC_KEY (PEM). Until both are set,
//      recurringMaintenanceConfigured() is false.
// Genuinely unverified: whether 2C2P signs its responses too (verified
// here against their public key) or only encrypts — their docs show a
// response example with the same nested-token shape as the request but
// never state this explicitly. And the exact meaning of the `kid` JOSE
// header, if 2C2P's portal assigns one, isn't documented — omitted here.
// Both need confirming against a real sandbox call before trusting this
// for "unsubscribe" in production.
import { CompactEncrypt, CompactSign, compactDecrypt, compactVerify, importSPKI, importPKCS8 } from "jose";

// Vercel env vars can't hold real newlines cleanly, so multi-line PEM
// values are stored with literal \n escapes — same convention as
// APPLE_PRIVATE_KEY in lib/apple-auth.ts.
const MERCHANT_PRIVATE_KEY_PEM = process.env.TWOC2P_MERCHANT_PRIVATE_KEY?.replace(/\\n/g, "\n");
const TWOC2P_PUBLIC_KEY_PEM = process.env.TWOC2P_PUBLIC_KEY?.replace(/\\n/g, "\n");
const MAINTENANCE_URL = IS_PRODUCTION
  ? "https://t.2c2p.com/PaymentAction/2.0/action"
  : "https://demo2.2c2p.com/PaymentAction/2.0/action";

export function recurringMaintenanceConfigured() {
  return Boolean(MERCHANT_ID && MERCHANT_PRIVATE_KEY_PEM && TWOC2P_PUBLIC_KEY_PEM);
}

function maintenanceTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}${p(d.getMonth() + 1)}${String(d.getFullYear()).slice(-2)}${p(d.getHours())}${p(
    d.getMinutes()
  )}${p(d.getSeconds())}`;
}

async function encryptThenSignXml(xml: string): Promise<string> {
  const twoC2PPublicKey = await importSPKI(TWOC2P_PUBLIC_KEY_PEM!, "RSA-OAEP");
  const jwe = await new CompactEncrypt(new TextEncoder().encode(xml))
    .setProtectedHeader({ alg: "RSA-OAEP", enc: "A256GCM" })
    .encrypt(twoC2PPublicKey);
  const merchantPrivateKey = await importPKCS8(MERCHANT_PRIVATE_KEY_PEM!, "PS256");
  return new CompactSign(new TextEncoder().encode(jwe))
    .setProtectedHeader({ alg: "PS256" })
    .sign(merchantPrivateKey);
}

async function verifyThenDecryptXml(token: string): Promise<string> {
  const twoC2PPublicKey = await importSPKI(TWOC2P_PUBLIC_KEY_PEM!, "PS256");
  const { payload: jweBytes } = await compactVerify(token, twoC2PPublicKey);
  const merchantPrivateKey = await importPKCS8(MERCHANT_PRIVATE_KEY_PEM!, "RSA-OAEP");
  const { plaintext } = await compactDecrypt(new TextDecoder().decode(jweBytes), merchantPrivateKey);
  return new TextDecoder().decode(plaintext);
}

function xmlTag(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  return match ? match[1] : null;
}

export type RecurringMaintenanceResult = { respCode: string; respReason: string; recurringUniqueID: string };

async function callRecurringMaintenance(xml: string): Promise<RecurringMaintenanceResult> {
  if (!recurringMaintenanceConfigured()) {
    throw new Error(
      "2C2P recurring maintenance not configured — set TWOC2P_MERCHANT_PRIVATE_KEY and TWOC2P_PUBLIC_KEY (see file header for the portal key-exchange steps required first)"
    );
  }
  const token = await encryptThenSignXml(xml);
  const res = await fetch(MAINTENANCE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: token,
  });
  if (!res.ok) throw new Error(`2C2P recurring maintenance HTTP ${res.status}`);
  const responseToken = await res.text();
  const responseXml = await verifyThenDecryptXml(responseToken);
  const respCode = xmlTag(responseXml, "respCode");
  const respReason = xmlTag(responseXml, "respReason");
  const recurringUniqueID = xmlTag(responseXml, "recurringUniqueID");
  if (!respCode || !recurringUniqueID) throw new Error(`2C2P recurring maintenance: unexpected response XML: ${responseXml}`);
  return { respCode, respReason: respReason ?? "", recurringUniqueID };
}

// Cancels a live recurring plan — respCode "00" means it actually stopped
// future charges; any other code means it did NOT, so callers must check
// this, not just "did the request not throw".
export async function cancelRecurringPlan(recurringUniqueId: string, lastAmount: number): Promise<RecurringMaintenanceResult> {
  const xml = `<RecurringMaintenanceRequest><version>2.4</version><timeStamp>${maintenanceTimestamp(
    new Date()
  )}</timeStamp><merchantID>${MERCHANT_ID}</merchantID><recurringUniqueID>${recurringUniqueId}</recurringUniqueID><processType>C</processType><recurringStatus>Y</recurringStatus><amount>${String(
    Math.round(lastAmount * 100)
  ).padStart(12, "0")}</amount><allowAccumulate>N</allowAccumulate></RecurringMaintenanceRequest>`;
  return callRecurringMaintenance(xml);
}

// Read-only status check (recurringStatus/currentCount/chargeNextDate) —
// useful for reconciling our DB against 2C2P's actual plan state.
export async function inquireRecurringPlan(recurringUniqueId: string): Promise<RecurringMaintenanceResult> {
  const xml = `<RecurringMaintenanceRequest><version>2.4</version><timeStamp>${maintenanceTimestamp(
    new Date()
  )}</timeStamp><merchantID>${MERCHANT_ID}</merchantID><recurringUniqueID>${recurringUniqueId}</recurringUniqueID><processType>I</processType></RecurringMaintenanceRequest>`;
  return callRecurringMaintenance(xml);
}

// ---------------------------------------------------------------------
// Refund — reuses the exact same endpoint/JOSE auth as the recurring
// maintenance API above (same RSA key exchange, gated by the same
// recurringMaintenanceConfigured()), but is genuinely a different request
// schema, confirmed against 2C2P's own refund guide — NOT just a third
// processType value plugged into RecurringMaintenanceRequest:
//   - Root element is <PaymentProcessRequest>, not <RecurringMaintenanceRequest>
//   - version "4.3", not "2.4"; no <timeStamp> field at all
//   - <actionAmount> is a plain decimal string ("25.00"), not the
//     zero-padded-integer-cents format cancelRecurringPlan uses for <amount>
//   - Response uses <respDesc>, not <respReason>; no <recurringUniqueID>
//     (this is a one-time-purchase-style transaction, not a plan) — has
//     <status>/<refundReferenceNo> instead
// https://developer.2c2p.com/docs/payment-maintenance-refund-guide —
// shape only, not exercised against a live account (see file header).
// Refunds can only be requested for settled transactions per 2C2P's docs;
// for some payment methods the result is async (`REFUND_PENDING`, needs
// polling via inquireTransactionStatus or a notifyURL callback) rather
// than an immediate final result — callers must handle both.
export type RefundResult = {
  respCode: string;
  respDesc: string;
  status: string; // e.g. "RF" (refunded) — or "REFUND_PENDING" for async methods
  refundReferenceNo: string | null;
};

export async function refundTransaction(invoiceNo: string, actionAmount: number): Promise<RefundResult> {
  if (!recurringMaintenanceConfigured()) {
    throw new Error(
      "2C2P refund not configured — set TWOC2P_MERCHANT_PRIVATE_KEY and TWOC2P_PUBLIC_KEY (see file header for the portal key-exchange steps required first)"
    );
  }
  const xml = `<PaymentProcessRequest><version>4.3</version><merchantID>${MERCHANT_ID}</merchantID><invoiceNo>${invoiceNo}</invoiceNo><actionAmount>${actionAmount.toFixed(
    2
  )}</actionAmount><processType>R</processType></PaymentProcessRequest>`;

  const token = await encryptThenSignXml(xml);
  const res = await fetch(MAINTENANCE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: token,
  });
  if (!res.ok) throw new Error(`2C2P refund HTTP ${res.status}`);
  const responseToken = await res.text();
  const responseXml = await verifyThenDecryptXml(responseToken);
  const respCode = xmlTag(responseXml, "respCode");
  const respDesc = xmlTag(responseXml, "respDesc");
  const status = xmlTag(responseXml, "status");
  if (!respCode) throw new Error(`2C2P refund: unexpected response XML: ${responseXml}`);
  return { respCode, respDesc: respDesc ?? "", status: status ?? "", refundReferenceNo: xmlTag(responseXml, "refundReferenceNo") };
}
