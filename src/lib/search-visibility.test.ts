import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { canonicalHost, indexablePath, indexableRequest } from "./search-visibility.ts";

const original = process.env.NEXT_PUBLIC_SITE_URL;
beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.smoothlife.com";
});
afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = original;
});

test("the FAQ is open", () => {
  assert.equal(indexablePath("/faq"), true);
  assert.equal(indexablePath("/faq/how-to-choose-toothpaste"), true);
});

// The shop's own pages are the same words as www.smoothlife.com. Opening one
// is what option B exists not to do, so this is the assertion that matters
// most in the file.
test("everything else stays shut", () => {
  for (const path of ["/", "/shop", "/product/x", "/collections/y", "/help", "/knowledge", "/admin"]) {
    assert.equal(indexablePath(path), false, path);
  }
});

// /faqtastic must not inherit /faq's exemption by sharing a prefix.
test("a path that merely starts with the same letters is not the FAQ", () => {
  assert.equal(indexablePath("/faq-archive"), false);
  assert.equal(indexablePath("/faqtastic"), false);
});

test("the canonical host comes from the site URL", () => {
  assert.equal(canonicalHost(), "app.smoothlife.com");
});

// Both guards ship before the environment variable is set, and must do
// nothing at all until it is — otherwise /faq opens on the preview domain,
// which is the duplicate this is all meant to prevent.
test("no canonical host while the site URL is unset or a preview domain", () => {
  delete process.env.NEXT_PUBLIC_SITE_URL;
  assert.equal(canonicalHost(), null);
  assert.equal(indexableRequest("app.smoothlife.com", "/faq"), false);

  process.env.NEXT_PUBLIC_SITE_URL = "https://smoothlife.vercel.app";
  assert.equal(canonicalHost(), null);
  assert.equal(indexableRequest("smoothlife.vercel.app", "/faq"), false);
});

test("the FAQ is open on the canonical host only", () => {
  assert.equal(indexableRequest("app.smoothlife.com", "/faq"), true);
  assert.equal(indexableRequest("app.smoothlife.com:3000", "/faq"), true);
  assert.equal(indexableRequest("APP.SMOOTHLIFE.COM", "/faq"), true);

  // A preview deployment serving the same answers is a second copy of the
  // page we just asked Google to rank.
  assert.equal(indexableRequest("smoothlife-abc123.vercel.app", "/faq"), false);
  assert.equal(indexableRequest("smoothlife.vercel.app", "/faq/x"), false);
  assert.equal(indexableRequest("campaign.smoothlife.com", "/faq"), false);
  assert.equal(indexableRequest(null, "/faq"), false);
});

test("the canonical host does not open anything but the FAQ", () => {
  assert.equal(indexableRequest("app.smoothlife.com", "/product/x"), false);
  assert.equal(indexableRequest("app.smoothlife.com", "/"), false);
});
