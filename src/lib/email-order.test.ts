import { test } from "node:test";
import assert from "node:assert/strict";

import {
  orderPaidEmail,
  orderShippedEmail,
  orderDeliveredEmail,
  orderRefundedEmail,
  orderCancelledEmail,
} from "./email-order.ts";

const ORDER = { orderId: 18967399891095, orderName: "#SL1042" };

const ALL = () => [
  orderPaidEmail({ ...ORDER, total: 1465, items: [{ title: "AROMASE", quantity: 1 }], points: 146, balance: 980 }),
  orderShippedEmail({ ...ORDER, fulfillment: { tracking_company: "Flash", tracking_number: "TH9988", tracking_urls: ["https://track.test/TH9988"] } }),
  orderDeliveredEmail(ORDER),
  orderRefundedEmail({ ...ORDER, amount: 1465, pointsReversed: 146 }),
  orderCancelledEmail({ ...ORDER, reason: "inventory", pointsReversed: 146, refunded: false }),
];

// Five messages land in the same inbox over a week, about possibly several
// orders at once. A message that does not say which order it is about is a
// message the reader has to go and investigate.
test("every message names the order, in the subject and in the body", () => {
  for (const mail of ALL()) {
    assert.ok(mail.subject.includes(ORDER.orderName), mail.subject);
    assert.ok(mail.html.includes(ORDER.orderName), mail.subject);
    assert.ok(mail.html.includes(`/account/orders/${ORDER.orderId}`), mail.subject);
  }
});

// The subject is the only part most people read, so each has to be different
// from the others at a glance.
test("the subjects are distinct from each other", () => {
  const subjects = ALL().map((m) => m.subject);
  assert.equal(new Set(subjects).size, subjects.length, subjects.join(" | "));
});

// This is the one that costs real trust. A cancellation knows nothing about
// whether money has moved; saying it has, when Shopify has not refunded, is
// a promise somebody else is left to keep.
test("a cancellation promises a refund only when there has been one", () => {
  const notRefunded = orderCancelledEmail({ ...ORDER, refunded: false }).html;
  assert.ok(!notRefunded.includes("คืนเงินให้แล้ว"), "ห้ามบอกว่าคืนเงินแล้ว");
  assert.ok(notRefunded.includes("ทีมงานจะติดต่อกลับ"), "ต้องบอกว่าจะติดต่อกลับ");

  const refunded = orderCancelledEmail({ ...ORDER, refunded: true }).html;
  assert.ok(refunded.includes("คืนเงินให้แล้ว"));
});

// "inventory" on its own reads as a system fault, and an English word inside
// a Thai sentence reads as the back office leaking.
test("a cancel reason is translated, or left out entirely", () => {
  assert.ok(orderCancelledEmail({ ...ORDER, reason: "inventory" }).html.includes("สินค้าไม่พอจัดส่ง"));
  for (const reason of ["something_new", "", null]) {
    const html = orderCancelledEmail({ ...ORDER, reason }).html;
    assert.ok(!html.includes("เหตุผล"), `ไม่ควรมีแถวเหตุผลเมื่อแปลไม่ได้: ${reason}`);
    if (reason) assert.ok(!html.includes(reason), "ห้ามโชว์ค่าดิบ");
  }
});

// Not every parcel has a tracking number — a shop that packs its own orders
// may have none at all. The button must still go somewhere real.
test("shipping without a tracking number still has somewhere to go", () => {
  const bare = orderShippedEmail({ ...ORDER, fulfillment: {} }).html;
  assert.ok(!bare.includes("ติดตามพัสดุ"), "ไม่มีเลขพัสดุก็ไม่ควรมีปุ่มติดตาม");
  assert.ok(bare.includes(`/account/orders/${ORDER.orderId}`));

  const tracked = orderShippedEmail({
    ...ORDER,
    fulfillment: { tracking_number: "TH9988", tracking_urls: ["https://track.test/TH9988"] },
  }).html;
  assert.ok(tracked.includes("https://track.test/TH9988"), "ลิงก์ติดตามต้องอยู่");
  assert.ok(tracked.includes("TH9988"));
});

// Product titles come from Shopify, and go straight into markup.
test("product titles cannot carry markup into the message", () => {
  const html = orderPaidEmail({
    ...ORDER,
    total: 100,
    items: [{ title: '<img src=x onerror="alert(1)">', quantity: 1 }],
    points: 0,
    balance: null,
  }).html;
  assert.ok(!html.includes("<img src=x"), "แท็กที่ฉีดเข้ามาต้องไม่รอด");
  assert.ok(html.includes("&lt;img src=x"), "ต้องยังแสดงข้อความเดิม");
});

// Points are a reward, not a line every order has: an order that earned none
// should not carry an empty row saying so.
test("points are shown only when there are some", () => {
  const none = orderPaidEmail({ ...ORDER, total: 100, items: [], points: 0, balance: 980 }).html;
  assert.ok(!none.includes("แต้ม"), "ไม่ได้แต้มก็ไม่ต้องพูดถึงแต้ม");

  const some = orderPaidEmail({ ...ORDER, total: 100, items: [], points: 10, balance: 980 }).html;
  assert.ok(some.includes("แต้มที่ได้รับ") && some.includes("แต้มสะสมทั้งหมด"));
});

// A refund of points that were never credited is not a fact worth printing.
test("a refund mentions reversed points only when points came back", () => {
  assert.ok(!orderRefundedEmail({ ...ORDER, amount: 500, pointsReversed: 0 }).html.includes("แต้มที่ถูกหักคืน"));
  assert.ok(orderRefundedEmail({ ...ORDER, amount: 500, pointsReversed: 50 }).html.includes("แต้มที่ถูกหักคืน"));
});

test("amounts are written as baht, rounded, with separators", () => {
  const html = orderPaidEmail({ ...ORDER, total: 1465.4, items: [], points: 0, balance: null }).html;
  assert.ok(html.includes("฿1,465"), "ต้องเป็น ฿1,465");
});
