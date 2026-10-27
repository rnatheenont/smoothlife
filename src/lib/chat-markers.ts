// The chat model ends a reply with an optional marker (see the system prompt
// in api/chat/route.ts): "[[SUGGEST: a | b]]" for optional follow-up chips,
// "[[ASK: a | b]]" for the tappable answers to a qualifying question. The two
// are mutually exclusive per reply.
//
// This is UI plumbing and must never reach the customer as literal bracket
// text. It did: the streaming path stripped both, but the persisted copy only
// ever had SUGGEST removed, so every stored ASK came back as raw brackets the
// moment the panel reloaded its history — and with no buttons, since the
// options were sitting inside that text instead of driving the UI.

export const MARKER_OPENERS = ["[[SUGGEST:", "[[ASK:", "[[HANDOFF:", "[[CLOSE:"];

/**
 * Where the trailing markers start, including the newline before them, or -1.
 *
 * The EARLIEST opener in the text, not the first one in the list above. Sorting
 * by list order cut a reply that carried two markers at the second one, leaving
 * the first sitting in the customer's message as literal "[[CLOSE: ...]]" —
 * everything from the first marker on is plumbing, whichever kind it is.
 */
export function markerIndex(text: string): number {
  let best = -1;
  for (const opener of MARKER_OPENERS) {
    const idx = text.indexOf(opener);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  if (best === -1) return -1;
  return text[best - 1] === "\n" ? best - 1 : best;
}

/**
 * The heading the reply opens with, and the reply without it.
 *
 * "[[TOPIC: ...]]" is the one marker that leads rather than trails, so it
 * cannot go in MARKER_OPENERS above: markerIndex cuts everything from the
 * first opener onwards, and a leading one would cut the whole reply away.
 *
 * It is matched only at the very start, and a half-arrived one counts. While
 * a reply streams, the text begins as "[[TOPIC: มอยส์เจอร" with no closing
 * brackets yet — showing that to the customer as literal punctuation for a
 * second is worse than showing no heading at all, so the partial marker is
 * read as a partial heading and the brackets never appear.
 */
export function splitTopic(text: string): { topic: string; body: string; pending: boolean } {
  const complete = /^\s*\[\[TOPIC:([\s\S]*?)\]\]\s*/i.exec(text);
  if (complete) {
    // A reply that searches the catalogue writes its heading, calls the tool
    // and then writes the answer — two separate turns of model output, and
    // the second one sometimes opens with the heading again. The first is
    // kept and any repeat is dropped, rather than left to appear as literal
    // brackets in the middle of the answer.
    const rest = splitTopic(text.slice(complete[0].length));
    return {
      topic: complete[1].trim(),
      body: rest.topic ? rest.body : text.slice(complete[0].length),
      pending: false,
    };
  }
  const partial = /^\s*\[\[TOPIC:([\s\S]*)$/i.exec(text);
  // The closing "]]" is revealed a character at a time too, so there is a
  // frame where the heading reads "กันแดด]". Trimmed rather than shown.
  if (partial) return { topic: partial[1].replace(/\]+$/, "").trim(), body: "", pending: true };
  // The opener itself, arriving a character at a time. `pending` is what
  // tells the caller apart from an empty reply: at the instant the text is
  // exactly "[[" there is no topic and no body yet, and a caller that only
  // checked those two fell back to printing the raw text — so the customer
  // saw "[[" sitting in the bubble for a frame. Seen on a real reply.
  if (text.length > 0 && /^\s*\[(\[(T(O(P(I(C(:)?)?)?)?)?)?)?$/i.test(text)) {
    return { topic: "", body: "", pending: true };
  }
  return { topic: "", body: text, pending: false };
}

export type SplitMessage = {
  /** The reply as the customer should see it, without its heading. */
  text: string;
  /** The heading it opened with, if any. */
  topic: string;
  kind: "ask" | "suggest" | "handoff" | "close" | null;
  options: string[];
  /** For "handoff" and "close": why, in her words. */
  reason: string;
};

export function splitMarker(content: string): SplitMessage {
  const idx = markerIndex(content);
  // Every caller reads `.text`, so stripping the heading here is what keeps
  // the brackets out of the places that only want the words — the inbox, the
  // LINE reply, the search index — without each of them having to know the
  // marker exists.
  if (idx === -1) {
    const { topic, body } = splitTopic(content);
    return { text: body, topic, kind: null, options: [], reason: "" };
  }

  // Every marker in the reply, not just the first. The model is told to write
  // at most one, and it does not always: an ASK and a HANDOFF arrived in the
  // same turn, and reading from the first opener to the last "]]" made one
  // giant marker whose final "option" was a chip containing the literal text
  // "]] [[HANDOFF: ลูกค้าถามว่า...". The customer was offered it as an answer.
  const found: { kind: "ask" | "suggest" | "handoff" | "close"; inner: string }[] = [];
  for (const m of content.matchAll(/\[\[(SUGGEST|ASK|HANDOFF|CLOSE):([\s\S]*?)\]\]/gi)) {
    const name = m[1].toUpperCase();
    found.push({
      kind:
        name === "ASK" ? "ask" : name === "HANDOFF" ? "handoff" : name === "CLOSE" ? "close" : "suggest",
      inner: m[2].trim(),
    });
  }

  const { topic, body } = splitTopic(content.slice(0, idx).trimEnd());
  const text = body;
  if (found.length === 0) return { text, topic, kind: null, options: [], reason: "" };

  // A handover wins when both appear. Dropping it would leave the customer
  // waiting on a request nobody received; dropping the chips only costs them a
  // tap they can type instead.
  const chosen = found.find((f) => f.kind === "handoff") ?? found[0];

  return {
    text,
    topic,
    kind: chosen.kind,
    options:
      chosen.kind === "handoff" || chosen.kind === "close"
        ? []
        : chosen.inner
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 4),
    reason: chosen.kind === "handoff" || chosen.kind === "close" ? chosen.inner : "",
  };
}

/**
 * What to keep in the stored transcript.
 *
 * ASK stays — it is an unanswered question and reopening the panel has to put
 * its buttons back. SUGGEST, HANDOFF and CLOSE are spent the moment the turn
 * ends: a closing offer the customer never answered should not come back as
 * two buttons under a week-old message.
 */
export function contentForTranscript(content: string): string {
  const { kind } = splitMarker(content);
  if (kind === "ask") return content;
  // Cut at the trailing markers rather than taking splitMarker's `text`: that
  // one has the heading removed for display, and the stored copy keeps it, so
  // reopening the chat tomorrow shows the same reply it showed today.
  const idx = markerIndex(content);
  return idx === -1 ? content : content.slice(0, idx).trimEnd();
}

/**
 * Hides a marker that is still arriving at the end of a streaming reply.
 *
 * Product cards are written as "[[slug]]" and the renderer only recognises
 * the finished thing, so while a reply streams there is a moment where the
 * bubble literally reads "...ลองตัวนี้ได้ค่ะ [[cerave" — caught on
 * production at 5.4 seconds into a real answer. Older than the heading and
 * nothing to do with it; the same character-by-character reveal exposes both.
 *
 * Only a run at the very end with no closing bracket in it, so a finished
 * "[[slug]]" and ordinary bracketed text such as "[ลด 20%]" are untouched.
 * Only while streaming: a malformed marker in a finished reply is a real
 * mistake and showing it is how anyone finds out.
 */
export function trimPartialMarker(text: string): string {
  return text.replace(/\[{1,2}[^\]\n]*$/, "");
}
