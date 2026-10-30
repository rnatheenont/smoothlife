import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Every order we create in Shopify has to say which customer it belongs to.
//
// `createPaidShopifyOrder` takes `customerId` and it is optional, so leaving
// it out compiles, runs, and produces a real paid order — on a customer
// record Shopify picks by matching the email. For an account that signed up
// by phone OTP the linked record has no email at all, so Shopify matches
// nothing and opens a second record for the same person. Nothing fails. The
// money is taken, the order ships, and the account points at a record with
// no orders on it.
//
// Measured on the live store the day this test was written: of the 35 most
// recent buyers through the shop's own checkout, 10 were in exactly that
// state — a phone-only customer record with zero orders, with their
// purchases on an email-keyed twin. Every one of them came through the two
// call sites that omitted `customerId`; the flash sale and the staff sale
// passed it and have no such pairs.
//
// A compiler cannot see an optional argument that should not have been
// optional, so the test reads the source.

const CREATOR = "createPaidShopifyOrder";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

/** Source with // and comment blocks blanked out, so the prose above a call
 *  cannot stand in for the argument itself. */
function withoutComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/**
 * The argument object of each `createPaidShopifyOrder({ … })` call, as
 * written. Braces are counted rather than matched with a regex, because the
 * object nests several levels deep and holds its own braces in template
 * strings.
 */
function callArguments(code: string): string[] {
  const out: string[] = [];
  const opener = new RegExp(`${CREATOR}\\s*\\(\\s*\\{`, "g");
  for (const match of code.matchAll(opener)) {
    let depth = 1;
    let i = match.index! + match[0].length;
    while (i < code.length && depth > 0) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
      i++;
    }
    out.push(code.slice(match.index! + match[0].length, i - 1));
  }
  return out;
}

test("ทุกที่ที่สร้างออเดอร์ใน Shopify ต้องส่ง customerId ไปด้วย", () => {
  const offenders: string[] = [];
  let calls = 0;

  for (const path of sourceFiles("src")) {
    // shopify-admin.ts is where the function is defined; a definition is not
    // a call site and its parameter list is allowed to say `customerId?`.
    if (path.endsWith("shopify-admin.ts")) continue;
    const code = withoutComments(readFileSync(path, "utf8"));
    if (!code.includes(`${CREATOR}(`)) continue;

    for (const args of callArguments(code)) {
      calls++;
      if (!/(^|[\s,{])customerId\s*[:,]/.test(args)) offenders.push(path);
    }
  }

  // Without this the test passes by scanning nothing, which is how a
  // source-reading check usually rots — a rename of the function alone would
  // otherwise turn it green forever.
  assert.ok(calls >= 4, `คาดว่าจะเจอที่เรียก ${CREATOR} อย่างน้อย 4 แห่ง แต่เจอ ${calls}`);

  assert.deepEqual(
    offenders,
    [],
    `ไฟล์เหล่านี้สร้างออเดอร์โดยไม่บอกว่าเป็นของลูกค้าคนไหน Shopify จะเดาจากอีเมลแล้วเปิดใบลูกค้าใหม่:\n${offenders.join("\n")}`
  );
});
