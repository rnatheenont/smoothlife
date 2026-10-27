// Asking before an SMS goes out.
//
// Firebase sends the code straight from the browser, so the only way to put
// a ceiling on it is to ask first and not reach for Firebase when the answer
// is no. Every form that can trigger an SMS calls this.

// `error?: undefined` on the allowed side so narrowing on `ok` is
// unambiguous — without it the union is not discriminated and every call
// site has to cast to read the message.
export type OtpAllowance = { ok: true; error?: undefined } | { ok: false; error: string };

export async function askToSendOtp(phone: string): Promise<OtpAllowance> {
  try {
    const res = await fetch("/api/auth/otp/allow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (res.ok && data?.ok) return { ok: true };
    return { ok: false, error: data?.error || "ขอรหัส OTP ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  } catch {
    // Open on failure, on purpose. This exists to keep a bill from growing
    // unwatched, not to decide who gets in — and a shopper standing at a
    // login form is not the one who should pay for our endpoint being down.
    return { ok: true };
  }
}
