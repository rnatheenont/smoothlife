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
  const marker = content.slice(idx).replace(/^\n/, "");
  const inner = marker.replace(/^\[\[(SUGGEST|ASK|HANDOFF):/i, "").replace(/\]\]\s*$/, "");
  const kind = /^\[\[ASK:/i.test(marker) ? "ask" : /^\[\[HANDOFF:/i.test(marker) ? "handoff" : "suggest";
  return {
    text: content.slice(0, idx).trimEnd(),
    kind,
    // A handoff carries one sentence of context for staff, not a pipe-separated
    // list of chips, so it is deliberately not split.
    options:
      kind === "handoff"
        ? []
        : inner
            .split("|")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 4),
    reason: kind === "handoff" ? inner.trim() : "",
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
