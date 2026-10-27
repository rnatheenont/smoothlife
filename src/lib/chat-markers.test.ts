import { test } from "node:test";
import assert from "node:assert/strict";

import { splitTopic, splitMarker, contentForTranscript } from "./chat-markers.ts";

// The heading a reply opens with. It is the only marker that leads rather
// than trails, and it is read while the reply is still arriving, so the
// half-written cases matter as much as the finished one.

test("a finished heading is lifted off the reply", () => {
  const { topic, body } = splitTopic("[[TOPIC: มอยส์เจอร์ไรเซอร์ผิวแห้ง]]\nแนะนำตัวนี้ค่ะ");
  assert.equal(topic, "มอยส์เจอร์ไรเซอร์ผิวแห้ง");
  assert.equal(body, "แนะนำตัวนี้ค่ะ");
});

test("a reply without one is left alone", () => {
  const { topic, body } = splitTopic("แนะนำตัวนี้ค่ะ");
  assert.equal(topic, "");
  assert.equal(body, "แนะนำตัวนี้ค่ะ");
});

test("a half-arrived heading never shows its brackets", () => {
  // Every prefix of the opener, because the reveal shows the reply one
  // character at a time and every one of these is a frame somebody sees.
  for (const partial of ["[", "[[", "[[T", "[[TO", "[[TOP", "[[TOPI", "[[TOPIC", "[[TOPIC:", "[[TOPIC: มอยส์เจอร"]) {
    const { topic, body, pending } = splitTopic(partial);
    assert.equal(body, "", `body for ${JSON.stringify(partial)}`);
    assert.ok(!topic.includes("["), `topic for ${JSON.stringify(partial)}`);
    // Without this the bubble has no topic and no body to render and falls
    // back to the raw text — which is how "[[" reached a customer.
    assert.equal(pending, true, `pending for ${JSON.stringify(partial)}`);
  }
  assert.equal(splitTopic("[[TOPIC: มอยส์เจอร").topic, "มอยส์เจอร");
});

test("ordinary text is never mistaken for a half-written marker", () => {
  for (const plain of ["สวัสดีค่ะ", "[sic] แบบนี้ค่ะ", "[[SUGGEST: a]]", ""]) {
    assert.equal(splitTopic(plain).pending, false, JSON.stringify(plain));
  }
  assert.equal(splitTopic("สวัสดีค่ะ").body, "สวัสดีค่ะ");
});

test("a heading mid-reply is ordinary text, not a marker", () => {
  const text = "แนะนำค่ะ [[TOPIC: ไม่ใช่หัวข้อ]]";
  assert.equal(splitTopic(text).topic, "");
  assert.equal(splitTopic(text).body, text);
});

test("the heading comes off and the trailing chips still parse", () => {
  const raw = "[[TOPIC: ครีมกันแดด]]\nแนะนำตัวนี้ค่ะ\n[[SUGGEST: ราคาเท่าไหร่ | มีไซส์อื่นไหม]]";
  const { text, topic, kind, options } = splitMarker(raw);
  assert.equal(topic, "ครีมกันแดด");
  assert.equal(text, "แนะนำตัวนี้ค่ะ");
  assert.equal(kind, "suggest");
  assert.deepEqual(options, ["ราคาเท่าไหร่", "มีไซส์อื่นไหม"]);
});

// The stored copy keeps the heading, or reopening the chat tomorrow shows a
// different reply from the one that was on screen today.
test("the transcript keeps the heading and drops the spent chips", () => {
  const raw = "[[TOPIC: ครีมกันแดด]]\nแนะนำตัวนี้ค่ะ\n[[SUGGEST: ราคาเท่าไหร่]]";
  const kept = contentForTranscript(raw);
  assert.ok(kept.startsWith("[[TOPIC: ครีมกันแดด]]"));
  assert.ok(!kept.includes("SUGGEST"));
  assert.equal(splitMarker(kept).text, "แนะนำตัวนี้ค่ะ");
});

test("an unanswered question is stored whole, heading and all", () => {
  const raw = "[[TOPIC: เลือกให้ตรงจุด]]\nอยากได้ด้านไหนคะ\n[[ASK: มอยส์เจอร์ | เซรั่ม]]";
  assert.equal(contentForTranscript(raw), raw);
  assert.equal(splitMarker(contentForTranscript(raw)).topic, "เลือกให้ตรงจุด");
});

// A reply that searches writes the heading, runs the tool, then writes the
// answer — and sometimes repeats the heading when it starts writing again.
test("a heading written twice is shown once", () => {
  const { topic, body } = splitTopic("[[TOPIC: กันแดด]]\n\n[[TOPIC: กันแดด]]\n\nแนะนำตัวนี้ค่ะ");
  assert.equal(topic, "กันแดด");
  assert.equal(body, "แนะนำตัวนี้ค่ะ");
});

test("a half-written repeat does not swallow the answer", () => {
  const { topic, body } = splitTopic("[[TOPIC: กันแดด]]\n\nแนะนำตัวนี้ค่ะ");
  assert.equal(topic, "กันแดด");
  assert.equal(body, "แนะนำตัวนี้ค่ะ");
});

test("the closing bracket never shows up inside the heading", () => {
  assert.equal(splitTopic("[[TOPIC: กันแดด]").topic, "กันแดด");
  assert.equal(splitTopic("[[TOPIC: กันแดด]").pending, true);
});
