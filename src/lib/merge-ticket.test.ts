import { test } from "node:test";
import assert from "node:assert/strict";

// A merge ticket is the only thing standing between "proved a channel" and
// "one of these two accounts is about to be deleted", so what it refuses
// matters more than what it accepts.
//
// Set before any test body runs, which is all that is needed: the module
// reads the secret when it signs, not when it is imported — so the hoisting
// of this import above the line below does not matter.
process.env.SESSION_SECRET = "merge-ticket-test-secret";

import { createMergeTicket, readMergeTicket } from "./merge-ticket.ts";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const ticket = () => createMergeTicket({ session: A, other: B, via: "email", uid: "a@b.c" });

test("ตั๋วที่ออกให้ session ไหน ใช้ได้กับ session นั้น", () => {
  const t = readMergeTicket(ticket(), A);
  assert.ok(t);
  assert.equal(t.session, A);
  assert.equal(t.other, B);
  assert.equal(t.via, "email");
});

test("session อื่นใช้ตั๋วนี้ไม่ได้", () => {
  // The one that matters: a ticket read out of a response body, or lifted
  // from a shared machine's cookie jar, is worth nothing in another
  // account's session.
  assert.equal(readMergeTicket(ticket(), B), null);
  assert.equal(readMergeTicket(ticket(), "33333333-3333-4333-8333-333333333333"), null);
});

test("แก้เนื้อในตั๋วแล้วลายเซ็นไม่ผ่าน", () => {
  const [encoded, sig] = ticket().split(".");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
  // Point it at a different account while keeping the original signature.
  payload.other = "44444444-4444-4444-8444-444444444444";
  const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
  assert.equal(readMergeTicket(forged, A), null);
});

test("ตั๋วที่ไม่ใช่ตั๋ว", () => {
  for (const junk of ["", "abc", "abc.def", "...", null, undefined, 42, {}]) {
    assert.equal(readMergeTicket(junk, A), null, `ควรปฏิเสธ: ${JSON.stringify(junk)}`);
  }
});

test("ตั๋วหมดอายุหลัง 10 นาที", () => {
  const original = Date.now;
  try {
    const t = ticket();
    Date.now = () => original() + 9 * 60 * 1000;
    assert.ok(readMergeTicket(t, A), "9 นาทียังใช้ได้");
    Date.now = () => original() + 11 * 60 * 1000;
    assert.equal(readMergeTicket(t, A), null, "11 นาทีต้องหมดอายุ");
  } finally {
    Date.now = original;
  }
});

test("ตั๋วที่ชี้กลับมาที่บัญชีตัวเองถูกปฏิเสธ", () => {
  // merge_user_accounts refuses this too, but a ticket that even describes
  // it should never reach the database — the id it would delete is the id
  // the session is holding.
  assert.equal(readMergeTicket(createMergeTicket({ session: A, other: A, via: "email", uid: "x" }), A), null);
});
