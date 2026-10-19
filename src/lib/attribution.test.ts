import { test } from "node:test";
import assert from "node:assert/strict";

import { buildAttribution } from "./attribution.ts";

// What this is guarding: a payment from app.smoothlife.com arrived filed as
// channel "other", i.e. as traffic an outside site sent us, because the only
// hostnames the channel rules recognised as ours were smoothlife.com and
// www.smoothlife.com. Today app.smoothlife.com is a test domain and the
// miscount is a handful of visits, but it is where the shop is moving, and
// "% of sales from social" is read straight off this column.
//
// resolveChannel is private, so each case goes in through buildAttribution,
// which is what the proxy actually calls.

const url = (path = "/") => new URL(`https://app.smoothlife.com${path}`);

test("our own hostnames are not a referral from somebody else", () => {
  for (const host of [
    "https://app.smoothlife.com/shop",
    "https://smoothlife.com/",
    "https://www.smoothlife.com/cart",
    "https://smoothlife.vercel.app/shop",
    "https://smoothlife-git-demo-abc123.vercel.app/shop",
  ]) {
    assert.equal(buildAttribution(url(), host).channel, "direct", host);
  }
});

test("no referrer at all is still direct", () => {
  assert.equal(buildAttribution(url(), null).channel, "direct");
});

test("an outside site is still counted as one", () => {
  assert.equal(buildAttribution(url(), "https://pantip.com/topic/1").channel, "other");
  assert.equal(buildAttribution(url(), "https://www.facebook.com/").channel, "facebook");
  assert.equal(buildAttribution(url(), "https://chatgpt.com/").channel, "ai_search");
});

// A hostname ending in our domain but not belonging to us — the suffix match
// is on ".vercel.app" only, and this must not slip through it.
test("a lookalike hostname is not us", () => {
  assert.equal(buildAttribution(url(), "https://app.smoothlife.com.evil.test/").channel, "other");
  assert.equal(buildAttribution(url(), "https://notsmoothlife.com/").channel, "other");
});

// utm_source outranks the referrer, and that order must survive the change
// above: a tagged LINE link opened from one of our own pages is still LINE.
test("a tagged link still wins over the referrer", () => {
  const tagged = new URL("https://app.smoothlife.com/?utm_source=line");
  assert.equal(buildAttribution(tagged, "https://app.smoothlife.com/shop").channel, "line");
});
