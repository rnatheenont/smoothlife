"use client";

import { useEffect, useLayoutEffect, useRef, useState, PointerEvent as ReactPointerEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RotateCcw, X, Headset, Maximize2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useQuickChat } from "@/lib/quickchat-context";
import { getProductBySlug } from "@/data/products";
import { PHOTO_MARKER } from "@/lib/chat-image-store";
import { useChatSession } from "@/lib/use-chat-session";
import ChatConversation from "@/components/chat/ChatConversation";
import { Button } from "@/components/ui";

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

  const session = useChatSession({ active: open, viewingProduct });
  // The panel's own chrome needs four of them; ChatConversation reads the
  // rest off the session object it is handed.
  const { messages, reset, hasProfile, escalating, setNoteOpen, unread } = session;

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
              {/* Same conversation, more room — /chat runs the same session
                  hook, so the history is already there when it opens. */}
              <Link
                href="/chat"
                onClick={() => setOpen(false)}
                aria-label={t("ขยายเต็มจอ", "Open full screen")}
                title={t("ขยายเต็มจอ", "Open full screen")}
                className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
              >
                <Maximize2 size={14} />
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label={t("ปิด", "Close")}
                className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <ChatConversation session={session} variant="widget" active={open} />
        </div>
      )}
    </>
  );
}
