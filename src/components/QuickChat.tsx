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
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import SmoothieRig, { type SmoothieRigHandle } from "@/components/mascot/SmoothieRig";
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

// One hello from Smoothie per visit (per browser tab session), a moment after
// the page settles: by name for a customer whose sign-in was already there on
// arrival, a plain hello for someone who is not signed in — "welcome" on a
// first ever visit, "nice to see you again" after that. Someone who logs in
// mid-visit is not greeted again; the login itself was the hello.
const WELCOME_KEY = "sl_welcome_back_shown";
const VISITED_KEY = "sl_visited";
const WELCOME_DELAY_MS = 1500;
const WELCOME_SHOW_MS = 9000;

/** First name only, and nothing that is really an email or a phone number. */
function greetingName(name: string | undefined | null): string {
  const first = (name ?? "").trim().replace(/^คุณ\s*/, "").split(/\s+/)[0] ?? "";
  if (!first || first.includes("@") || /^[+\d\s-]+$/.test(first)) return "";
  return first;
}
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
  const { user, loading: authLoading } = useAuth();
  const { open, setOpen, stickyBarVisible } = useQuickChat();
  const pathname = usePathname();
  const viewingSlug = pathname?.match(/^\/product\/([a-z0-9-]+)/i)?.[1];

  // The badge, without the conversation behind it: a small poll of its own
  // that only runs for someone who has chatted before. See use-chat-unread.
  const unread = useChatUnread(open);

  const rigRef = useRef<SmoothieRigHandle>(null);
  // null = no bubble. A member's name may be "" (greet without a name).
  type Welcome = { kind: "member"; name: string } | { kind: "guest"; firstVisit: boolean };
  const [welcome, setWelcome] = useState<Welcome | null>(null);
  const welcomeChecked = useRef(false);
  useEffect(() => {
    // Decided once, on the first answer from auth.
    if (authLoading || welcomeChecked.current) return;
    welcomeChecked.current = true;
    let firstVisit = false;
    try {
      if (sessionStorage.getItem(WELCOME_KEY)) return;
      sessionStorage.setItem(WELCOME_KEY, "1");
      firstVisit = !localStorage.getItem(VISITED_KEY);
      localStorage.setItem(VISITED_KEY, "1");
    } catch {
      // Storage blocked (private mode): greeting once per page load is fine.
    }
    const next: Welcome = user ? { kind: "member", name: greetingName(user.name) } : { kind: "guest", firstVisit };
    // Deliberately not cleared by a cleanup: a re-render of the user object
    // (or Strict Mode's mount-unmount-mount) would cancel the hello for good,
    // since it is decided once. After an unmount the setState is a no-op.
    setTimeout(() => {
      setWelcome(next);
      rigRef.current?.play(next.kind === "member" ? "happy" : "wave");
    }, WELCOME_DELAY_MS);
  }, [authLoading, user]);
  useEffect(() => {
    if (welcome === null) return;
    const id = setTimeout(() => setWelcome(null), WELCOME_SHOW_MS);
    return () => clearTimeout(id);
  }, [welcome]);
  const showWelcome = welcome !== null && !open;

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
    setWelcome(null); // opening the chat answers the hello
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
              {/* Inside a draggable button: no click gestures of its own (the button
                  owns the tap), just breathing, blinking and the odd wave. */}
              <SmoothieRig
                ref={rigRef}
                framing="bust"
                className="absolute inset-0 rounded-full drop-shadow-md"
                playOnClick={false}
                greet="wave"
                idleActions={["wave", "happy", "nod"]}
                idleEvery={15}
              />
              {/* Real speech bubble shape (rounded rect + an actual pointed
                  tail, not just a clipped corner) aimed down at the
                  mascot's head, in the original brand-gradient color. */}
              {/* Not while the welcome bubble is up — on a phone this badge
                  runs its own opacity animation, so hiding it by class loses. */}
              {!showWelcome && (
              <span
                key={badgeIndex}
                className={`absolute -top-3 transition-opacity max-lg:animate-chatBadgeLife ${snapSide === "left" ? "left-0" : "right-0"} ${
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
                  className="absolute -bottom-1 z-0 h-3 w-3 rotate-45 rounded-[2px] bg-brand-800"
                  style={{ left: tailLeft }}
                />
                <span
                  ref={badgeBubbleRef}
                  className="relative z-10 block whitespace-nowrap rounded-2xl bg-brand-800 px-2.5 py-1.5 text-[11px] font-bold leading-none text-white shadow-md"
                >
                  {t(...CHAT_BADGE_PHRASES[badgeIndex])}
                </span>
              </span>
              )}
            </span>
          )}
        </button>

        {/* The hello: a chat bubble from Smoothie above the
            launcher. Outside the button (it has buttons of its own); tapping
            it opens the chat, the cross just dismisses it. */}
        {showWelcome && (
          <div
            role="status"
            className={`absolute bottom-full mb-3 w-max max-w-[min(280px,calc(100vw-2rem))] animate-fadeUp ${
              snapSide === "left" ? "left-0" : "right-0"
            }`}
          >
            <span
              className={`absolute -bottom-1 h-3 w-3 rotate-45 rounded-[2px] bg-brand-800 ${
                snapSide === "left" ? "left-[25px] lg:left-[41px]" : "right-[25px] lg:right-[41px]"
              }`}
            />
            <div className="relative rounded-2xl bg-brand-800 py-2 pl-3 pr-7 text-left text-white shadow-md">
              <button
                type="button"
                onClick={() => {
                  setWelcome(null);
                  setDragPos({ x: 0, y: 0 });
                  setOpen(true);
                }}
                className="block text-left"
              >
                <span className="block text-[12px] font-bold leading-snug">
                  {welcome?.kind === "member"
                    ? welcome.name
                      ? t(`ยินดีต้อนรับกลับมานะคะ คุณ${welcome.name}`, `Welcome back, ${welcome.name}!`)
                      : t("ยินดีต้อนรับกลับมานะคะ", "Welcome back!")
                    : welcome?.firstVisit
                      ? t("สวัสดีค่ะ ยินดีต้อนรับสู่ Smoothlife.com", "Hi! Welcome to Smoothlife.com")
                      : t("สวัสดีค่ะ ดีใจที่แวะมาอีกนะคะ", "Hi! Nice to see you again")}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-white/80">
                  {welcome?.kind === "member"
                    ? t("วันนี้ให้น้อง Smoothie ช่วยอะไรดีคะ", "What can Smoothie help you with today?")
                    : t("มีอะไรให้น้อง Smoothie ช่วยแนะนำไหมคะ", "Can Smoothie help you find something?")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setWelcome(null)}
                aria-label={t("ปิด", "Close")}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X size={12} />
              </button>
            </div>
          </div>
        )}
      </div>

      {open && <QuickChatPanel panelBottom={panelBottom} viewingSlug={viewingSlug} onClose={() => setOpen(false)} />}
    </>
  );
}
