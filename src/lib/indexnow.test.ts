import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { faqUrlsFor, pingIndexNow, pingFaqChanged, KEY_PATH } from "./indexnow.ts";

const env = { site: process.env.NEXT_PUBLIC_SITE_URL, key: process.env.INDEXNOW_KEY };
const realFetch = globalThis.fetch;

type Call = { url: string; body: Record<string, unknown> };
let calls: Call[] = [];

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.smoothlife.com";
  process.env.INDEXNOW_KEY = "testkey";
  calls = [];
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return new Response("", { status: 200 });
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  for (const [name, value] of [
    ["NEXT_PUBLIC_SITE_URL", env.site],
    ["INDEXNOW_KEY", env.key],
  ] as const) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test("the list is the index plus one page per answer", () => {
  assert.deepEqual(faqUrlsFor(["a", "b"]), ["/faq", "/faq/a", "/faq/b"]);
  assert.deepEqual(faqUrlsFor([]), ["/faq"]);
  assert.deepEqual(faqUrlsFor([null, undefined, "a", "a"]), ["/faq", "/faq/a"]);
});

test("a submission carries the host, the key and where the key is served", async () => {
  const result = await pingFaqChanged(["sunscreen"]);
  assert.deepEqual(result, { ok: true, submitted: 2, status: 200 });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].body, {
    host: "app.smoothlife.com",
    key: "testkey",
    keyLocation: `https://app.smoothlife.com${KEY_PATH}`,
    urlList: ["https://app.smoothlife.com/faq", "https://app.smoothlife.com/faq/sunscreen"],
  });
});

// The one mistake this module must never make: telling a search engine to
// fetch a page that then answers noindex.
test("pages that are not open to search are dropped from the list", async () => {
  const result = await pingIndexNow(["/faq", "/shop", "/product/x", "/"]);
  assert.deepEqual(result, { ok: true, submitted: 1, status: 200 });
  assert.deepEqual(calls[0].body.urlList, ["https://app.smoothlife.com/faq"]);
});

test("nothing is sent when no page in the list is open", async () => {
  const result = await pingIndexNow(["/shop", "/help"]);
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});

// Both of these ship before the production settings exist, and must stay
// silent until they do — a submission naming a preview host is a submission
// for a host whose key file is not there.
test("nothing is sent without a key", async () => {
  delete process.env.INDEXNOW_KEY;
  const result = await pingFaqChanged(["a"]);
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});

test("nothing is sent while the site URL is a preview domain", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://smoothlife.vercel.app";
  const result = await pingFaqChanged(["a"]);
  assert.equal(result.ok, false);
  assert.equal(calls.length, 0);
});

test("a refusal from IndexNow is reported, not thrown", async () => {
  globalThis.fetch = (async () => new Response("bad key", { status: 403 })) as typeof fetch;
  const result = await pingFaqChanged(["a"]);
  assert.equal(result.ok, false);
  assert.match((result as { reason: string }).reason, /403/);
});

test("a network failure is reported, not thrown", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as typeof fetch;
  const result = await pingFaqChanged(["a"]);
  assert.equal(result.ok, false);
});
