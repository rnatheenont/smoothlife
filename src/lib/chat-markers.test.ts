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
  for (const partial of ["[", "[[", "[[TOP", "[[TOPIC:", "[[TOPIC: มอยส์เจอร"]) {
    const { topic, body } = splitTopic(partial);
    assert.equal(body, "", `body for ${JSON.stringify(partial)}`);
    assert.ok(!topic.includes("["), `topic for ${JSON.stringify(partial)}`);
  }
  assert.equal(splitTopic("[[TOPIC: มอยส์เจอร").topic, "มอยส์เจอร");
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
