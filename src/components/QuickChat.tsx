"use client";

import { useEffect, useLayoutEffect, useRef, useState, PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Send, Loader2, RotateCcw, User as UserIcon, X, Check, Camera, ImagePlus, MessageCircleQuestion, Headset, Bot } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useQuickChat } from "@/lib/quickchat-context";
import { getProductBySlug } from "@/data/products";
import { PHOTO_MARKER } from "@/lib/chat-image-store";
import { useChatSession } from "@/lib/use-chat-session";
import { renderMessageContent } from "@/components/chat/ChatMessageContent";
import { Avatar, Button } from "@/components/ui";

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

export default function QuickChat() {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const { open, setOpen, stickyBarVisible } = useQuickChat();
  const pathname = usePathname();
  const viewingSlug = pathname?.match(/^\/product\/([a-z0-9-]+)/i)?.[1];
  const viewingProduct = viewingSlug ? getProductBySlug(viewingSlug) : undefined;

  const {
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
    pendingImage,
    setPendingImage,
    awaitingConsentImage,
    setAwaitingConsentImage,
    imageError,
    handleImagePick,
    confirmImageConsent,
    followups,
    setFollowups,
    askOptions,
    setAskOptions,
    setHelpOpen: setSessionHelpOpen,
    closeOffer,
    setCloseOffer,
    caseLooksSettled,
    humanHandling,
    escalating,
    escalateMsg,
    setEscalateMsg,
    escalate,
    resolveCase,
    resolvingCase,
    backToAi,
    backToAiBusy,
    helpOpen,
    openHelpTopics,
    noteOpen,
    setNoteOpen,
    note,
    setNote,
  } = useChatSession({ active: open, viewingProduct });

  const scrolledOnceRef = useRef(false);
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

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

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
    // inside the session hook's restore effect — on the very first render
    // right after `open` becomes true, both are still at their pre-fetch
    // values, so `restoringHistory` alone doesn't catch this pass. Without
    // the `!historyLoaded` check here too, this effect fires once on the
    // still-empty container, "using up" the instant jump — leaving the
    // real restored history to animate in with a smooth scroll instead.
    if (!historyLoaded || restoringHistory) return;
    const behavior = scrolledOnceRef.current ? "smooth" : "auto";
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior });
    scrolledOnceRef.current = true;
  }, [messages, loading, open, restoringHistory, historyLoaded]);

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
        } lg:bottom-3 right-4 lg:right-5 z-80 inline-flex transition-[bottom]`}
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
          aria-label={
            unread > 0
              ? t(`มีข้อความใหม่ ${unread} ข้อความ`, `${unread} new messages`)
              : t("คุยกับน้อง Smoothie", "Chat with Smoothie")
          }
          className={`relative flex items-center justify-center rounded-full text-white transition-[transform,background-color,box-shadow] hover:scale-105 active:scale-95 touch-none select-none cursor-grab active:cursor-grabbing ${
            open ? "bg-brand-gradient shadow-cardHover ring-2 ring-white h-12 w-12" : "h-16 w-16 lg:h-24 lg:w-24"
          }`}
        >
          {/* Unread count. Only ever appears when the panel is closed — while
              it is open the customer is reading, and a badge over what they
              are already looking at is noise. */}
          {!open && unread > 0 && (
            // Low on the mascot's side, clear of the speech bubble above it.
            <span className="absolute -right-0.5 bottom-0.5 z-20 grid h-6 min-w-6 place-items-center rounded-full bg-rose-500 px-1.5 text-[11px] font-bold tabular-nums text-white shadow-md ring-2 ring-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
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
          } lg:bottom-[88px] right-4 sm:right-5 z-80 w-[calc(100vw-2rem)] sm:w-[390px] lg:h-[min(760px,82dvh)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-fadeUp transition-[bottom,height]`}
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
                  onClick={() => setNoteOpen((v) => !v)}
                  disabled={escalating}
                  aria-label={t("ฝากข้อความถึงแอดมิน", "Leave a message for our team")}
                  className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10 disabled:opacity-50"
                >
                  <Headset size={14} />
                </button>
              )}
              {messages.length > 0 && (
                <button
                  onClick={reset}
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
                className="shrink-0 text-slate-500 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            </div>
          )}

          <div ref={scroller} className="flex-1 min-h-[200px] overflow-y-auto overscroll-contain bg-surface-soft px-3.5 py-3.5 flex flex-col gap-3">
            {restoringHistory ? (
              <div className="flex flex-1 items-center justify-center py-10 text-slate-500">
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
                        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-[13px] text-slate-600 hover:border-brand-teal hover:text-brand-800 transition-colors"
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
                      <Avatar
                        src={user?.avatar}
                        name={user?.name ?? ""}
                        className="h-9 w-9"
                        fallback={<UserIcon size={15} />}
                      />
                    </span>
                  ) : m.fromStaff ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-800 ring-1 ring-brand-200">
                      <Headset size={16} />
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
                        : m.fromStaff
                          ? "max-w-[90%] bg-brand-50 text-slate-700 border border-brand-200 rounded-tl-sm"
                          : "max-w-[90%] bg-white text-slate-700 border border-slate-100 rounded-tl-sm"
                    }`}
                  >
                    {/* Staff replies are delivered through the same field the
                        AI's answers use, so without this the customer watches
                        a person reply under Smoothie's name — most confusing
                        right after they have chosen to go back to the bot. */}
                    {m.fromStaff && (
                      <span className="mb-1 block text-[11px] font-semibold text-brand-800">
                        {t("ทีมงาน Smoothlife", "Smoothlife team")}
                      </span>
                    )}
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
                    {m.role === "assistant" ? renderMessageContent(displayContent) : displayContent}
                  </div>
                </div>
              );
            })}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2">
                <span className="relative h-10 w-10 shrink-0 -mt-0.5">
                  <Image src="/mascot/smoothie-question.png" alt="" fill sizes="40px" className="object-contain" />
                </span>
                <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-100 px-3.5 py-2.5 text-[13px] text-slate-500 flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" /> {t("กำลังคิด…", "Thinking…")}
                </div>
              </div>
            )}

            {!loading &&
              (askOptions.length > 0 || helpOpen || caseLooksSettled || closeOffer) && (
              <div className="flex flex-wrap items-center gap-1.5 pl-11">
                {askOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSessionHelpOpen(false);
                      send(s);
                    }}
                    className="rounded-full bg-brand-gradient px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-xs hover:opacity-90 transition-opacity"
                  >
                    {s}
                  </button>
                ))}
                {/* Offered only after a person has actually answered. Quiet
                    means "that solved it" or "they gave up" and those look
                    identical from the inbox — the customer is the only one who
                    knows which, and this is one tap. */}
                {caseLooksSettled && !helpOpen && (
                  <button
                    onClick={resolveCase}
                    disabled={resolvingCase}
                    className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Check size={12} />
                    {t("เรื่องนี้เรียบร้อยแล้ว", "This is sorted")}
                  </button>
                )}
                {/* Smoothie thinks she finished this one. Two ways out, both
                    one tap: agree, or say it is not finished — the second is
                    what stops a wrong guess from burying a real problem. */}
                {closeOffer && !helpOpen && !caseLooksSettled && (
                  <>
                    <button
                      onClick={() => {
                        setCloseOffer(false);
                        void resolveCase();
                      }}
                      disabled={resolvingCase}
                      className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                    >
                      <Check size={12} />
                      {t("เรียบร้อยแล้ว ขอบคุณ", "All sorted, thanks")}
                    </button>
                    <button
                      onClick={() => {
                        setCloseOffer(false);
                        setAskOptions([]);
                        setNoteOpen(true);
                      }}
                      className="flex items-center gap-1 rounded-full border border-brand-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-brand-800 hover:bg-brand-50"
                    >
                      <Headset size={12} />
                      {t("ยังไม่จบ ขอคุยกับแอดมิน", "Not yet — talk to a person")}
                    </button>
                  </>
                )}
                {helpOpen && (
                  <button
                    onClick={() => {
                      setSessionHelpOpen(false);
                      setAskOptions([]);
                      setNoteOpen(true);
                    }}
                    className="flex items-center gap-1 rounded-full border border-brand-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-brand-800 hover:bg-brand-50"
                  >
                    <Headset size={12} />
                    {t("ติดต่อแอดมิน", "Talk to a person")}
                  </button>
                )}
              </div>
            )}

            {!loading && followups.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-11">
                {followups.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="flex items-center gap-1.5 rounded-full border border-brand-teal/40 bg-white px-3 py-1.5 text-[12px] text-brand-800 hover:bg-brand-gradient-soft transition-colors"
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

          {noteOpen && (
            <div className="border-t border-slate-100 bg-surface-soft px-3.5 py-3">
              <p className="mb-1.5 text-[12px] font-semibold text-brand-ink">
                {t("ฝากข้อความถึงแอดมิน", "Leave a message for our team")}
              </p>
              <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
                {t(
                  "ทีมงานจะติดต่อกลับภายใน 1 วันทำการ ระหว่างรอ คุยกับน้อง Smoothie ต่อได้ตามปกติค่ะ",
                  "The team replies within 1 business day. You can keep chatting with Smoothie meanwhile."
                )}
              </p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder={t("เช่น ของยังไม่ถึง อยากเปลี่ยนที่อยู่จัดส่ง", "e.g. my parcel hasn't arrived, I need to change the address")}
                className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-hidden focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600"
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="none"
                  className="px-3.5 py-1.5 text-[12px]"
                  onClick={() => escalate(note)}
                  loading={escalating}
                  disabled={!note.trim()}
                >
                  {escalating ? t("กำลังส่ง…", "Sending…") : t("ฝากข้อความ", "Send")}
                </Button>
                <button
                  type="button"
                  onClick={() => setNoteOpen(false)}
                  className="rounded-full border border-slate-200 px-3.5 py-1.5 text-[12px] text-slate-500"
                >
                  {t("ยกเลิก", "Cancel")}
                </button>
              </div>
            </div>
          )}

          {/* Reaching a human was previously a 28px headset icon in the header
              that only appeared once a conversation existed — findable if you
              already knew it was there. These say what they do, and are
              present from the first screen. */}
          <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto border-t border-slate-100 bg-white px-3 py-2">
            {/* nowrap + shrink-0 + a scrolling row, because these labels are
                Thai and the panel is ~340px: left to wrap they broke across
                two lines mid-word and the bar came out ragged. Scrolling keeps
                every label whole at any width, including the third button that
                only appears while a person has the conversation. */}
            {/* One door, not two. "Help centre" and "Leave a message" were the
                same intent — I need something the bot cannot give me — and
                splitting them made the customer guess which was which before
                they had said what they wanted. Reaching a person is now the
                last chip in the list, after the questions that can be answered
                without one. */}
            <Button
              variant="ghost"
              size="none"
              className={`shrink-0 gap-1.5 whitespace-nowrap rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-800 ${
                helpOpen || noteOpen ? "border-brand-200 bg-brand-50 text-brand-800" : ""
              }`}
              onClick={openHelpTopics}
              disabled={escalating}
            >
              <MessageCircleQuestion size={13} />
              {t("ช่วยเหลือ / ติดต่อแอดมิน", "Help & contact")}
            </Button>
            {humanHandling && (
              <Button
                variant="ghost"
                size="none"
                className="shrink-0 gap-1.5 whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-medium text-brand-800 transition-colors hover:bg-brand-100"
                onClick={backToAi}
                disabled={backToAiBusy}
              >
                <Bot size={13} />
                {backToAiBusy ? t("กำลังเปลี่ยน…", "Switching…") : t("คุยกับ Smoothie", "Back to Smoothie")}
              </Button>
            )}
          </div>

          {imageError && (
            <p className="bg-white px-4 pt-2 text-[11px] text-red-500 text-center">{imageError}</p>
          )}
          {awaitingConsentImage && (
            <div className="border-t border-slate-100 bg-amber-50 px-3.5 py-3">
              <p className="mb-2 text-[12px] leading-relaxed text-slate-700">
                {humanHandling
                  ? t(
                      "ตอนนี้ทีมงานเป็นผู้ดูแลเคสของคุณอยู่ รูปที่ส่งจะถูกเก็บไว้บนระบบของเรา เพื่อให้ทีมงานเปิดดูได้ — เฉพาะเจ้าหน้าที่ที่ดูแลเคสนี้เท่านั้น ไม่เปิดเผยต่อบุคคลอื่น และจะลบอัตโนมัติเมื่อปิดเคส หรืออย่างช้าภายใน 30 วัน รูปอาจมีข้อมูลอ่อนไหว (เช่น ผิวหรือสุขภาพ) กรุณาส่งเท่าที่จำเป็นต่อการตรวจสอบ ยินยอมให้เก็บรูปไว้ให้ทีมงานตรวจสอบไหมคะ",
                      "A member of our team is handling your case, so this photo will be stored on our system for them to see — visible only to the staff on this case, deleted when the case is closed, and within 30 days at the latest. Photos may contain sensitive information (e.g. skin or health); please send only what's needed. Consent to store it for the team?"
                    )
                  : t(
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
                <img src={pendingImage.dataUrl} alt="" width={48} height={48} className="h-12 w-12 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  aria-label={t("ลบรูป", "Remove photo")}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-white"
                >
                  <X size={11} />
                </button>
              </div>
              <p className="text-[11px] text-slate-500">
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
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-surface-soft hover:text-brand-800"
            >
              <ImagePlus size={17} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pendingImage
                  ? t("ถามเกี่ยวกับรูปนี้... (ไม่พิมพ์ก็ได้)", "Ask about this photo... (optional)")
                  : t("วันนี้คุณรู้สึกยังไง…", "How are you feeling today?")
              }
              className="flex-1 rounded-full border border-slate-200 bg-surface-soft px-4 py-2.5 text-[13px] outline-hidden focus:border-brand-teal"
            />
            <Button size="none" className="grid h-9 w-9 shrink-0 place-items-center" type="submit" disabled={loading || (!input.trim() && !pendingImage)} aria-label="Send">
              <Send size={15} />
            </Button>
          </form>
          <p className="bg-white px-4 pb-2.5 text-[10px] text-slate-500 text-center leading-snug">
            {lang === "en"
              ? "AI guidance only — not a substitute for a doctor or pharmacist."
              : "คำแนะนำจาก AI เป็นข้อมูลทั่วไป ไม่ใช่คำวินิจฉัยทางการแพทย์"}
          </p>
        </div>
      )}
    </>
  );
}
