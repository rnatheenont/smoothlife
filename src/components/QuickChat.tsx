"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useQuickChat } from "@/lib/quickchat-context";

import { useChatUnread } from "@/lib/use-chat-unread";

// The panel — the conversation, its session hook, the streaming reader —
// arrives when somebody opens the chat, not before. Everyone loads the
// button; hardly anyone opens it.
//
// ssr: false because there is nothing to render on the server for a panel
// that is closed, and loading: null because the panel animates itself in.
const QuickChatPanel = dynamic(() => import("@/components/chat/QuickChatPanel"), { ssr: false, loading: () => null });

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

// What the launcher has to clear at the bottom of a phone screen. Both are
// the bars' measured heights rather than guesses — MobileTabBar renders 55px
// and MobileStickyBar 65px.
const TAB_BAR_H = 55;
const BUY_BAR_H = 65;
// Above the tab bar on its own the launcher keeps a small gap; sitting on the
// buy bar it goes flush, because that bar carries its own bottom padding.
// The two work out to 60px and 120px.
const GAP_ABOVE_TAB_BAR = 5;
// The launcher is h-16 on mobile; the panel opens directly above it.
const LAUNCHER_H = 64;

export default function QuickChat() {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const { open, setOpen, stickyBarVisible } = useQuickChat();
  const pathname = usePathname();
  const viewingSlug = pathname?.match(/^\/product\/([a-z0-9-]+)/i)?.[1];

  // The badge, without the conversation behind it: a small poll of its own
  // that only runs for someone who has chatted before. See use-chat-unread.
  const unread = useChatUnread(open);

  // The tab bar is always there; the buy bar appears only once a product
  // page scrolls past its own button, so the launcher still has to follow
  // that one or it is left hovering with a strip of page underneath it.
  const stack = TAB_BAR_H + (stickyBarVisible ? BUY_BAR_H : 0);
  const launcherBottom = stack + (stickyBarVisible ? 0 : GAP_ABOVE_TAB_BAR);
  const panelBottom = launcherBottom + LAUNCHER_H;

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
        className="fixed bottom-[var(--qc-bottom)] lg:bottom-3 right-4 lg:right-5 z-80 inline-flex"
        style={{
            "--qc-bottom": `calc(${launcherBottom}px + env(safe-area-inset-bottom))`,
            transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
            // bottom has to ride along in here. An inline transition replaces
            // the class one outright, so the transition-[bottom] utility this
            // element used to carry never actually ran.
            transition: isDragging
              ? "none"
              : "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), bottom 0.2s",
          } as CSSProperties}
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

      {open && <QuickChatPanel panelBottom={panelBottom} viewingSlug={viewingSlug} onClose={() => setOpen(false)} />}
    </>
  );
}
