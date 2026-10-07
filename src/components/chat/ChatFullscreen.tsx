"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useChatSession } from "@/lib/use-chat-session";
import { HERO_PHOTO_KEY } from "@/lib/chat-handoff";
import ChatConversation from "@/components/chat/ChatConversation";

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
  const { messages, reset, hasProfile, send, setInput, handleImagePick, historyLoaded } = session;
  const seeded = useRef(false);

  // What the home page's hero band hands over: a question as ?q=, a photo as
  // ?photo=1 plus a data URL parked in sessionStorage (see chat-handoff).
  // Waits for the stored history so it lands after the conversation so far
  // rather than ahead of it, and clears both the parameters and the slot once
  // used — a reload should not ask the same thing or re-attach the same
  // picture again.
  //
  // A question on its own is sent straight away. A question *with* a photo is
  // put in the composer instead: the photo has a consent prompt in front of
  // it, so sending the text now would split one message into two and leave
  // the picture behind.
  useEffect(() => {
    if (seeded.current || !historyLoaded) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q")?.trim();
    const wantsPhoto = params.get("photo") === "1";
    if (!q && !wantsPhoto) return;
    seeded.current = true;
    window.history.replaceState(null, "", "/chat");

    let dataUrl: string | null = null;
    if (wantsPhoto) {
      try {
        dataUrl = sessionStorage.getItem(HERO_PHOTO_KEY);
        sessionStorage.removeItem(HERO_PHOTO_KEY);
      } catch {}
    }

    if (dataUrl) {
      if (q) setInput(q);
      fetch(dataUrl)
        .then((r) => r.blob())
        .then((b) => handleImagePick(new File([b], "photo.jpg", { type: b.type || "image/jpeg" })))
        .catch(() => {});
    } else if (q) {
      send(q);
    }
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
          <span className="relative grid h-9 w-9 shrink-0 place-items-center">
            <Image src="/mascot/smoothie-new.png" alt="" fill sizes="36px" className="object-contain" />
          </span>
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
