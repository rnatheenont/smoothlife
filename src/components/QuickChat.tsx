"use client";

import { useEffect, useLayoutEffect, useRef, useState, ReactNode, PointerEvent as ReactPointerEvent, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Send, Loader2, RotateCcw, User as UserIcon, X, Plus, Check, Camera, ImagePlus, MessageCircleQuestion, Headset } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useQuickChat } from "@/lib/quickchat-context";
import { useCart } from "@/lib/cart-context";
import { useRecentlyViewed } from "@/lib/recently-viewed-context";
import { pickSuggestions, interestsFromProducts } from "@/lib/chat-suggestions";
import { getProductBySlug } from "@/data/products";
import { formatTHB } from "@/lib/format";
import { resizeForUpload, resizeForThumbnail, ResizedImage } from "@/lib/image-utils";
import { rememberChatImage, attachStoredImages, clearChatImages, PHOTO_MARKER } from "@/lib/chat-image-store";
import { hasStoredConsent, grantConsent } from "@/components/skin-coach/ConsentGate";
import { Button } from "@/components/ui";

type Msg = { role: "user" | "assistant"; content: string; image?: string };

// Rotates through the launcher badge so a first-time visitor sees both of
// its jobs (product help + skin advice) without the badge ever growing a
// paragraph — kept deliberately close in length so the pill never resizes
// as it cycles. Opens on the brand name, then alternates the two themes.
const CHAT_BADGE_PHRASES: [string, string][] = [
  ["ปรึกษาน้อง Smoothie", "Ask Smoothie"],
  ["หาสินค้าที่ใช่ให้คุณ", "Find your product"],
  ["กังวลเรื่องผิวไหม ถามได้", "Skin concerns? Ask away"],
  ["คุยกับน้อง Smoothie", "Chat with Smoothie"],
  ["แนะนำสินค้าให้เลย", "Get recommendations"],
  ["ปรึกษาปัญหาผิวฟรี", "Free skin advice"],
];
const CHAT_BADGE_INTERVAL_MS = 11000;
const CHAT_BADGE_FADE_MS = 175;

// Matches the [[slug]] markers the model is told to use, but also tolerates
// a stray single-bracket [slug] (models occasionally drop a bracket) and
// bare /product/slug links, so a product card still renders instead of
// leaking raw marker text into the chat bubble.
const MARKER = /\[\[([a-z0-9-]+)\]\]|\[([a-z0-9]+(?:-[a-z0-9]+)+)\]|\/product\/([a-z0-9-]+)/gi;

