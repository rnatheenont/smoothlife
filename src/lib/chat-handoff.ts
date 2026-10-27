/**
 * Handing a question from the storefront to น้อง Smoothie.
 *
 * Two places receive one: the corner panel (QuickChatPanel) and the
 * full-screen page (/chat). They used to seed themselves separately — the
 * page from ?q=, the panel not at all — and the rules for what to do with a
 * question that arrives with a photo attached are fiddly enough that having
 * them written twice is how they drift apart. One function, both callers.
 */

/**
 * Where a photo waits while the question travels.
 *
 * The question itself is small enough to pass in memory or in the URL; a
 * photo is not, so the sender shrinks it to the ~1024px the chat would have
 * uploaded anyway and parks the data URL here. sessionStorage so it dies with
 * the tab, and the reader removes it so a reload does not re-attach a picture
 * nobody asked for twice.
 */
export const HERO_PHOTO_KEY = "sl_hero_photo";

/** A question on its way to the chat, with or without a photo beside it. */
export type ChatHandoff = { q?: string; photo?: boolean };

type Seeder = {
  send: (text: string) => void;
  setInput: (text: string) => void;
  handleImagePick: (file: File) => void;
};

/**
 * Plays a handoff into a chat session that is ready to receive it.
 *
 * A question on its own is sent straight away — the shopper already pressed
 * send once, on the hero band, and asking them to press it again is a worse
 * answer than just asking.
 *
 * A question *with* a photo is put in the composer instead. The photo has a
 * consent prompt in front of it, so sending the text now would split one
 * message in two and leave the picture behind.
 */
export function seedChat({ q, photo }: ChatHandoff, chat: Seeder) {
  const text = q?.trim();
  let dataUrl: string | null = null;
  if (photo) {
    try {
      dataUrl = sessionStorage.getItem(HERO_PHOTO_KEY);
      sessionStorage.removeItem(HERO_PHOTO_KEY);
    } catch {
      // Storage blocked: the question still goes through on its own.
    }
  }

  if (dataUrl) {
    if (text) chat.setInput(text);
    fetch(dataUrl)
      .then((r) => r.blob())
      .then((b) => chat.handleImagePick(new File([b], "photo.jpg", { type: b.type || "image/jpeg" })))
      .catch(() => {});
    return;
  }
  if (text) chat.send(text);
}
