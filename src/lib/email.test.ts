import { test } from "node:test";
import assert from "node:assert/strict";

import { otpEmailHtml, resetLinkEmailHtml, guestOrderInviteEmailHtml } from "./email.ts";

const CODE = "185002";
const RESET = "https://smoothlife.vercel.app/reset-password?token=abc123&source=mail";
const SIGNUP = "https://smoothlife.vercel.app/signup?order=SL10482";

// These three strings are the only thing a customer ever sees of this system
// when something has gone wrong with their account, so the checks here are
// about them staying legible and safe rather than about how they look.

test("the code appears one digit at a time, not as one run of text", () => {
  const html = otpEmailHtml(CODE);
  // Six cells, each holding a single digit — the layout the boxes depend on.
  const cells = html.match(/>[0-9]<\/td>/g) ?? [];
  assert.equal(cells.length, 6);
  for (const digit of CODE) assert.ok(html.includes(`>${digit}</td>`), digit);
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
  const html = guestOrderInviteEmailHtml('#SL1<img src=x onerror="alert(1)">', SIGNUP);
  assert.ok(!html.includes("<img"), "แท็กต้องถูก escape");
  assert.ok(!html.includes('onerror="'), "แอตทริบิวต์ต้องถูก escape");
  assert.ok(html.includes("&lt;img"), "ต้องยังแสดงข้อความเดิมให้เห็น");
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

// Email clients drop <style> blocks and class names; anything styled that
// way renders unstyled. Catching it here is cheaper than finding out from a
// customer's screenshot.
test("nothing relies on a stylesheet or on layout email cannot do", () => {
  for (const html of [otpEmailHtml(CODE), resetLinkEmailHtml(RESET), guestOrderInviteEmailHtml("#SL1", SIGNUP)]) {
    assert.ok(!/<style[\s>]/i.test(html), "ห้ามมี <style>");
    assert.ok(!/\sclass=/i.test(html), "ห้ามมี class");
    assert.ok(!/display:\s*(flex|grid)/i.test(html), "ห้ามใช้ flex/grid");
  }
});