// Lightweight markdown-bold support (**text**) so an occasional ** from the
// model renders as bold instead of showing the literal asterisks — the chat
// bubble is plain whitespace-pre-wrap text, not a markdown renderer.
const BOLD = /\*\*(.+?)\*\*/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let bm: RegExpExecArray | null;
  BOLD.lastIndex = 0;
  let k = 0;
  while ((bm = BOLD.exec(text))) {
    if (bm.index > last) parts.push(text.slice(last, bm.index));
    parts.push(<strong key={`${keyPrefix}b${k++}`}>{bm[1]}</strong>);
    last = bm.index + bm[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function ProductChip({ slug }: { slug: string }) {
  const product = getProductBySlug(slug);
  const { addItem } = useCart();
  const { t } = useLang();
  const [added, setAdded] = useState(false);
  if (!product) return null;

  return (
    <div className="my-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <Link href={`/product/${product.slug}`} className="shrink-0 relative h-14 w-14 block">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="rounded-lg object-cover bg-surface-soft"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/product/${product.slug}`}
          className="block text-[12px] font-semibold leading-snug text-brand-ink line-clamp-2 hover:text-brand-emerald"
        >
          {product.name}
        </Link>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[12px] font-bold text-brand-emerald">{formatTHB(product.price)}</span>
          {product.compareAtPrice ? (
            <span className="text-[10px] text-slate-400 line-through">{formatTHB(product.compareAtPrice)}</span>
          ) : null}
        </div>
      </div>
      <button
        onClick={() => {
          addItem(product.slug, 1);
          setAdded(true);
        }}
        aria-label={t("เพิ่มลงตะกร้า", "Add to cart")}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition-colors ${
          added ? "bg-slate-300" : "bg-brand-gradient"
        }`}
      >
        {added ? <Check size={15} /> : <Plus size={15} />}
      </button>
    </div>
  );
}

// Breaks a plain-text segment into paragraph/list blocks so a long reply
// reads as scannable chunks instead of one dense wall of text — consecutive
// "- " lines become a real bulleted list (dot marker, own line), everything
// else stays grouped into paragraphs separated by blank lines.
function renderTextBlock(text: string, keyPrefix: string): ReactNode[] {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }
    if (lines[i].trimStart().startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith("- ")) {
        items.push(lines[i].trimStart().slice(2));
        i++;
      }
      blocks.push(
        <ul key={`${keyPrefix}ul${blockKey}`} className="my-1.5 flex flex-col gap-1.5">
          {items.map((it, idx) => (
            <li key={idx} className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-emerald" />
              <span>{renderInline(it, `${keyPrefix}uli${blockKey}-${idx}`)}</span>
            </li>
          ))}
        </ul>
      );
      blockKey++;
    } else {
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].trimStart().startsWith("- ")) {
        paraLines.push(lines[i]);
        i++;
      }
      blocks.push(
        <p key={`${keyPrefix}p${blockKey}`} className="my-1.5 first:mt-0 last:mb-0">
          {renderInline(paraLines.join("\n"), `${keyPrefix}p${blockKey}`)}
        </p>
      );
      blockKey++;
    }
  }
  return blocks;
}

function renderContent(text: string) {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MARKER.lastIndex = 0;
  let key = 0;
  while ((m = MARKER.exec(text))) {
    // ProductChip already carries its own top/bottom margin, so any blank
    // lines the model left right next to a marker would double up the gap —
    // trim newline runs at both ends of each text segment, not just one.
    const before = text.slice(last, m.index).replace(/^\n+|\n+$/g, "");
    if (before) out.push(...renderTextBlock(before, `t${key++}-`));
    out.push(<ProductChip key={`p${key++}`} slug={m[1] || m[2] || m[3]} />);
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).replace(/^\n+/, "");
  if (tail) out.push(...renderTextBlock(tail, `t${key++}-`));
  return out;
}

export default function QuickChat() {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const { open, setOpen, profile, stickyBarVisible } = useQuickChat();
  const { lines: cartLines } = useCart();
  const { slugs: recentSlugs } = useRecentlyViewed();
  const pathname = usePathname();
  const viewingSlug = pathname?.match(/^\/product\/([a-z0-9-]+)/i)?.[1];
  const viewingProduct = viewingSlug ? getProductBySlug(viewingSlug) : undefined;
  const [messages, setMessages] = useState<Msg[]>([]);
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
  const scrolledOnceRef = useRef(false);
  // Thumbnail of the photo being sent, held from pick until send.
  const thumbRef = useRef<string | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [escalateMsg, setEscalateMsg] = useState<string | null>(null);
  const [badgeIndex, setBadgeIndex] = useState(0);
  const [badgeFading, setBadgeFading] = useState(false);
  // The badge is wider than the round launcher icon, so it must extend
  // whichever way stays on-screen — anchored to the icon's right edge
  // (extending left) normally, but flipped to the icon's left edge
  // (extending right) once the launcher is dragged and snapped to the
  // left side, or it clips off that edge the same way it did on the right.
  const [snapSide, setSnapSide] = useState<"left" | "right">("right");
  const badgeIconRef = useRef<HTMLSpanElement>(null);
  const badgeBubbleRef = useRef<HTMLSpanElement>(null);
  const [tailLeft, setTailLeft] = useState(16);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Lets the launcher bubble be dragged to wherever's convenient (it can sit
  // over content on some pages). Offset is relative to its default
  // bottom-right anchor; a drag that moves less than DRAG_THRESHOLD is
  // still treated as a tap that opens/closes the chat.
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  // Only while actively dragging do we want the position to track the
  // pointer with zero lag — the snap-to-edge and snap-home moves right
  // below both want a smooth animated transition instead.
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ dragging: false, moved: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const DRAG_THRESHOLD = 6;
  const EDGE_MARGIN = 8;

  // Reads the container's actual current position/size instead of
  // hardcoding its CSS anchor offsets (right-4/right-5, bottom-[...], the
  // button's own responsive h-16/h-24 size) — those went stale the moment
  // any of that CSS changed, which is exactly what silently broke the
  // edge-snap before (it always overshot past the left edge by ~12px
  // because the bounds math assumed a 0 right-offset that was never true).
  // dragPos is subtracted out of the measured rect to recover the
  // untransformed base position the bounds are relative to.
  function dragBounds() {
    if (typeof window === "undefined" || !containerRef.current) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const baseLeft = rect.left - dragPos.x;
    const baseTop = rect.top - dragPos.y;
    return {
      minX: EDGE_MARGIN - baseLeft,
      maxX: window.innerWidth - EDGE_MARGIN - rect.width - baseLeft,
      minY: EDGE_MARGIN - baseTop,
      maxY: window.innerHeight - EDGE_MARGIN - rect.height - baseTop,
    };
  }
  function clampDragPos(x: number, y: number) {
    const { minX, maxX, minY, maxY } = dragBounds();
    return { x: Math.min(maxX, Math.max(minX, x)), y: Math.min(maxY, Math.max(minY, y)) };
  }

  function handleLauncherPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some input sources (or synthetic events) can't be captured — the
      // drag/move handlers below still work fine without it.
    }
    setIsDragging(true);
    dragState.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, baseX: dragPos.x, baseY: dragPos.y };
  }
  function handleLauncherPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragState.current.moved = true;
    setDragPos(clampDragPos(dragState.current.baseX + dx, dragState.current.baseY + dy));
  }
  function handleLauncherPointerUp() {
    const wasRealDrag = dragState.current.dragging && dragState.current.moved;
    dragState.current.dragging = false;
    setIsDragging(false);
    // A drag that actually moved the bubble (as opposed to a plain tap)
    // settles against whichever side of the screen it's now closer to,
    // like a normal floating chat bubble, instead of floating mid-screen.
    if (wasRealDrag) {
      setDragPos((pos) => {
        const { minX, maxX } = dragBounds();
        const rect = containerRef.current?.getBoundingClientRect();
        const centerX = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
        const snappedLeft = centerX < window.innerWidth / 2;
        setSnapSide(snappedLeft ? "left" : "right");
        return { x: snappedLeft ? minX : maxX, y: pos.y };
      });
    }
  }
  // A tap needs to still open/close the chat — pointerup alone isn't a
  // reliable "was this a tap" signal across every input source, so the
  // actual toggle happens on the click that the browser synthesizes right
  // after pointerup, gated on whether that same gesture crossed the drag
  // threshold above.
  function handleLauncherClick() {
    if (dragState.current.moved) {
      dragState.current.moved = false;
      return;
    }
    // Opening the chat always returns the bubble home first — otherwise the
    // close ("X") button could end up stranded wherever it was last dragged,
    // far from the chat panel it's meant to sit next to.
    if (!open) setDragPos({ x: 0, y: 0 });
    setOpen(!open);
  }
  // Only surface follow-up suggestion chips every other assistant reply so
  // they help re-engage the chat without showing up after literally every
  // message, which reads as spammy/annoying.
  const assistantTurnCount = useRef(0);

  useEffect(() => {
    setImageConsent(hasStoredConsent());
  }, []);

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

  // Restore recent conversation once, the first time the panel is opened —
  // lets the customer pick up where they left off after closing the tab.
  useEffect(() => {
    if (!open || historyLoaded) return;
    setHistoryLoaded(true);
    setRestoringHistory(true);
    const anonId = user ? undefined : getAnonId();
    const qs = anonId ? `?anonId=${encodeURIComponent(anonId)}` : "";
    fetch(`/api/chat${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.messages) && data.messages.length) {
          setMessages(attachStoredImages(data.messages as Msg[]));
        }
      })
      .catch((err) => console.error("[QuickChat] history restore failed", err))
      .finally(() => setRestoringHistory(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function escalate() {
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
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      if (!data.ok) {
        setEscalateMsg(data.error || t("ส่งไม่สำเร็จ กรุณาลองใหม่ค่ะ", "Couldn't send — please try again."));
      } else {
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
      setEscalateMsg(t("ส่งไม่สำเร็จ กรุณาลองใหม่ค่ะ", "Couldn't send — please try again."));
    } finally {
      setEscalating(false);
    }
  }

  const hasProfile = Object.keys(profile || {}).length > 0;

  // Bumped on each open so the starter questions move on rather than
  // presenting the same four a customer has already declined. Kept in state
  // rather than derived from the clock so the server and client agree during
  // hydration.
  const [suggestionSeed, setSuggestionSeed] = useState(0);
  useEffect(() => {
    if (open) setSuggestionSeed((n) => n + 1);
  }, [open]);

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

  // The first scroll after opening (which lands on a just-restored history)
  // should jump straight to the latest message — animating a smooth scroll
  // through the whole conversation on every open reads as slow and, worse,
  // makes it look like the chat starts empty before "catching up". Only
  // messages that arrive while the panel is already open (a new reply
  // streaming in) get the smooth animation.
  useEffect(() => {
    if (!open) {
      scrolledOnceRef.current = false;
      return;
    }
    // `historyLoaded` only flips to true (together with `restoringHistory`)
    // inside the restore effect below — on the very first render right
    // after `open` becomes true, both are still at their pre-fetch values,
    // so `restoringHistory` alone doesn't catch this pass. Without the
    // `!historyLoaded` check here too, this effect fires once on the
    // still-empty container, "using up" the instant jump — leaving the
    // real restored history to animate in with a smooth scroll instead.
    if (!historyLoaded || restoringHistory) return;
    const behavior = scrolledOnceRef.current ? "smooth" : "auto";
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior });
    scrolledOnceRef.current = true;
  }, [messages, loading, open, restoringHistory, historyLoaded]);

  async function handleImagePick(file: File) {
    setImageError(null);
    try {
      // Two sizes: the big one goes to the model and is never stored, the
      // ~160px one is what gets kept on the device for the history.
      const [resized, thumb] = await Promise.all([resizeForUpload(file), resizeForThumbnail(file)]);
      thumbRef.current = thumb.dataUrl;
      if (imageConsent) {
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
    if (awaitingConsentImage) setPendingImage(awaitingConsentImage);
    setAwaitingConsentImage(null);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  async function send(text: string, image?: ResizedImage | null) {
    const clean = text.trim();
    if ((!clean && !image) || loading) return;
    const fallbackText = lang === "en" ? "What product is this? Do you carry it?" : "รูปนี้คือสินค้าอะไรครับ มีขายไหม";
    const userMsg: Msg = { role: "user", content: clean || fallbackText, image: image?.dataUrl };
    // Filed against the message text, which is what the server history gives
    // us back later — see chat-image-store.ts for why this stays on-device.
    if (image && thumbRef.current) {
      rememberChatImage(userMsg.content, thumbRef.current);
      thumbRef.current = null;
    }
    const next: Msg[] = [...messages, userMsg];
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
      const MARKER_OPENERS = ["[[SUGGEST:", "[[ASK:"];
      const MAX_OPENER_LEN = Math.max(...MARKER_OPENERS.map((m) => m.length));
      function markerOpenIndex() {
        for (const opener of MARKER_OPENERS) {
          const idx = full.indexOf(opener);
          if (idx !== -1) return full[idx - 1] === "\n" ? idx - 1 : idx;
        }
        return -1;
      }
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
      const markerText = cutIdx !== -1 ? full.slice(cutIdx).replace(/^\n/, "") : "";
      const isAsk = /^\[\[ASK:/i.test(markerText);
      let parsed: string[] = [];
      if (cutIdx !== -1) {
        const inner = markerText.replace(/^\[\[(SUGGEST|ASK):/i, "").replace(/\]\]\s*$/, "");
        parsed = inner
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 4);
      }
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

  useEffect(() => {
    const interval = setInterval(() => {
      setBadgeFading(true);
      setTimeout(() => {
        setBadgeIndex((i) => (i + 1) % CHAT_BADGE_PHRASES.length);
        setBadgeFading(false);
      }, CHAT_BADGE_FADE_MS);
    }, CHAT_BADGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Points the tail at the mascot's actual center instead of a hardcoded
  // offset — a fixed pixel guess drifted badly between the 64px mobile
  // icon and 96px desktop icon (and between phrases of slightly different
  // width), landing nowhere near the mascot's head. Recomputed whenever
  // the phrase, snap side, or viewport size changes.
  useLayoutEffect(() => {
    function updateTailPosition() {
      const icon = badgeIconRef.current;
      const bubble = badgeBubbleRef.current;
      if (!icon || !bubble) return;
      const iconRect = icon.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const TAIL_SIZE = 12;
      const iconCenterX = iconRect.left + iconRect.width / 2;
      setTailLeft(iconCenterX - bubbleRect.left - TAIL_SIZE / 2);
    }
    updateTailPosition();
    window.addEventListener("resize", updateTailPosition);
    return () => window.removeEventListener("resize", updateTailPosition);
  }, [badgeIndex, snapSide]);

  return (
    <>
      <div
        ref={containerRef}
        className={`fixed ${
          stickyBarVisible
            ? "bottom-[calc(120px+env(safe-area-inset-bottom))]"
            : "bottom-[calc(60px+env(safe-area-inset-bottom))]"
        } lg:bottom-3 right-4 lg:right-5 z-[80] inline-flex transition-[bottom]`}
        style={{
          transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <button
          onPointerDown={handleLauncherPointerDown}
          onPointerMove={handleLauncherPointerMove}
          onPointerUp={handleLauncherPointerUp}
          onPointerCancel={handleLauncherPointerUp}
          onClick={handleLauncherClick}
          aria-label={t("คุยกับน้อง Smoothie", "Chat with Smoothie")}
          className={`relative flex items-center justify-center rounded-full text-white transition-[transform,background-color,box-shadow] hover:scale-105 active:scale-95 touch-none select-none cursor-grab active:cursor-grabbing ${
            open ? "bg-brand-gradient shadow-cardHover ring-2 ring-white h-12 w-12" : "h-16 w-16 lg:h-24 lg:w-24"
          }`}
        >
          {open ? (
            <X size={20} />
          ) : (
            <span ref={badgeIconRef} className="relative grid h-16 w-16 lg:h-24 lg:w-24 shrink-0 place-items-center">
              <Image src="/mascot/smoothie-new.png" alt="" fill sizes="(min-width: 1024px) 96px, 64px" className="object-contain drop-shadow-md" />
              {/* Real speech bubble shape (rounded rect + an actual pointed
                  tail, not just a clipped corner) aimed down at the
                  mascot's head, in the original brand-gradient color. */}
              <span
                className={`absolute -top-3 transition-opacity ${snapSide === "left" ? "left-0" : "right-0"} ${
                  badgeFading ? "opacity-0" : "opacity-100"
                }`}
                style={{ transitionDuration: `${CHAT_BADGE_FADE_MS}ms` }}
              >
                {/* Tail sits behind (lower z-index) so the bubble's own
                    opaque background covers the part that overlaps it,
                    leaving only the bottom point visible. Its left offset
                    is computed (see updateTailPosition) to line up with
                    the mascot's actual center, not a guessed constant. */}
                <span
                  className="absolute -bottom-1 z-0 h-3 w-3 rotate-45 rounded-[2px] bg-brand-gradient"
                  style={{ left: tailLeft }}
                />
                <span
                  ref={badgeBubbleRef}
                  className="relative z-10 block whitespace-nowrap rounded-2xl bg-brand-gradient px-2.5 py-1.5 text-[8px] lg:text-[11px] font-bold leading-none text-white shadow-md"
                >
                  {t(...CHAT_BADGE_PHRASES[badgeIndex])}
                </span>
              </span>
            </span>
          )}
        </button>
      </div>

      {open && (
        <div
          className={`fixed ${
            stickyBarVisible
              ? "bottom-[calc(184px+env(safe-area-inset-bottom))] h-[min(760px,calc(100dvh-184px-env(safe-area-inset-bottom)-16px))]"
              : "bottom-[calc(124px+env(safe-area-inset-bottom))] h-[min(760px,calc(100dvh-124px-env(safe-area-inset-bottom)-16px))]"
          } lg:bottom-[88px] right-4 sm:right-5 z-[80] w-[calc(100vw-2rem)] sm:w-[390px] lg:h-[min(760px,82dvh)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-fadeUp transition-[bottom,height]`}
        >
          <div className="flex items-center justify-between gap-3 bg-brand-ink px-4 py-3">
            <div className="flex items-center gap-2.5 text-white min-w-0">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center">
                <Image src="/mascot/smoothie-new.png" alt="" fill sizes="36px" className="object-contain" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate">
                  {t("คุยกับน้อง Smoothie", "Chat with Smoothie")}
                </p>
                <p className="text-[11px] text-white/60 leading-tight truncate">
                  {viewingProduct
                    ? t("กำลังดูสินค้านี้อยู่ ถามได้เลยค่ะ", "Viewing this product — ask away")
                    : hasProfile
                    ? t("อ่านโปรไฟล์ผิวของคุณแล้ว", "Using your skin profile")
                    : t("ถามอะไรก็ได้เกี่ยวกับผิว ผม หรือสุขภาพ", "Ask about skin, hair or wellness")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={escalate}
                  disabled={escalating}
                  aria-label={t("คุยกับทีมงาน", "Talk to our team")}
                  className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-50"
                >
                  <Headset size={14} />
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    setMessages([]);
                    setFollowups([]);
                    setAskOptions([]);
                    setEscalateMsg(null);
                    assistantTurnCount.current = 0;
                    // Resetting the chat clears the photos with it — leaving
                    // someone's face in storage after they asked to start
                    // over would be the wrong default.
                    clearChatImages();
                  }}
                  aria-label={t("เริ่มใหม่", "Reset")}
                  className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label={t("ปิด", "Close")}
                className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {escalateMsg && (
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-amber-50 px-3.5 py-2.5">
              <p className="text-[12px] leading-relaxed text-slate-700">{escalateMsg}</p>
              <button
                onClick={() => setEscalateMsg(null)}
                aria-label={t("ปิด", "Close")}
                className="shrink-0 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div ref={scroller} className="flex-1 min-h-[200px] overflow-y-auto overscroll-contain bg-surface-soft px-3.5 py-3.5 flex flex-col gap-3">
            {restoringHistory ? (
              <div className="flex flex-1 items-center justify-center py-10 text-slate-400">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : (
              messages.length === 0 && (
                <div className="py-2">
                  <p className="text-[13px] font-semibold text-brand-ink mb-1 text-center">
                    {t(
                      "สวัสดีค่ะ ฉันน้อง Smoothie ผู้ช่วย AI ของ Smoothlife.com",
                      "Hi, I'm Smoothie — Smoothlife.com's AI assistant"
                    )}
                  </p>
                  <p className="text-[13px] text-slate-500 mb-3 text-center">
                    {hasProfile
                      ? t(
                          "ฉันอ่านคำตอบจากแบบประเมินของคุณแล้ว ถามอะไรก็ได้ค่ะ",
                          "I've read your quiz answers — ask me anything."
                        )
                      : t("ถามอะไรก็ได้ หรือเริ่มจากคำถามเหล่านี้", "Ask anything, or start with one of these")}
                  </p>
                  <Button
                    size="none"
                    fullWidth
                    href="/skin-coach"
                    className="mb-2 justify-start gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13px] shadow-cardHover"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20">
                      <Camera size={13} />
                    </span>
                    {t("วิเคราะห์ผิวหน้าด้วยรูปถ่าย", "Analyze my skin from a photo")}
                  </Button>
                  <div className="flex flex-col gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-[13px] text-slate-600 hover:border-brand-teal hover:text-brand-emerald transition-colors"
                      >
                        <MessageCircleQuestion size={14} className="shrink-0 text-brand-emerald/70" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}

            {messages.map((m, i) => {
              // A photo attached in an earlier session (before a reload)
              // never gets its actual image back — it was only ever sent to
              // the AI for temporary analysis, never stored — but the
              // "[[PHOTO]] " prefix (see route.ts persistMessage) lets the
              // bubble at least show a placeholder instead of the text
              // looking like an orphaned, contextless question.
              const hadPhoto = m.role === "user" && !m.image && m.content.startsWith(PHOTO_MARKER);
              const displayContent = hadPhoto ? m.content.slice(PHOTO_MARKER.length) : m.content;
              return (
                <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  {m.role === "user" ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600 overflow-hidden">
                      {user?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
                      ) : (
                        <UserIcon size={15} />
                      )}
                    </span>
                  ) : (
                    <span className="relative h-10 w-10 shrink-0 -mt-0.5">
                      <Image src="/mascot/smoothie-say.png" alt="" fill sizes="40px" className="object-contain" />
                    </span>
                  )}
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-[13px] whitespace-pre-wrap leading-relaxed ${
                      m.role === "user"
                        ? "max-w-[82%] bg-brand-gradient text-white rounded-tr-sm"
                        : "max-w-[90%] bg-white text-slate-700 border border-slate-100 rounded-tl-sm"
                    }`}
                  >
                    {m.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.image} alt="" className="mb-2 max-h-40 rounded-lg object-cover" />
                    )}
                    {hadPhoto && (
                      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/75">
                        <Camera size={12} />
                        {t("แนบรูปไว้ตรงนี้ (รูปไม่ได้อยู่ในเครื่องนี้)", "Photo was attached here (not on this device)")}
                      </span>
                    )}
                    {m.role === "assistant" ? renderContent(displayContent) : displayContent}
                  </div>
                </div>
              );
            })}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2">
                <span className="relative h-10 w-10 shrink-0 -mt-0.5">
                  <Image src="/mascot/smoothie-question.png" alt="" fill sizes="40px" className="object-contain" />
                </span>
                <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-100 px-3.5 py-2.5 text-[13px] text-slate-400 flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" /> {t("กำลังคิด...", "Thinking...")}
                </div>
              </div>
            )}

            {!loading && askOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-11">
                {askOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full bg-brand-gradient px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:opacity-90 transition-opacity"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {!loading && followups.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-11">
                {followups.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="flex items-center gap-1.5 rounded-full border border-brand-teal/40 bg-white px-3 py-1.5 text-[12px] text-brand-emerald hover:bg-brand-gradient-soft transition-colors"
                  >
                    <MessageCircleQuestion size={13} className="shrink-0" />
                    {s}
                  </button>
                ))}
                <button
                  onClick={() => setFollowups([])}
                  aria-label={t("ซ่อนคำแนะนำ", "Hide suggestions")}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-300 hover:text-slate-500"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Reaching a human was previously a 28px headset icon in the header
              that only appeared once a conversation existed — findable if you
              already knew it was there. These say what they do, and are
              present from the first screen. */}
          <div className="flex items-center gap-1.5 border-t border-slate-100 bg-white px-3 pt-2">
            <Button
              href="/help"
              variant="ghost"
              size="none"
              className="gap-1 px-2.5 py-1 text-[11px]"
              onClick={() => setOpen(false)}
            >
              <MessageCircleQuestion size={13} />
              {t("ศูนย์ช่วยเหลือ", "Help centre")}
            </Button>
            <Button
              variant="ghost"
              size="none"
              className="gap-1 px-2.5 py-1 text-[11px]"
              onClick={escalate}
              disabled={escalating}
            >
              <Headset size={13} />
              {escalating ? t("กำลังส่ง...", "Sending...") : t("ติดต่อแอดมิน", "Contact our team")}
            </Button>
          </div>

          {imageError && (
            <p className="bg-white px-4 pt-2 text-[11px] text-red-500 text-center">{imageError}</p>
          )}
          {awaitingConsentImage && (
            <div className="border-t border-slate-100 bg-amber-50 px-3.5 py-3">
              <p className="mb-2 text-[12px] leading-relaxed text-slate-700">
                {t(
                  "รูปที่แนบอาจมีข้อมูลอ่อนไหว (เช่น ผิวหรือปัญหาสุขภาพ) เราจะส่งไปให้ AI วิเคราะห์ชั่วคราวเท่านั้น ไม่เก็บรูปไว้บนเซิร์ฟเวอร์ — จะเก็บสำเนาย่อไว้ในเครื่องนี้เท่านั้น เพื่อให้คุณย้อนดูประวัติได้ ยินยอมให้ดำเนินการต่อไหมคะ",
                  "The photo may contain sensitive info (e.g. skin/health). We only send it to the AI temporarily and don't store it on our server — a small copy stays on this device so you can see it in your history. Consent to continue?"
                )}
              </p>
              <div className="flex gap-2">
                <Button size="none" className="px-3.5 py-1.5 text-[12px]" type="button" onClick={confirmImageConsent}>
                  {t("ยินยอม ดำเนินการต่อ", "Consent & continue")}
                </Button>
                <button
                  type="button"
                  onClick={() => setAwaitingConsentImage(null)}
                  className="rounded-full border border-slate-200 px-3.5 py-1.5 text-[12px] text-slate-500"
                >
                  {t("ยกเลิก", "Cancel")}
                </button>
              </div>
            </div>
          )}
          {pendingImage && (
            <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 pt-2.5">
              <div className="relative h-12 w-12 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage.dataUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  aria-label={t("ลบรูป", "Remove photo")}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-white"
                >
                  <X size={11} />
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                {t("แนบรูปสินค้าไว้แล้ว พิมพ์คำถามเพิ่มเติมได้ (ไม่บังคับ)", "Photo attached — add a question if you like (optional)")}
              </p>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input, pendingImage);
            }}
            className="flex items-center gap-2 border-t border-slate-100 bg-white p-2.5"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImagePick(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t("แนบรูปสินค้าเพื่อถาม", "Attach a product photo")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-soft hover:text-brand-emerald"
            >
              <ImagePlus size={17} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pendingImage
                  ? t("ถามเกี่ยวกับรูปนี้... (ไม่พิมพ์ก็ได้)", "Ask about this photo... (optional)")
                  : t("วันนี้คุณรู้สึกยังไง...", "How are you feeling today?")
              }
              className="flex-1 rounded-full border border-slate-200 bg-surface-soft px-4 py-2.5 text-[13px] outline-none focus:border-brand-teal"
            />
            <Button size="none" className="grid h-9 w-9 shrink-0 place-items-center" type="submit" disabled={loading || (!input.trim() && !pendingImage)} aria-label="Send">
              <Send size={15} />
            </Button>
          </form>
          <p className="bg-white px-4 pb-2.5 text-[10px] text-slate-400 text-center leading-snug">
            {lang === "en"
              ? "AI guidance only — not a substitute for a doctor or pharmacist."
              : "คำแนะนำจาก AI เป็นข้อมูลทั่วไป ไม่ใช่คำวินิจฉัยทางการแพทย์"}
          </p>
        </div>
      )}
    </>
  );
}
