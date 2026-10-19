import { test } from "node:test";
import assert from "node:assert/strict";

import { abandonedCheckoutEmail } from "./email-order.ts";

const CART = {
  cartUrl: "https://smoothlife.vercel.app/cart",
  total: 1465,
  items: [{ title: "AROMASE Herbal Scalp Care Spray 40 ml.", quantity: 1 }],
};

// This is the one email on the site that nobody asked to receive. The checks
// here are about what it is allowed to claim, because an unsolicited email
// that also misleads is how a shop ends up in a spam folder for good.

test("it does not claim anything is being held", () => {
  const html = abandonedCheckoutEmail(CART).html;
  for (const promise of ["จอง", "กันไว้", "สำรองไว้", "เก็บไว้ให้"]) {
    assert.ok(!html.includes(promise), `ห้ามสัญญาว่า${promise}`);
  }
  // The stock reservation behind the row expires after fifteen minutes, so
  // the honest line is the opposite one.
  assert.ok(html.includes("ราคาและสต็อกเปลี่ยนแปลงได้"));
});

test("it says it is sent once, and means it", () => {
  assert.ok(abandonedCheckoutEmail(CART).html.includes("ส่งครั้งเดียวต่อหนึ่งตะกร้า"));
});

test("it shows what was in the basket and where to go", () => {
  const html = abandonedCheckoutEmail(CART).html;
  assert.ok(html.includes("AROMASE Herbal Scalp Care Spray 40 ml."), "ต้องบอกว่ามีอะไรอยู่");
  assert.ok(html.includes("฿1,465"));
  assert.ok(html.includes(CART.cartUrl));
});

// The cart is in localStorage on the device they shopped from. Opening this
// on a different phone shows an empty cart, so the email has to carry the
// list itself and must not pretend the basket follows them around.
test("it is honest about where the basket actually lives", () => {
  assert.ok(abandonedCheckoutEmail(CART).html.includes("ตะกร้าจะอยู่บนเครื่องที่คุณเลือกของไว้"));
});

test("product titles cannot carry markup into the message", () => {
  const html = abandonedCheckoutEmail({
    ...CART,
    items: [{ title: '<img src=x onerror="alert(1)">', quantity: 1 }],
  }).html;
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img src=x"));
});

// It lands in the same inbox as the five order emails; a subject that reads
// like one of those would be opened expecting an order.
test("its subject is not mistakable for an order email", () => {
  const subject = abandonedCheckoutEmail(CART).subject;
  for (const word of ["ยืนยันคำสั่งซื้อ", "จัดส่ง", "คืนเงิน", "ยกเลิก"]) {
    assert.ok(!subject.includes(word), `หัวเรื่องไม่ควรมีคำว่า ${word}`);
  }
  assert.ok(subject.includes("ตะกร้า"));
});
