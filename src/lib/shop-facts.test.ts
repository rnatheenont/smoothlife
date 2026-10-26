import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// The facts the shop states about itself, checked against each other.
//
// Two kinds live here. Payment: what the pages promise, against what checkout
// actually sends to 2C2P. Delivery and returns: the numbers that appear in
// four places and must be one number — free shipping, 1-3 business days, 14
// days to return.
//
// These drifted apart and stayed apart. /help/payment, the terms page, the
// page builder's copy of /help/payment and the article the assistant answers
// from all listed four ways to pay — PromptPay, card, bank transfer with a
// slip, and cash on delivery — while the checkout has only ever sent
// `paymentChannel: ["CC", "PPQR"]` to 2C2P. A customer who came for cash on
// delivery found out at the payment step, and anyone who asked the assistant
// first was told the wrong thing with confidence.
//
// Nothing in the type system connects a marketing page to a payment
// integration, so this reads both and compares them. It is deliberately
// about the *claims*: adding a channel to checkout without saying so is
// harmless, promising one that does not exist is not.

const CHANNEL_NAMES: Record<string, { th: string[]; label: string }> = {
  CC: { th: ["บัตรเครดิต", "บัตรเดบิต"], label: "บัตรเครดิต/เดบิต" },
  PPQR: { th: ["PromptPay", "พร้อมเพย์"], label: "PromptPay QR" },
};

/** Claims that must not appear anywhere customer-facing while the channel
 *  behind them is off. Each is a phrase a reader would take as a promise. */
const PROMISES_OFF = [
  { phrase: "เก็บเงินปลายทาง", needs: "COD" },
  { phrase: "โอนเงินผ่านธนาคาร", needs: "BANK" },
  { phrase: "แนบสลิป", needs: "BANK" },
];

/** The pages and data a customer or the assistant reads. */
const CUSTOMER_FACING = [
  "src/data/help.ts",
  "src/app/terms/page.tsx",
  "src/lib/pages/default-docs/system.ts",
];

/**
 * Every channel the shop can offer, read from the one function that decides.
 *
 * It used to read the literal out of checkout/init. That literal is gone:
 * the amount decides now (PromptPay QR cannot carry over
 * PROMPTPAY_QR_MAX_THB), so all three checkout routes ask
 * paymentChannelsFor in @/lib/payment-limits instead. What a page may
 * promise is still the union of what that function can ever return, which
 * is what this reads.
 */
function enabledChannels(): string[] {
  const src = readFileSync("src/lib/payment-limits.ts", "utf8");
  const body = src.match(/export function paymentChannelsFor\([\s\S]*?\n}/);
  assert.ok(body, "ไม่เจอ paymentChannelsFor ใน @/lib/payment-limits — ถ้าย้ายที่แล้วต้องแก้เทสต์นี้ด้วย");
  const channels = [...new Set([...body[0].matchAll(/"([A-Z0-9]+)"/g)].map((m) => m[1]))];
  assert.ok(
    readFileSync("src/app/api/checkout/init/route.ts", "utf8").includes("paymentChannelsFor("),
    "checkout/init ไม่ได้เรียก paymentChannelsFor แล้ว — เทสต์นี้กำลังอ่านช่องทางจากที่ที่ checkout ไม่ได้ใช้"
  );
  return channels;
}

test("เพดาน PromptPay ที่โค้ดใช้ ต้องตรงกับที่หน้าช่วยเหลือบอกลูกค้า", () => {
  // A shopper over the ceiling is sent to a card. If the page does not say
  // so, they find out on 2C2P's page — which is exactly the flash sale that
  // put 46 payment attempts into `pending` and never charged one of them.
  const ceiling = readFileSync("src/lib/payment-limits.ts", "utf8").match(
    /PROMPTPAY_QR_MAX_THB\s*=\s*([\d_]+)/
  );
  assert.ok(ceiling, "ไม่เจอ PROMPTPAY_QR_MAX_THB");
  const thb = Number(ceiling[1].replace(/_/g, ""));
  assert.ok(
    readFileSync("src/data/help.ts", "utf8").includes(thb.toLocaleString("en-US")),
    `โค้ดจำกัด PromptPay ที่ ${thb.toLocaleString("en-US")} บาท แต่ /help/payment ไม่ได้บอกตัวเลขนี้`
  );
});

test("checkout ยังประกาศช่องทางที่อ่านได้", () => {
  const channels = enabledChannels();
  assert.ok(channels.length > 0, "อ่านช่องทางจาก checkout ไม่ได้เลย");
  for (const c of channels) {
    assert.ok(CHANNEL_NAMES[c], `ช่องทาง "${c}" เปิดอยู่แต่เทสต์นี้ยังไม่รู้จัก — เพิ่มชื่อไทยของมันก่อน`);
  }
});

