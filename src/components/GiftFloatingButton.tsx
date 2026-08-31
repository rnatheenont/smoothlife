"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useQuickChat } from "@/lib/quickchat-context";

// Draggable floating launcher for gift progress — forked from QuickChat's
// exact drag-to-snap-to-edge implementation (same DRAG_THRESHOLD/EDGE_MARGIN/
// tap-vs-drag disambiguation) so it shares the same interaction language as
// the chat bubble. Spawns on the opposite side (left) by default so the two
// don't overlap without needing two-way position coordination.
export default function GiftFloatingButton() {
  const evals = useFreeGiftEvals();
  const { settings } = useWidgetSettings();
  const router = useRouter();
  const { stickyBarVisible } = useQuickChat();

  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef({ dragging: false, moved: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const DRAG_THRESHOLD = 6;
  const LAUNCHER_SIZE = 56;
  const EDGE_MARGIN = 8;

  function dragBounds() {
    if (typeof window === "undefined") return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    return {
      minX: 0,
      maxX: window.innerWidth - LAUNCHER_SIZE - EDGE_MARGIN,
      minY: -(window.innerHeight - LAUNCHER_SIZE - EDGE_MARGIN),
      maxY: 0,
    };
  }
  function clampDragPos(x: number, y: number) {
    const { minX, maxX, minY, maxY } = dragBounds();
    return { x: Math.min(maxX, Math.max(minX, x)), y: Math.min(maxY, Math.max(minY, y)) };
  }

  function handlePointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    dragState.current = { dragging: true, moved: false, startX: e.clientX, startY: e.clientY, baseX: dragPos.x, baseY: dragPos.y };
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragState.current.dragging) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragState.current.moved = true;
    setDragPos(clampDragPos(dragState.current.baseX + dx, dragState.current.baseY + dy));
  }
  function handlePointerUp() {
    const wasRealDrag = dragState.current.dragging && dragState.current.moved;
    dragState.current.dragging = false;
    setIsDragging(false);
    if (wasRealDrag) {
      setDragPos((pos) => {
        const { minX, maxX } = dragBounds();
        const centerX = 16 + LAUNCHER_SIZE / 2 + pos.x;
        const snappedX = centerX < window.innerWidth / 2 ? minX : maxX;
        return { x: snappedX, y: pos.y };
      });
    }
  }
  function handleClick() {
    if (dragState.current.moved) {
      dragState.current.moved = false;
      return;
    }
    router.push("/cart");
  }

  if (!settings.floating_button.enabled) return null;
  if (!evals.some((e) => e.eligible)) return null;

  return (
    <div
      className={`fixed ${stickyBarVisible ? "bottom-[calc(132px+env(safe-area-inset-bottom))]" : "bottom-[calc(72px+env(safe-area-inset-bottom))]"} lg:bottom-5 left-4 z-80 inline-flex transition-[bottom]`}
      style={{
        transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
        transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleClick}
        aria-label="ของแถมที่ปลดล็อกแล้ว"
        className="relative grid h-14 w-14 place-items-center rounded-full bg-brand-gradient text-white shadow-cardHover touch-none"
      >
        <Gift size={24} />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-rose-500 animate-pop" />
      </button>
    </div>
  );
}
