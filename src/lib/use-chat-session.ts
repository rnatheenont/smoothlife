import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useQuickChat } from "@/lib/quickchat-context";
import { useCart } from "@/lib/cart-context";
import { useRecentlyViewed } from "@/lib/recently-viewed-context";
import { pickSuggestions, interestsFromProducts } from "@/lib/chat-suggestions";
import { getProductBySlug } from "@/data/products";
import { resizeForUpload, resizeForThumbnail, ResizedImage } from "@/lib/image-utils";
import { rememberChatImage, attachStoredImages, clearChatImages } from "@/lib/chat-image-store";
import { splitMarker, markerIndex, MARKER_OPENERS } from "@/lib/chat-markers";
import { helpChatTopics as HELP_TOPICS } from "@/data/help";
import { hasStoredConsent, grantConsent } from "@/components/skin-coach/ConsentGate";

// Everything about a Smoothie conversation that has nothing to do with where
// it's drawn — the floating widget and a future full-screen page are two
// skins over the same session, and this is that session. Splitting it out
// here means fixing the AI flow, the escalation path, or a marker bug only
// ever happens once, in one place both surfaces read from — see the plan
// this came out of (fullscreen-chat-plan.md) for why that mattered enough to
// refactor before adding the second surface.

type Product = NonNullable<ReturnType<typeof getProductBySlug>>;

export type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  image?: string;
  /** A person answered this one, not Smoothie. See from_staff in the API. */
  fromStaff?: boolean;
  /** Server timestamp, present on anything replayed from history. */
  createdAt?: string;
};

// Server history is whatever was persisted, and rows written before the server
// learned to strip [[ASK: ...]] still carry it — so clean the marker off for
// display, and hand back the last reply's options so reopening the panel
// restores the tappable answers instead of leaving dead bracket text.
const CHAT_SEEN_KEY = "sl_chat_seen_at";

function readChatSeen(): string | null {
  try {
    return localStorage.getItem(CHAT_SEEN_KEY);
  } catch {
    return null;
  }
}

function markChatSeen(latestAt: string | null | undefined) {
  try {
    localStorage.setItem(CHAT_SEEN_KEY, latestAt || new Date().toISOString());
  } catch {}
}

function countUnread(
  messages: { role: string; created_at?: string }[],
  latestAt: string | null | undefined
): number {
  const seen = readChatSeen();
  if (!seen) {
    // First time this device has checked: the history so far is not news.
    if (latestAt) markChatSeen(latestAt);
    return 0;
  }
  const seenAt = Date.parse(seen);
  return messages.filter(
    (m) => m.role === "assistant" && m.created_at && Date.parse(m.created_at) > seenAt
  ).length;
}

function hydrateHistory(
  raw: (ChatMsg & { from_staff?: boolean; created_at?: string; attachmentUrl?: string | null })[]
): { messages: ChatMsg[]; ask: string[] } {
  let ask: string[] = [];
  const messages = raw.map((m, i) => {
    // The API sends the column name; the component uses its own casing.
    const withSender: ChatMsg = {
      ...m,
      fromStaff: m.fromStaff ?? m.from_staff ?? false,
      createdAt: m.createdAt ?? m.created_at,
      // A photo staff attached. The customer's own photos are kept in the
      // browser (see chat-image-store) and attached separately below.
      image: m.image ?? m.attachmentUrl ?? undefined,
    };
    if (m.role !== "assistant") return withSender;
    const { text, kind, options } = splitMarker(m.content);
    if (kind === "ask" && i === raw.length - 1) ask = options;
    return { ...withSender, content: text || m.content };
  });
  return { messages: attachStoredImages(messages), ask };
}

