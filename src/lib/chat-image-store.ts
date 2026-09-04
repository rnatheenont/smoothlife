// Keeps a thumbnail of each photo sent in the chat, on the device only.
//
// The consent dialog the customer agrees to before sending a photo says, in
// as many words, that the image goes to the AI temporarily and is **not kept
// on our server**. Photos of someone's face or skin are exactly the kind of
// thing that promise should mean something, so persisting them server-side to
// make history look nicer would be breaking it for a cosmetic reason.
//
// So the thumbnail lives in localStorage next to the customer's own browser,
// the same place the skin coach already keeps its progress thumbnails. The
// trade is honest and worth stating in the UI: open the chat on a different
// phone and the history is there, but the pictures are not.

const KEY = "sl_chat_images";
const MAX = 6;

/**
 * The server prefixes a stored user message with this when it carried a photo
 * (see persistMessage in api/chat/route.ts), so restored text never matches
 * what was sent verbatim. Stripping it is what makes the re-attach work.
 */
export const PHOTO_MARKER = "[[PHOTO]] ";

const withoutMarker = (text: string) =>
  text.startsWith(PHOTO_MARKER) ? text.slice(PHOTO_MARKER.length) : text;

type Stored = { text: string; dataUrl: string; ts: number };

function read(): Stored[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored[]) : [];
  } catch {
    return [];
  }
}

function write(items: Stored[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Quota exceeded: drop the oldest half and try once. Losing an old
    // thumbnail is much better than the send failing.
    try {
      localStorage.setItem(KEY, JSON.stringify(items.slice(-Math.ceil(MAX / 2))));
    } catch {
      /* give up quietly — the photo still sends, it just won't persist */
    }
  }
}

/** Files a thumbnail against the message text it was sent with. */
export function rememberChatImage(text: string, dataUrl: string) {
  const items = read().filter((i) => i.dataUrl !== dataUrl);
  items.push({ text, dataUrl, ts: Date.now() });
  write(items.slice(-MAX));
}

/**
 * Re-attaches thumbnails to a history restored from the server, which stores
 * only role and text.
 *
 * Matching is by message text, consumed in order: two photos sent with the
 * same caption still get their own thumbnail back, in the order they were
 * sent, rather than both showing the first one.
 */
export function attachStoredImages<T extends { role: string; content: string; image?: string }>(
  messages: T[]
): T[] {
  const pool = read();
  if (pool.length === 0) return messages;
  const used = new Set<number>();

  return messages.map((m) => {
    if (m.role !== "user" || m.image) return m;
    const target = withoutMarker(m.content);
    const idx = pool.findIndex((p, i) => !used.has(i) && withoutMarker(p.text) === target);
    if (idx === -1) return m;
    used.add(idx);
    return { ...m, image: pool[idx].dataUrl };
  });
}

/** Called when the customer resets the conversation — the pictures go too. */
export function clearChatImages() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
