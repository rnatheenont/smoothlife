// Server-only transactional email via Resend. Never import from a "use
// client" component. See .env.example for RESEND_API_KEY / RESEND_FROM_EMAIL.
// Spelled with its extension, unlike most imports in src/: this module has a
// unit test, and `node --test` resolves the specifier literally. Every other
// tested module here only ever imports a sibling as `import type`, which is
// erased before node sees it — a value import is not.
import { SITE_URL } from "./site-url.ts";

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

// ---------------------------------------------------------------------------
// Layout
//
// Email is not the web. Nothing below may use flexbox, grid, a class name or
// a <style> block: Outlook renders through Word, Gmail strips <style> on
// forwards, and several clients drop <head> entirely. So everything is
// tables with inline styles, which is ugly to write and the only thing that
// renders the same in all of them.
//
// Colours are the real brand tokens from src/app/theme.css. What was here
// before used #0f766e, which is Tailwind's teal-700 and belongs to no part of
// this brand — close enough to look deliberate, wrong enough that the emails
// never matched the shop.
// ---------------------------------------------------------------------------

const INK = "#0f172a"; // --color-brand-ink
const DEEP = "#09514a"; // --color-brand-1000, headings
const ACTION = "#05755f"; // --color-brand-800
const TINT = "#ebf8f4"; // --color-brand-50, panels
const MUTED = "#475569";
const LINE = "#e2e8f0";
const PAGE = "#eef2f1";

// brand-800 for anything carrying white text, never the brand-600 mint:
// white on #00a87b is 2.4:1 and fails AA, white on #05755f is 5.7:1. The
// same rule is written into theme.css for the site's own buttons.
const ON_ACTION = "#ffffff";

// The shop's own wordmark, served from wherever the app answers so it follows
// a domain move. As a PNG rather than the .webp the site uses or the .svg it
// was drawn as: Outlook on Windows renders neither, and both would leave a
// broken-image icon at the top of a password reset. 440x68 shown at half
// size, so it stays sharp on a phone.
//
// Most clients block remote images until the reader allows them, so the alt
// text is styled to stand in for the logo: blocked, the header still reads
// "Smoothlife.com" in the brand's own green rather than as an empty box.
const LOGO_SRC = `${SITE_URL}/logo-email.png`;
const LOGO_WIDTH = 200;
const LOGO_HEIGHT = 31;

// Noto Sans Thai is what the site itself is set in (src/app/layout.tsx).
// Gmail strips @font-face whatever you do, so the web font is a bonus for
// the clients that honour it — Apple Mail above all — and the rest of the
// stack has to look right on its own.
//
// Thai needs more leading than Latin: vowels and tone marks stack above and
// below the line, and at 1.5 they touch the row above.
const FONT =
  "'Noto Sans Thai','Noto Sans Thai Looped',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const LEADING = "1.75";

// Wrapped so Outlook's Word engine never sees it; it cannot use the font and
// chokes on the rules. Every element still carries font-family inline, so
// a client that drops this block loses the web font and nothing else.
const FONT_LINK = `<!--[if !mso]><!-->
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap" rel="stylesheet">
<style>@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap');</style>
<!--<![endif]-->`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ShellOptions = {
  /** The line the inbox shows next to the subject, before anyone opens it. */
  preheader: string;
  title: string;
  /** Table rows: each is a full <tr> placed inside the white card. */
  body: string;
};