// A stable per-device id for guests so their chat history/rate-limit
// tracking can be restored without requiring login — never sent for
// logged-in users, who are identified by their real session instead.
function getAnonId() {
  try {
    let id = localStorage.getItem("sl_chat_anon_id");
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("sl_chat_anon_id", id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export type ChatSessionOptions = {
  /**
   * Whether this surface is the one the customer is currently looking at —
   * the widget passes its own open/closed state; a full-screen page (which
   * has no separate open state of its own) passes true for as long as it's
   * mounted. Gates the same three things the widget always gated: whether
   * history has been restored yet, how often replies are polled for, and
   * whether arriving messages count as "seen".
   */
  active: boolean;
  /** The product page the customer is on, if any — resolved by the caller
   *  (from the URL on a normal page, or carried over some other way on a
   *  page that isn't itself a product page) rather than by this hook, so it
   *  stays usable from a route this hook knows nothing about. */
  viewingProduct?: Product;
};

export function useChatSession({ active, viewingProduct }: ChatSessionOptions) {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const { profile } = useQuickChat();
  const { lines: cartLines } = useCart();
  const { slugs: recentSlugs } = useRecentlyViewed();

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<ResizedImage | null>(null);
  const [awaitingConsentImage, setAwaitingConsentImage] = useState<ResizedImage | null>(null);
  const [imageConsent, setImageConsent] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [followups, setFollowups] = useState<string[]>([]);
  // Tappable answer options for a qualifying question Smoothie asks before
  // recommending (see [[ASK: ...]] in route.ts) — distinct from `followups`
  // (optional extra suggestions, deliberately shown only every other turn)
  // since these are the actual pending question's answers and must always
  // show up, whichever turn they land on.
  const [askOptions, setAskOptions] = useState<string[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [restoringHistory, setRestoringHistory] = useState(false);
  // Thumbnail of the photo being sent, held from pick until send.
  const thumbRef = useRef<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  /** Stops a second automatic handoff in the same thread. */
  const handedOff = useRef(false);
  const [escalateMsg, setEscalateMsg] = useState<string | null>(null);
  // Leaving a message is a compose step, not a one-tap send: the team needs
  // to know what the customer actually wants, and a bare transcript makes
  // them guess it from a conversation they weren't part of.
  const [humanHandling, setHumanHandling] = useState(false);
  /** A case already queued and waiting — survives a reload, unlike handedOff. */
  const [caseQueued, setCaseQueued] = useState(false);
  /** The help chips are showing, so offer the way to a person alongside them. */
  const [helpOpen, setHelpOpen] = useState(false);
  /**
   * Timestamp of the newest message the server had last time we looked.
   *
   * The panel used to adopt the server copy only when it was longer than the
   * local one, which quietly stopped working at the forty-message cap: both
   * sides sat at forty and a staff reply could never get in. Time only moves
   * forward, and a message the customer has just sent is not on the server
   * yet, so this both notices new replies and keeps the send race safe.
   */
  const latestAtRef = useRef<string | null>(null);
  // Storing a photo on our server is a different promise from showing it to
  // the model, so it needs its own answer. Someone who agreed to "sent to the
  // AI, never stored" has not agreed to this.
  const [storageConsent, setStorageConsent] = useState(false);
  useEffect(() => {
    try {
      setStorageConsent(localStorage.getItem("sl_chat_storage_consent") === "1");
    } catch {}
  }, []);
  const [unread, setUnread] = useState(0);
  const [backToAiBusy, setBackToAiBusy] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");

  // Only surface follow-up suggestion chips every other assistant reply so
  // they help re-engage the chat without showing up after literally every
  // message, which reads as spammy/annoying.
  const assistantTurnCount = useRef(0);

  useEffect(() => {
    setImageConsent(hasStoredConsent());
  }, []);

  // Restore recent conversation once, the first time this surface becomes
  // active — lets the customer pick up where they left off after closing
  // the tab (or, for the widget, the panel).
  useEffect(() => {
    if (!active || historyLoaded) return;
    setHistoryLoaded(true);
    setRestoringHistory(true);
    const anonId = user ? undefined : getAnonId();
    const qs = anonId ? `?anonId=${encodeURIComponent(anonId)}` : "";
    fetch(`/api/chat${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.messages) && data.messages.length) {
          const { messages, ask } = hydrateHistory(data.messages);
          setMessages(messages);
          setAskOptions(ask);
          latestAtRef.current = data.latestAt ?? null;
          markChatSeen(data.latestAt);
        }
        setHumanHandling(Boolean(data?.humanHandling));
        setCaseQueued(Boolean(data?.caseQueued));
      })
      .catch((err) => console.error("[chat-session] history restore failed", err))
      .finally(() => setRestoringHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Polls for replies. Staff answer from the inbox, and those replies land in
  // the same history this reads — without polling the customer only sees
  // them by reloading the page, which is exactly when they have given up.
  //
  // Also runs while inactive, more slowly: that is the case the unread count
  // exists for.
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      if (document.hidden) return;
      try {
        const anonId = user ? undefined : getAnonId();
        const qs = anonId ? `?anonId=${encodeURIComponent(anonId)}` : "";
        const data = await fetch(`/api/chat${qs}`).then((r) => r.json());
        if (cancelled || !Array.isArray(data?.messages)) return;
        setHumanHandling(Boolean(data.humanHandling));
        setCaseQueued(Boolean(data.caseQueued));
        if (active) {
          // Only ever grows the thread. The server copy is written a moment
          // after the message is shown, so a poll landing in that gap used to
          // replace the list with a shorter one and the customer watched their
          // own message vanish. Never overwrite a reply still streaming in
          // either.
          if (!loading) {
            const moved = data.latestAt && data.latestAt !== latestAtRef.current;
            if (moved) {
              latestAtRef.current = data.latestAt;
              setMessages(hydrateHistory(data.messages).messages);
            }
            markChatSeen(data.latestAt);
            setUnread(0);
          }
        } else {
          setUnread(countUnread(data.messages, data.latestAt));
        }
      } catch {
        // A failed poll is not worth telling the customer about; the next one
        // is a few seconds away.
      }
    }
    const every = active ? 5000 : 30000;
    const id = window.setInterval(poll, every);
    // Check straight away for anyone who has chatted before, so a reply that
    // came while they were gone shows on arrival rather than 30 s later.
    // Everyone else has nothing to be told about yet.
    if (!active && (user || readChatSeen())) void poll();
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, loading, user]);

  // Becoming the active surface is the customer reading what arrived.
  useEffect(() => {
    if (active) {
      setUnread(0);
      markChatSeen(latestAtRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const [resolvingCase, setResolvingCase] = useState(false);

  /**
   * Smoothie answered something simple in full and offered to close it.
   *
   * Left as an offer rather than done silently: she is right often enough to
   * ask, and wrong often enough that closing without the customer saying so
   * would file "still waiting for my parcel" as solved. Whichever button they
   * press is a real answer — the other path hands it straight to a person.
   */
  const [closeOffer, setCloseOffer] = useState(false);

  // Offered when the conversation has gone quiet after a staff reply — not the
  // instant one lands. Staff had just asked for an order number and the panel
  // was already offering "this is sorted" underneath it, which is a strange
  // thing to be asked while someone is waiting for you to answer them.
  const lastMessage = messages[messages.length - 1];
  const caseLooksSettled =
    humanHandling &&
    Boolean(lastMessage?.fromStaff) &&
    Boolean(lastMessage?.createdAt) &&
    Date.now() - new Date(lastMessage!.createdAt!).getTime() > 10 * 60 * 1000;

  async function resolveCase() {
    setResolvingCase(true);
    try {
      await fetch("/api/chat/resolve-case", { method: "POST" });
      setHumanHandling(false);
      setCaseQueued(false);
      handedOff.current = false;
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: t(
            "ดีใจที่ช่วยได้นะคะ ปิดเรื่องนี้ให้แล้วค่ะ — มีอะไรอีกทักมาได้เลยนะคะ 😊",
            "Glad that helped — this one's closed. Message us any time."
          ),
        },
      ]);
    } finally {
      setResolvingCase(false);
    }
  }

  async function backToAi() {
    setBackToAiBusy(true);
    try {
      const res = await fetch("/api/chat/back-to-ai", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setHumanHandling(false);
        setEscalateMsg(
          t(
            "กลับมาคุยกับน้อง Smoothie แล้วค่ะ ถามต่อได้เลย — เรื่องที่ฝากไว้ทีมงานยังดูให้อยู่นะคะ",
            "You're back with Smoothie — ask away. The team is still on your earlier request."
          )
        );
      }
    } catch {
      /* leave the panel as it was */
    } finally {
      setBackToAiBusy(false);
    }
  }

  // Tapping "ศูนย์ช่วยเหลือ" used to close the panel and navigate to /help,
  // which abandons the conversation to go and read a page. Offer the same
  // subjects as chips instead: each one sends the customer's question into
  // this thread, so the answer arrives here — and a subject Smoothie cannot
  // settle takes the same route to a person that a typed question does.
  function openHelpTopics() {
    setNoteOpen(false);
    setFollowups([]);
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: t(
          "ยินดีช่วยค่ะ อยากทราบเรื่องไหนดีคะ — หรือพิมพ์คำถามมาได้เลย ถ้าเรื่องไหนฉันตอบไม่ได้ จะส่งต่อให้แอดมินนะคะ",
          "Happy to help — which would you like to know about? Or just type your question; anything I can't settle I'll pass to our team."
        ),
      },
    ]);
    setAskOptions(HELP_TOPICS);
    setHelpOpen(true);
  }

  async function escalate(customerNote: string) {
    if (!user) {
      setEscalateMsg(t("กรุณาเข้าสู่ระบบก่อน เพื่อให้ทีมงานติดต่อกลับได้ค่ะ", "Please sign in first so our team can contact you back."));
      return;
    }
    setEscalating(true);
    setEscalateMsg(null);
    try {
      const transcript = messages.map((m) => `${m.role === "user" ? "ลูกค้า" : "Smoothie"}: ${m.content}`).join("\n");
      const res = await fetch("/api/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, note: customerNote }),
      });
      const data = await res.json();
      if (!data.ok) {
        handedOff.current = false;
        setEscalateMsg(data.error || t("ส่งไม่สำเร็จ กรุณาลองใหม่ค่ะ", "Couldn't send — please try again."));
      } else {
        setNoteOpen(false);
        setNote("");
        setEscalateMsg(
          data.contactValue
            ? t(
                `ส่งถึงทีมงานแล้วค่ะ ทีมงานจะติดต่อกลับที่ ${data.contactValue} ภายใน 1 วันทำการค่ะ — ระหว่างรอ ถามน้อง Smoothie เรื่องอื่นต่อได้เลยนะคะ`,
                `Sent to our team — they'll reach you at ${data.contactValue} within 1 business day. Meanwhile, keep asking Smoothie anything else.`
              )
            : t("ส่งถึงทีมงานแล้วค่ะ แต่ยังไม่มีช่องทางติดต่อกลับในโปรไฟล์ — กรุณาเพิ่มเบอร์โทรหรืออีเมลในบัญชีค่ะ", "Sent to our team, but no contact method is on file — please add a phone or email to your account.")
        );
      }
    } catch {
      // Smoothie has already told them it is on its way, so a silent failure
      // here leaves someone waiting for a reply nobody will write.
      handedOff.current = false;
      setEscalateMsg(
        t(
          "ส่งถึงทีมงานไม่สำเร็จ กรุณากด \"ฝากข้อความ\" ด้านล่างอีกครั้งค่ะ",
          "Couldn't reach our team — please use \"Leave a message\" below to try again."
        )
      );
    } finally {
      setEscalating(false);
    }
  }

  const hasProfile = Object.keys(profile || {}).length > 0;

  // Bumped whenever this surface becomes active, so the starter questions
  // move on rather than presenting the same four a customer has already
  // declined. Kept in state rather than derived from the clock so the server
  // and client agree during hydration.
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  useEffect(() => {
    if (active) setSuggestionSeed((n) => n + 1);
  }, [active]);

  const suggestions = useMemo(() => {
    // What they've been looking at, nearest first: the product page they're on
    // now, then the cart, then recently viewed.
    const seen = [
      viewingProduct,
      ...cartLines.map((l) => getProductBySlug(l.slug)),
      ...recentSlugs.map((slug) => getProductBySlug(slug)),
    ].filter((p): p is NonNullable<typeof p> => Boolean(p));
    const { categories, concerns } = interestsFromProducts(seen);
    return pickSuggestions({ lang, categories, concerns, seed: suggestionSeed });
  }, [lang, viewingProduct, cartLines, recentSlugs, suggestionSeed]);

  async function handleImagePick(file: File) {
    setImageError(null);
    try {
      // Two sizes: the big one goes to the model and is never stored, the
      // ~160px one is what gets kept on the device for the history.
      const [resized, thumb] = await Promise.all([resizeForUpload(file), resizeForThumbnail(file)]);
      thumbRef.current = thumb.dataUrl;
      // Consent given for the AI path does not carry over to the staff path,
      // where the photo is stored on our server — so ask again the first time.
      const needsAsking = humanHandling ? !storageConsent : !imageConsent;
      if (!needsAsking) {
        setPendingImage(resized);
      } else {
        setAwaitingConsentImage(resized);
      }
    } catch {
      setImageError(t("ไม่สามารถอ่านรูปนี้ได้ กรุณาลองใหม่อีกครั้ง", "Couldn't read that photo, please try again."));
    }
  }

  function confirmImageConsent() {
    grantConsent();
    setImageConsent(true);
    // Answering the staff-storage question also records that separate consent.
    if (humanHandling) {
      setStorageConsent(true);
      try {
        localStorage.setItem("sl_chat_storage_consent", "1");
      } catch {}
    }
    if (awaitingConsentImage) setPendingImage(awaitingConsentImage);
    setAwaitingConsentImage(null);
  }

  async function send(text: string, image?: ResizedImage | null) {
    const clean = text.trim();
    if ((!clean && !image) || loading) return;
    // The offer belongs to the turn that made it; a new question replaces it.
    setCloseOffer(false);

    // A photo sent while staff are handling the case goes to them, not to the
    // model — uploaded so they can actually see it, which is the whole reason
    // the second consent exists. The AI is not asked to answer it.
    if (image && humanHandling) {
      const body = new FormData();
      const blob = await (await fetch(image.dataUrl)).blob();
      body.append("image", new File([blob], "photo.jpg", { type: "image/jpeg" }));
      body.append("caption", clean);
      setMessages((m) => [...m, { role: "user", content: clean || "(ส่งรูป)", image: image.dataUrl }]);
      if (thumbRef.current) {
        rememberChatImage(clean || "(ส่งรูป)", thumbRef.current);
        thumbRef.current = null;
      }
      setInput("");
      setPendingImage(null);
      try {
        const res = await fetch("/api/chat/attachment", { method: "POST", body });
        const data = await res.json();
        if (!data.ok) setImageError(data.error || t("ส่งรูปไม่สำเร็จ", "Couldn't send the photo"));
      } catch {
        setImageError(t("ส่งรูปไม่สำเร็จ", "Couldn't send the photo"));
      }
      return;
    }

    // A photo with no caption needs *something* for the model to answer, but
    // only when the model is answering. Putting words in a customer's mouth to
    // a member of staff is worse than an empty caption — they never asked what
    // the product was.
    const fallbackText = humanHandling
      ? lang === "en"
        ? "(photo)"
        : "(ส่งรูป)"
      : lang === "en"
        ? "What product is this? Do you carry it?"
        : "รูปนี้คือสินค้าอะไรครับ มีขายไหม";
    const userMsg: ChatMsg = { role: "user", content: clean || fallbackText, image: image?.dataUrl };
    // Filed against the message text, which is what the server history gives
    // us back later — see chat-image-store.ts for why this stays on-device.
    if (image && thumbRef.current) {
      rememberChatImage(userMsg.content, thumbRef.current);
      thumbRef.current = null;
    }
    const next: ChatMsg[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPendingImage(null);
    setFollowups([]);
    setAskOptions([]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          profile,
          lang,
          anonId: user ? undefined : getAnonId(),
          cart: cartLines.map((l) => ({ name: l.name, size: l.size, qty: l.qty, price: l.price })),
          viewingProduct: viewingProduct
            ? {
                slug: viewingProduct.slug,
                name: viewingProduct.name,
                brand: viewingProduct.brand,
                price: viewingProduct.price,
                compareAtPrice: viewingProduct.compareAtPrice,
                category: viewingProduct.category,
                concerns: viewingProduct.concerns,
                benefits: viewingProduct.benefits,
                howToUse: viewingProduct.howToUse,
                ingredients: viewingProduct.ingredients,
                whoFor: viewingProduct.whoFor,
                sizes: viewingProduct.variants.map((v) => ({ size: v.size, price: v.price })),
              }
            : undefined,
          image: image ? { base64: image.base64, mediaType: image.mediaType } : undefined,
        }),
      });
      if (!res.body) throw new Error("no response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // Network chunks arrive in bursts (a handful of tokens at a time),
      // which reads as jumpy if painted directly. Decouple painting from
      // network timing: accumulate the full text as it arrives, and reveal
      // it to the UI a few characters at a time on a steady clock instead —
      // a smooth, constant-speed typewriter regardless of chunk burstiness.
      let full = "";
      let shown = 0;
      let netDone = false;
      const CHARS_PER_TICK = 3;
      const TICK_MS = 16;
      // The model may tack on a trailing "[[SUGGEST: ...]]" or "[[ASK: ...]]"
      // marker (see route.ts) that must never flash on screen as raw bracket
      // text — the two are mutually exclusive per reply (SUGGEST for
      // optional follow-ups, ASK for a qualifying question's answer
      // options). The instant either literal opener shows up anywhere in
      // the accumulated text, freeze the reveal boundary right before it
      // and never advance past it — everything from there on is the marker
      // (it's always last), regardless of how much more streams in after.
      const MAX_OPENER_LEN = Math.max(...MARKER_OPENERS.map((m) => m.length));
      const markerOpenIndex = () => markerIndex(full);
      function visibleTarget() {
        const idx = markerOpenIndex();
        if (idx !== -1) return idx;
        if (netDone) return full.length;
        // marker hasn't started (or hasn't fully arrived) yet — hold back a
        // small safety margin in case an opener is split across chunks
        return Math.max(0, full.length - MAX_OPENER_LEN);
      }

      async function readNetwork() {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
        }
        netDone = true;
      }

      async function revealLoop() {
        while (shown < visibleTarget() || !netDone) {
          const target = visibleTarget();
          if (shown < target) {
            shown = Math.min(target, shown + CHARS_PER_TICK);
            setMessages([...next, { role: "assistant", content: full.slice(0, shown) }]);
          }
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
      }

      await Promise.all([readNetwork(), revealLoop()]);

      const cutIdx = markerOpenIndex();
      const finalText = cutIdx !== -1 ? full.slice(0, cutIdx).trimEnd() : full;
      setMessages([...next, { role: "assistant", content: finalText || "…" }]);

      assistantTurnCount.current += 1;
      const { kind, options: parsed, reason } = splitMarker(full);
      const isAsk = kind === "ask";

      // Smoothie decided this needs a person. She has already said so in the
      // reply above, so file it rather than asking the customer to press a
      // button confirming what she just told them. Once per conversation: the
      // guard is here because a second ticket for the same thread is noise in
      // the inbox, not extra help.
      // handedOff only lives as long as the component; caseQueued comes from
      // the server, so a reload cannot turn one unanswered request into two.
      if (kind === "handoff" && !humanHandling && !caseQueued && !handedOff.current) {
        handedOff.current = true;
        void escalate(reason || t("ลูกค้าต้องการคุยกับแอดมิน", "Customer asked for a person"));
      }
      // Never offered while a person is on the thread: closing is theirs to
      // judge then, and two sources of "this is finished" is one too many.
      setCloseOffer(kind === "close" && !humanHandling && !caseQueued);
      if (isAsk) {
        // The AI's actual pending question — always show it, whichever turn.
        setAskOptions(parsed);
        setFollowups([]);
      } else {
        setAskOptions([]);
        // odd turns only (1st, 3rd, 5th assistant reply...) — every other one
        setFollowups(parsed.length && assistantTurnCount.current % 2 === 1 ? parsed : []);
      }
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            lang === "en"
              ? "Sorry, I couldn't connect. Please try again."
              : "ขออภัยค่ะ เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // Starts a brand new conversation — clears the on-device photo cache with
  // it, since leaving someone's face in storage after they asked to start
  // over would be the wrong default.
  function reset() {
    setMessages([]);
    setFollowups([]);
    setAskOptions([]);
    setEscalateMsg(null);
    assistantTurnCount.current = 0;
    clearChatImages();
  }

  return {
    // conversation
    messages,
    input,
    setInput,
    loading,
    send,
    reset,
    restoringHistory,
    historyLoaded,
    unread,
    suggestions,
    hasProfile,
    // photos
    pendingImage,
    setPendingImage,
    awaitingConsentImage,
    setAwaitingConsentImage,
    imageError,
    handleImagePick,
    confirmImageConsent,
    // pending answers
    followups,
    setFollowups,
    askOptions,
    setAskOptions,
    closeOffer,
    setCloseOffer,
    caseLooksSettled,
    // human handoff
    humanHandling,
    caseQueued,
    escalating,
    escalateMsg,
    setEscalateMsg,
    escalate,
    resolveCase,
    resolvingCase,
    backToAi,
    backToAiBusy,
    helpOpen,
    setHelpOpen,
    openHelpTopics,
    noteOpen,
    setNoteOpen,
    note,
    setNote,
  };
}
