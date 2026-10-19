// Server-only transactional email via Resend. Never import from a "use
// client" component. See .env.example for RESEND_API_KEY / RESEND_FROM_EMAIL.
//
// The three emails below are about the account. What happens to an order is
// in email-order.ts, and the look both share is in email-layout.ts.
//
// Imports carry their extension, unlike most of src/: this module has a unit
// test, and `node --test` resolves the specifier literally. Every other tested
// module here only imports a sibling as `import type`, which is erased before
// node sees it — a value import is not.
import {
  shell,
  heading,
  codeBlock,
  caption,
  actionButton,
  linkFallback,
  noteStrip,
  footnote,
  panel,
  escapeHtml,
  DEEP,
  INK,
  FONT,
} from "./email-layout.ts";

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
  return shell({
    preheader: `รหัสยืนยันของคุณคือ ${code} — ใช้ได้ภายใน 10 นาที`,
    title: "รหัสยืนยันเข้าสู่ระบบ",
    body: [
      heading("รหัสยืนยันเข้าสู่ระบบ", "กรอกรหัสนี้ในหน้าที่คุณกำลังเข้าสู่ระบบอยู่"),
      codeBlock(code),
      // One line rather than a second tinted panel under the first: two of
      // them stacked read as two things of equal weight, and only one of
      // them is the thing the reader came for.
      caption(`แตะค้างที่ตัวเลขเพื่อคัดลอก &nbsp;·&nbsp; หมดอายุใน <strong style="color:${DEEP};">10 นาที</strong>`),
      footnote(
        "พนักงานของเราจะไม่ขอรหัสนี้จากคุณไม่ว่ากรณีใด อย่าบอกรหัสนี้กับใคร<br>หากคุณไม่ได้เป็นผู้ขอรหัส ไม่ต้องทำอะไร บัญชีของคุณยังปลอดภัยดี"
      ),
    ].join(""),
  });
}

export function guestOrderInviteEmailHtml(orderName: string, signupUrl: string) {
  const safeOrder = escapeHtml(orderName);
  return shell({
    preheader: `คำสั่งซื้อ ${orderName} รับแล้ว — สมัครสมาชิกฟรีเพื่อสะสมคะแนนย้อนหลัง`,
    title: "ขอบคุณสำหรับคำสั่งซื้อ",
    body: [
      heading(
        "ขอบคุณสำหรับคำสั่งซื้อ",
        `เราได้รับคำสั่งซื้อ <strong style="color:${DEEP};">${safeOrder}</strong> เรียบร้อยแล้ว และกำลังดำเนินการให้ค่ะ`
      ),
      panel(
        `<div style="font-size:14px;line-height:1.9;color:${INK};font-family:${FONT};">
          <div style="font-weight:700;color:${DEEP};margin-bottom:6px;">สมัครสมาชิกฟรี แล้วได้เพิ่มอีก</div>
          ติดตามสถานะคำสั่งซื้อนี้ได้เอง<br>
          สะสมคะแนนจากยอดที่เพิ่งซื้อไป<br>
          รับสิทธิ์สมาชิกในการสั่งซื้อครั้งถัดไป
        </div>`
      ),
      actionButton(signupUrl, "สมัครสมาชิกฟรี"),
      linkFallback(signupUrl),
      footnote(
        "สมัครด้วยอีเมลเดียวกับที่สั่งซื้อ ระบบจะผูกคำสั่งซื้อนี้ให้อัตโนมัติ<br>หากยังไม่สนใจสมัคร ไม่ต้องทำอะไร คำสั่งซื้อของคุณดำเนินการตามปกติ"
      ),
    ].join(""),
  });
}

export function resetLinkEmailHtml(resetUrl: string) {
  return shell({
    preheader: "ลิงก์ตั้งรหัสผ่านใหม่ของคุณ ใช้ได้ภายใน 30 นาที",
    title: "ตั้งรหัสผ่านใหม่",
    body: [
      heading("ตั้งรหัสผ่านใหม่", "เราได้รับคำขอตั้งรหัสผ่านใหม่สำหรับบัญชีนี้ กดปุ่มด้านล่างเพื่อตั้งรหัสใหม่"),
      actionButton(resetUrl, "ตั้งรหัสผ่านใหม่"),
      noteStrip("ลิงก์หมดอายุใน <strong>30 นาที</strong>"),
      linkFallback(resetUrl),
      footnote(
        "หากคุณไม่ได้เป็นผู้ขอ ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ และลิงก์นี้จะหมดอายุไปเอง<br>อย่าส่งต่อลิงก์นี้ให้ใคร ผู้ที่เปิดลิงก์สามารถตั้งรหัสผ่านใหม่ได้"
      ),
    ].join(""),
  });
}