function shell({ preheader, title, body }: ShellOptions): string {
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
${FONT_LINK}
</head>
<body style="margin:0;padding:0;width:100%;background-color:${PAGE};font-family:${FONT};-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(preheader)}</div>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">&#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847; &#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">
  <tr>
    <td align="center" style="padding:32px 16px 40px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;">

        <tr>
          <td align="center" style="padding:0 0 22px 0;">
            <a href="${SITE_URL}" style="text-decoration:none;">
              <img src="${LOGO_SRC}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="Smoothlife.com" style="display:block;width:${LOGO_WIDTH}px;max-width:${LOGO_WIDTH}px;height:auto;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:19px;font-weight:700;color:${DEEP};">
            </a>
          </td>
        </tr>

        <tr>
          <td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              ${body}
            </table>
          </td>
        </tr>

        <tr>
          <td align="center" style="padding:22px 12px 0 12px;font-family:${FONT};font-size:12px;line-height:1.8;color:${MUTED};">
            อีเมลฉบับนี้ส่งอัตโนมัติจากระบบของ Smoothlife.com<br>
            <a href="${SITE_URL}" style="color:${ACTION};text-decoration:none;font-weight:600;">เข้าชมร้านค้า</a>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

/** Heading plus one line of explanation — the top of every card. */
function heading(title: string, lead: string): string {
  return `<tr>
  <td style="padding:34px 28px 0 28px;font-family:${FONT};">
    <div style="font-size:21px;font-weight:700;color:${DEEP};line-height:1.5;">${title}</div>
    <div style="margin-top:8px;font-size:15px;line-height:${LEADING};color:${INK};">${lead}</div>
  </td>
</tr>`;
}

// Wide enough that each digit is read on its own — a doubled digit has to be
// visibly two — and declared again as text-indent so the trailing gap after
// the last digit does not push the whole code off centre.
const CODE_SPACING = "11px";

/**
 * The code.
 *
 * Six digits in one cell, spaced apart rather than put in six boxes. Boxes
 * read beautifully and cannot be copied: each digit is its own <td>, so a
 * long press on a phone selects one of them, and a selection dragged across
 * all six arrives in the clipboard as "1 8 5 0 0 2" — which no login field
 * accepts.
 *
 * letter-spacing is drawn, not stored. The eye gets the separation and the
 * clipboard gets the six characters with nothing between them. There is no
 * copy button to be had here: email runs no JavaScript, and every client
 * strips <script> and onclick, so the most an email can do is make the
 * ordinary gesture work.
 */
function codeBlock(code: string): string {
  const safe = escapeHtml(code);
  return `<tr>
  <td align="center" style="padding:24px 24px 0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TINT}" style="background-color:${TINT};border-radius:16px;">
      <tr>
        <td align="center" style="padding:20px 12px;font-family:${FONT};font-size:33px;font-weight:700;line-height:1.3;color:${DEEP};letter-spacing:${CODE_SPACING};text-indent:${CODE_SPACING};">${safe}</td>
      </tr>
    </table>
  </td>
</tr>`;
}

/** One quiet line under something, for the facts that go with it. */
function caption(text: string): string {
  return `<tr>
  <td align="center" style="padding:12px 24px 0 24px;font-family:${FONT};font-size:12.5px;line-height:1.8;color:${MUTED};">${text}</td>
</tr>`;
}

/**
 * A call to action.
 *
 * Padding lives on the <a>, not the <td>, because Outlook ignores padding on
 * a link; the bgcolor attribute is there for the same engine, which ignores
 * the background shorthand.
 */
function actionButton(href: string, label: string): string {
  return `<tr>
  <td align="center" style="padding:26px 24px 2px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
      <tr>
        <td align="center" bgcolor="${ACTION}" style="background-color:${ACTION};border-radius:999px;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 34px;font-family:${FONT};font-size:16px;font-weight:700;color:${ON_ACTION};text-decoration:none;border-radius:999px;">${label}</a>
        </td>
      </tr>
    </table>
  </td>
</tr>`;
}

/**
 * The address written out, for when the button is not usable — it did not
 * render, or the client stripped the link. It goes last, after whatever the
 * reader actually needs to know: it is the way out, not part of the message,
 * and a wrapped 90-character token placed higher up pushes the real content
 * off the first screen.
 */
function linkFallback(href: string): string {
  return `<tr>
  <td align="center" style="padding:18px 24px 0 24px;font-family:${FONT};font-size:12px;line-height:1.7;color:${MUTED};">
    ปุ่มกดไม่ได้ใช่ไหม คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์
    <div style="margin-top:4px;color:${ACTION};word-break:break-all;">${escapeHtml(href)}</div>
  </td>
</tr>`;
}

/** The small tinted strip that carries a single fact, such as an expiry. */
function noteStrip(text: string): string {
  return `<tr>
  <td style="padding:20px 24px 0 24px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TINT}" style="background-color:${TINT};border-radius:14px;">
      <tr>
        <td style="padding:12px 16px;font-family:${FONT};font-size:13px;line-height:1.7;color:${DEEP};text-align:center;">${text}</td>
      </tr>
    </table>
  </td>
</tr>`;
}

/** Closing text below a hairline — what to do if this was not you. */
function footnote(text: string): string {
  return `<tr>
  <td style="padding:22px 28px 30px 28px;">
    <div style="height:1px;line-height:1px;font-size:1px;background-color:${LINE};">&nbsp;</div>
    <div style="margin-top:18px;font-family:${FONT};font-size:13px;line-height:1.8;color:${MUTED};">${text}</div>
  </td>
</tr>`;
}

// ---------------------------------------------------------------------------
// The emails themselves
// ---------------------------------------------------------------------------

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
      heading("ขอบคุณสำหรับคำสั่งซื้อ", `เราได้รับคำสั่งซื้อ <strong style="color:${DEEP};">${safeOrder}</strong> เรียบร้อยแล้ว และกำลังดำเนินการให้ค่ะ`),
      `<tr>
  <td style="padding:22px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${TINT}" style="background-color:${TINT};border-radius:16px;">
      <tr>
        <td style="padding:18px 20px;font-family:${FONT};font-size:14px;line-height:1.9;color:${INK};">
          <div style="font-weight:700;color:${DEEP};margin-bottom:6px;">สมัครสมาชิกฟรี แล้วได้เพิ่มอีก</div>
          ติดตามสถานะคำสั่งซื้อนี้ได้เอง<br>
          สะสมคะแนนจากยอดที่เพิ่งซื้อไป<br>
          รับสิทธิ์สมาชิกในการสั่งซื้อครั้งถัดไป
        </td>
      </tr>
    </table>
  </td>
</tr>`,
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
