"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useChatSession } from "@/lib/use-chat-session";
import { seedChat } from "@/lib/chat-handoff";
import ChatConversation from "@/components/chat/ChatConversation";
import ChatMascot, { chatMood } from "@/components/chat/ChatMascot";

// The same conversation as the corner widget, on a page of its own.
//
// A page rather than a CSS "expand" over the storefront, because the things
// that make a chat feel like an app come free with a real route: the phone's
// back gesture leaves the chat, the address bar collapses on scroll, and the
// link can be reopened later. The header is deliberately thin — a way back, a
// name, and a reset. Everything else is the conversation.

export default function ChatFullscreen() {
  const { t } = useLang();
  const router = useRouter();
  const session = useChatSession({ active: true });
  const { messages, reset, hasProfile, send, setInput, handleImagePick, historyLoaded, loading } = session;
  const seeded = useRef(false);

  // A question can still arrive here by link — ?q=, plus ?photo=1 for a
  // picture parked in sessionStorage (see chat-handoff). The hero band no
  // longer sends one this way, but the LINE menu and anything else pointing
  // at /chat?q= does, so the entry point stays.
  //
  // Waits for the stored history so it lands after the conversation so far
  // rather than ahead of it, and clears the parameters once used: a reload
  // should not ask the same thing twice.
  useEffect(() => {
    if (seeded.current || !historyLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q")?.trim();
    const photo = params.get("photo") === "1";
    if (!q && !photo) return;
    seeded.current = true;
    window.history.replaceState(null, "", "/chat");
    seedChat({ q, photo }, { send, setInput, handleImagePick });
  }, [historyLoaded, send, setInput, handleImagePick]);

  function leave() {
    // Going "back" is what the header arrow means when there is somewhere to
    // go back to — a shopper who opened this from the widget expects to land
    // on the page they were reading, not on the home page.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-white pb-[env(safe-area-inset-bottom)]">
      <header className="flex items-center gap-3 bg-brand-ink px-3 py-3 sm:px-4">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={leave}
            aria-label={t("กลับ", "Back")}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <ChatMascot
            mood={chatMood(loading, messages[messages.length - 1]?.role)}
            className="h-10 w-10 shrink-0 rounded-full bg-white/10"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold leading-tight text-white">
              {t("คุยกับน้อง Smoothie", "Chat with Smoothie")}
            </p>
            <p className="truncate text-[11px] leading-tight text-white/60">
              {hasProfile
                ? t("อ่านโปรไฟล์ผิวของคุณแล้ว", "Using your skin profile")
                : t("ถามอะไรก็ได้เกี่ยวกับผิว ผม หรือสุขภาพ", "Ask about skin, hair or wellness")}
            </p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              aria-label={t("เริ่มใหม่", "Start over")}
              title={t("เริ่มใหม่", "Start over")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <RotateCcw size={16} />
            </button>
          )}
        </div>
      </header>

      <ChatConversation session={session} variant="full" active />
    </div>
  );
}
