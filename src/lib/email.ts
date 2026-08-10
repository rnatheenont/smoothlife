// Server-only transactional email via Resend. Never import from a "use
// client" component. See .env.example for RESEND_API_KEY / RESEND_FROM_EMAIL.
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export function emailConfigured() {
  return Boolean(RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    throw new Error(`Resend send failed: ${res.status} ${await res.text()}`);
  }
}

export function otpEmailHtml(code: string) {
  return `
    <div style="font-family:sans-serif;max-width:420px;margin:0 auto;padding:24px">
      <h2 style="color:#0f766e">Smoothlife.com</h2>
      <p>รหัสยืนยันเข้าสู่ระบบของคุณคือ</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#0f172a">${code}</p>
      <p style="color:#64748b;font-size:14px">รหัสนี้หมดอายุใน 10 นาที หากคุณไม่ได้เป็นผู้ขอรหัสนี้ สามารถละเว้นอีเมลฉบับนี้ได้</p>
    </div>
  `;
}
