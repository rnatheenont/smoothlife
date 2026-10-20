import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// What the shop says it accepts, against what checkout actually offers.
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

function enabledChannels(): string[] {
  const src = readFileSync("src/app/api/checkout/init/route.ts", "utf8");
  const match = src.match(/paymentChannel:\s*\[([^\]]*)\]/);
  assert.ok(match, "ไม่เจอ paymentChannel ใน checkout — ถ้าย้ายที่แล้วต้องแก้เทสต์นี้ด้วย");
  return [...match[1].matchAll(/"([A-Z0-9]+)"/g)].map((m) => m[1]);
}

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
