"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { RotateCcw, X, Headset, Maximize2 } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useChatSession } from "@/lib/use-chat-session";
import { useQuickChat } from "@/lib/quickchat-context";
import { seedChat } from "@/lib/chat-handoff";
import ChatConversation from "@/components/chat/ChatConversation";
import ChatMascot, { chatMood } from "@/components/chat/ChatMascot";

// The chat panel: everything that exists only once somebody has opened the
// chat.
//
// Its own file so it can be loaded only then. The conversation, the session
// hook, the streaming reader and the image store come to about 1,700 lines
// between them, and every visitor was downloading all of it to have a round
// button in the corner of the page. QuickChat keeps the button; this is the
// rest.

export default function QuickChatPanel({
  panelBottom,
  viewingSlug,
  onClose,
}: {
  /** Where the launcher sits, so the panel stacks on top of it. */
  panelBottom: number;
  viewingSlug?: string;
  onClose: () => void;
}) {
  const { t } = useLang();
  // active: true — this component only exists while the panel is open.
  const session = useChatSession({ active: true, viewingSlug });
  const { messages, reset, hasProfile, escalating, setNoteOpen, loading } = session;
  const { handoff, clearHandoff } = useQuickChat();
  const { send, setInput, handleImagePick, historyLoaded } = session;

  // A question typed somewhere else on the page — the hero band's search box
  // today — arrives here as a handoff rather than as a route change.
  //
  // It waits for the stored history so it lands after the conversation so
  // far rather than ahead of it. Each handoff is played once: the id is
  // recorded before anything is sent, so a second run of this effect (React
  // in development mounts every component twice) cannot ask it again.
  const played = useRef<number | null>(null);
  useEffect(() => {
    if (!historyLoaded || !handoff || played.current === handoff.id) return;
    played.current = handoff.id;
    seedChat(handoff, { send, setInput, handleImagePick });
    clearHandoff(handoff.id);
  }, [historyLoaded, handoff, clearHandoff, send, setInput, handleImagePick]);

  return (
    <div
      className="fixed bottom-[var(--qc-bottom)] h-[var(--qc-height)] lg:bottom-[88px] right-4 sm:right-5 z-80 w-[calc(100vw-2rem)] sm:w-[390px] lg:h-[min(760px,82dvh)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-fadeUp transition-[bottom,height]"
      style={
        {
          "--qc-bottom": `calc(${panelBottom}px + env(safe-area-inset-bottom))`,
          "--qc-height": `min(760px, calc(100dvh - ${panelBottom}px - env(safe-area-inset-bottom) - 16px))`,
        } as CSSProperties
      }
    >
      <div className="flex items-center justify-between gap-3 bg-brand-ink px-4 py-3">
        <div className="flex items-center gap-2.5 text-white min-w-0">
          <ChatMascot
            mood={chatMood(loading, messages[messages.length - 1]?.role)}
            className="h-10 w-10 shrink-0 rounded-full bg-white/10"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight truncate">
              {t("คุยกับน้อง Smoothie", "Chat with Smoothie")}
            </p>
            <p className="text-[11px] text-white/60 leading-tight truncate">
              {viewingSlug
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
            onClick={onClose}
            aria-label={t("ขยายเต็มจอ", "Open full screen")}
            title={t("ขยายเต็มจอ", "Open full screen")}
            className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Maximize2 size={14} />
          </Link>
          <button
            onClick={onClose}
            aria-label={t("ปิด", "Close")}
            className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <ChatConversation session={session} variant="widget" active />
    </div>
  );
}