test("ทุกช่องทางที่ checkout เปิด ต้องมีบอกไว้ในหน้าช่วยเหลือ", () => {
  const help = readFileSync("src/data/help.ts", "utf8");
  for (const c of enabledChannels()) {
    const names = CHANNEL_NAMES[c].th;
    assert.ok(
      names.some((n) => help.includes(n)),
      `checkout เปิด ${CHANNEL_NAMES[c].label} แต่ /help/payment ไม่ได้บอกไว้`
    );
  }
});

test("ห้ามมีหน้าไหนสัญญาช่องทางที่ยังไม่เปิด", () => {
  // The claim and its denial read almost the same to a substring search, so
  // the sentence that says a channel is NOT available is excluded first —
  // otherwise saying "ยังไม่รองรับการเก็บเงินปลายทาง" would fail the very
  // check that sentence exists to satisfy.
  const DENIAL = /ขณะนี้ยังไม่รองรับ[^\n]*/g;

  const offenders: string[] = [];
  for (const file of CUSTOMER_FACING) {
    const text = readFileSync(file, "utf8").replace(DENIAL, "");
    for (const { phrase } of PROMISES_OFF) {
      if (text.includes(phrase)) offenders.push(`${file} — "${phrase}"`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    "มีหน้าที่ยังสัญญาช่องทางชำระเงินที่ checkout ไม่ได้เปิด:\n  " + offenders.join("\n  ")
  );
});

test("เทสต์นี้จับได้จริง ถ้ามีคนเพิ่มคำสัญญากลับเข้าไป", () => {
  // Guards the guard: the exclusion above is a regex, and a regex that
  // accidentally swallowed the whole file would make every check pass.
  const DENIAL = /ขณะนี้ยังไม่รองรับ[^\n]*/g;
  const pretend = 'body: "ชำระเงินสดเมื่อได้รับสินค้า", title: "เก็บเงินปลายทาง (COD)"';
  assert.ok(pretend.replace(DENIAL, "").includes("เก็บเงินปลายทาง"));

  const denial = "ขณะนี้ยังไม่รองรับการเก็บเงินปลายทาง (COD) และการโอนเงินแนบสลิป";
  assert.equal(denial.replace(DENIAL, "").includes("เก็บเงินปลายทาง"), false);
});


// ----------------------------------------------------------- delivery facts

/**
 * The numbers a customer plans around.
 *
 * They are written in help.ts, in the page builder's copy of /help/delivery
 * and in the terms, and the FAQ answers repeat them again in the database.
 * Nothing links the copies, so this compares the ones that are in code: a
 * change to one that is not a change to all of them is a shop that says two
 * different things depending on which page you opened.
 *
 * The database copy cannot be checked here — a unit test that needed Supabase
 * would be a unit test that fails on a train — so the FAQ answers are checked
 * by whoever publishes them. What this catches is the other three drifting.
 */
const DELIVERY_FACTS = [
  { what: "ส่งฟรี ไม่มียอดขั้นต่ำ", pattern: /ไม่มียอดขั้นต่ำ/ },
  { what: "จัดส่ง 1-3 วันทำการ", pattern: /1-3 วันทำการ/ },
  { what: "คืนได้ภายใน 14 วัน", pattern: /14 วัน/ },
];

const STATES_DELIVERY = ["src/data/help.ts", "src/lib/pages/default-docs/system.ts"];

test("ตัวเลขเรื่องจัดส่งและคืนสินค้า ต้องตรงกันทุกที่ที่เขียนไว้", () => {
  const missing: string[] = [];
  for (const file of STATES_DELIVERY) {
    const text = readFileSync(file, "utf8");
    for (const { what, pattern } of DELIVERY_FACTS) {
      if (!pattern.test(text)) missing.push(`${file} — ไม่มี "${what}"`);
    }
  }
  assert.deepEqual(missing, [], "ตัวเลขหายไปจากบางที่:\n  " + missing.join("\n  "));
});

test("ไม่มีที่ไหนตั้งยอดขั้นต่ำของการส่งฟรี", () => {
  // "ส่งฟรีเมื่อซื้อครบ…" was in the terms while /help/delivery said there is
  // no minimum. A customer reading the terms would wait to reach a number
  // that does not exist.
  const offenders: string[] = [];
  for (const file of [...STATES_DELIVERY, "src/app/terms/page.tsx"]) {
    const text = readFileSync(file, "utf8");
    if (/ส่งฟรีเมื่อซื้อครบ|ซื้อครบ\s*\d/.test(text)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], "มีที่ที่ยังบอกว่าส่งฟรีต้องซื้อครบยอด:\n  " + offenders.join("\n  "));
});
