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

export const MARKER_OPENERS = ["[[SUGGEST:", "[[ASK:", "[[HANDOFF:"];

/** Where the trailing marker starts, including the newline before it, or -1. */
export function markerIndex(text: string): number {
  for (const opener of MARKER_OPENERS) {
    const idx = text.indexOf(opener);
    if (idx !== -1) return text[idx - 1] === "\n" ? idx - 1 : idx;
  }
  return -1;
}

export type SplitMessage = {
  /** The reply as the customer should see it. */
  text: string;
  kind: "ask" | "suggest" | "handoff" | null;
  options: string[];
  /** For "handoff": why Smoothie is passing this to a person, in her words. */
  reason: string;
};

export function splitMarker(content: string): SplitMessage {
  const idx = markerIndex(content);
  if (idx === -1) return { text: content, kind: null, options: [], reason: "" };

  // Every marker in the reply, not just the first. The model is told to write
  // at most one, and it does not always: an ASK and a HANDOFF arrived in the
  // same turn, and reading from the first opener to the last "]]" made one
  // giant marker whose final "option" was a chip containing the literal text
  // "]] [[HANDOFF: ลูกค้าถามว่า...". The customer was offered it as an answer.
  const found: { kind: "ask" | "suggest" | "handoff"; inner: string }[] = [];
  for (const m of content.matchAll(/\[\[(SUGGEST|ASK|HANDOFF):([\s\S]*?)\]\]/gi)) {
    const name = m[1].toUpperCase();
    found.push({
      kind: name === "ASK" ? "ask" : name === "HANDOFF" ? "handoff" : "suggest",
      inner: m[2].trim(),
    });
  }

  const text = content.slice(0, idx).trimEnd();
  if (found.length === 0) return { text, kind: null, options: [], reason: "" };

  // A handover wins when both appear. Dropping it would leave the customer
  // waiting on a request nobody received; dropping the chips only costs them a
  // tap they can type instead.
  const chosen = found.find((f) => f.kind === "handoff") ?? found[0];

  return {
    text,
    kind: chosen.kind,
    options:
      chosen.kind === "handoff"
        ? []
        : chosen.inner
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 4),
    reason: chosen.kind === "handoff" ? chosen.inner : "",
  };
}

/**
 * What to keep in the stored transcript.
 *
 * ASK stays — it is an unanswered question and reopening the panel has to put
 * its buttons back. SUGGEST and HANDOFF are spent the moment the turn ends.
 */
export function contentForTranscript(content: string): string {
  const { text, kind } = splitMarker(content);
  return kind === "ask" ? content : text;
}
