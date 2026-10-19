import { test } from "node:test";
import assert from "node:assert/strict";

import { otpEmailHtml, resetLinkEmailHtml, guestOrderInviteEmailHtml } from "./email.ts";

const CODE = "185002";
const RESET = "https://smoothlife.vercel.app/reset-password?token=abc123&source=mail";
const SIGNUP = "https://smoothlife.vercel.app/signup?order=SL10482";

// These three strings are the only thing a customer ever sees of this system
// when something has gone wrong with their account, so the checks here are
// about them staying legible and safe rather than about how they look.

// The code has to survive being copied. It is shown spaced out, but the
// spacing is letter-spacing — drawn, not stored — so the clipboard gets the
// six characters and nothing else. Putting each digit in its own cell looks
// the same and copies as "1 8 5 0 0 2", which no login field accepts.
test("the code is one unbroken string, so copying it gives the code", () => {
  const html = otpEmailHtml(CODE);
  assert.ok(html.includes(`>${CODE}</td>`), "ตัวเลขต้องอยู่ในเซลล์เดียวติดกัน");
  // No markup, space or entity anywhere between the digits.
  assert.ok(!new RegExp([...CODE].join("[^0-9]+")).test(html), "ห้ามมีอะไรคั่นระหว่างหลัก");
  assert.ok(/letter-spacing:\d+px;text-indent:\d+px/.test(html), "ระยะห่างต้องเป็นการวาด");
});

test("a link is reachable twice — as the button and as text to copy", () => {
  for (const [html, url] of [
    [resetLinkEmailHtml(RESET), RESET],
    [guestOrderInviteEmailHtml("#SL10482", SIGNUP), SIGNUP],
  ] as const) {
    const escaped = url.replace(/&/g, "&amp;");
    assert.ok(html.includes(`href="${escaped}"`), "ปุ่ม");
    // Printed out as well, for a client that strips the button.
    assert.ok(html.split(escaped).length >= 3, "ลิงก์สำรอง");
  }
});

// order.name arrives from Shopify's webhook payload. It is a shop-set field,
// so it is not attacker-controlled in the usual sense — but it is outside
// values and it is dropped into markup, and the cost of being wrong about
// that is markup running inside somebody's mail client.
test("values from outside cannot carry markup into the message", () => {
  // Checked against the injected string itself, not against "<img" anywhere
  // in the document — the header carries a real <img>, the shop's logo.
  const payload = '#SL1<img src=x onerror="alert(1)">';
  const html = guestOrderInviteEmailHtml(payload, SIGNUP);
  assert.ok(!html.includes("<img src=x"), "แท็กที่ฉีดเข้ามาต้องไม่รอด");
  assert.ok(!html.includes('onerror="alert(1)"'), "แอตทริบิวต์ต้องไม่รอด");
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"), "ต้องยังแสดงข้อความเดิมให้เห็น");
});

// Without this the inbox preview line is whatever text happens to come
// first, which for these is the shop name on every single message.
test("every message carries its own preview line", () => {
  assert.ok(otpEmailHtml(CODE).includes(CODE), "รหัสอยู่ในบรรทัดพรีวิว");
  for (const html of [otpEmailHtml(CODE), resetLinkEmailHtml(RESET), guestOrderInviteEmailHtml("#SL1", SIGNUP)]) {
    const preheader = html.match(/mso-hide:all;">([^<]+)</)?.[1] ?? "";
    assert.ok(preheader.length > 10, preheader);
  }
});

// Gmail drops the <head> on a forward and strips <style> outright, and
// Outlook renders through Word. There is one <style> here, carrying the web
// font for the clients that honour it — so the rule is not "no stylesheet",
// it is that losing the stylesheet costs the font and nothing else.
test("nothing relies on a stylesheet or on layout email cannot do", () => {
  for (const html of [otpEmailHtml(CODE), resetLinkEmailHtml(RESET), guestOrderInviteEmailHtml("#SL1", SIGNUP)]) {
    assert.ok(!/\sclass=/i.test(html), "ห้ามมี class");
    assert.ok(!/display:\s*(flex|grid)/i.test(html), "ห้ามใช้ flex/grid");

    // The only thing the <style> block may do is load the font.
    const blocks = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? [];
    for (const block of blocks) {
      assert.ok(/@import url\('https:\/\/fonts\.googleapis\.com/.test(block), block);
      assert.ok(!/\{[^}]*:[^}]*\}/.test(block.replace(/@import[^;]+;/g, "")), "ห้ามมีกฎอื่น");
    }

    // The stack is declared in the body too, not only in the head that gets
    // dropped, and it ends in faces every device already has — so a client
    // that loads no web font still renders Thai in something chosen.
    const body = html.slice(html.indexOf("<body"));
    assert.ok(body.includes("font-family:'Noto Sans Thai'"), "body ต้องประกาศฟอนต์เอง");
    assert.ok(/font-family:[^";]*sans-serif/.test(body), "ต้องมี fallback ที่ทุกเครื่องมี");
  }
});
