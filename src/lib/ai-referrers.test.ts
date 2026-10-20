import { test } from "node:test";
import assert from "node:assert/strict";
import { aiEngineOf } from "./ai-referrers.ts";

test("utm_source names the engine", () => {
  assert.equal(aiEngineOf("chatgpt.com", null), "chatgpt");
  assert.equal(aiEngineOf("perplexity", null), "perplexity");
  assert.equal(aiEngineOf("openai", null), "chatgpt");
});

test("referrer host names the engine", () => {
  assert.equal(aiEngineOf(null, "chatgpt.com"), "chatgpt");
  assert.equal(aiEngineOf(null, "www.perplexity.ai"), "perplexity");
  assert.equal(aiEngineOf(null, "claude.ai"), "claude");
});

// The whole reason gemini is checked before google: both end in google.com,
// and filing an assistant's citation as an organic search click would hide
// the one number this breakdown exists to produce.
test("gemini is not plain google", () => {
  assert.equal(aiEngineOf(null, "gemini.google.com"), "gemini");
  assert.equal(aiEngineOf(null, "www.google.com"), null);
  assert.equal(aiEngineOf(null, "google.co.th"), null);
});

test("ordinary traffic is not an engine", () => {
  assert.equal(aiEngineOf(null, null), null);
  assert.equal(aiEngineOf(null, "facebook.com"), null);
  assert.equal(aiEngineOf("newsletter", "mail.google.com"), null);
});

// A bare product name in a referrer host would match any domain containing
// the word — claudette.example.com is not Claude.
test("product names match utm_source but not any host containing them", () => {
  assert.equal(aiEngineOf("claude", null), "claude");
  assert.equal(aiEngineOf(null, "claudette-cosmetics.com"), null);
  assert.equal(aiEngineOf(null, "geminishop.co.th"), null);
});

test("utm_source wins over the referrer", () => {
  assert.equal(aiEngineOf("perplexity", "chatgpt.com"), "perplexity");
});
