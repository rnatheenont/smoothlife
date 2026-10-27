"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { ChatHandoff } from "@/lib/chat-handoff";

type Profile = Record<string, string>;

type QuickChatValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  profile: Profile;
  setProfile: (p: Profile) => void;
  openWithProfile: (p: Profile) => void;
  // Pages like cart/checkout/product show a fixed MobileStickyBar above the
  // tab bar that would otherwise sit directly on top of (and hide) the chat
  // launcher — they report their visibility here so QuickChat can lift
  // itself clear of it instead of being covered.
  stickyBarVisible: boolean;
  setStickyBarVisible: (v: boolean) => void;
  /**
   * Opens the corner panel already carrying a question.
   *
   * The hero band on the home page used to send its question to /chat, which
   * meant typing one sentence replaced the storefront with a full-screen
   * conversation. The question is usually about something on the page behind
   * it, so it opens the panel instead and the page stays where it was.
   */
  openWith: (handoff: ChatHandoff) => void;
  /**
   * The question waiting to be asked, if there is one.
   *
   * State rather than a ref, and carrying an `id`, because the panel may
   * already be open when a second question is sent: nothing else about the
   * tree would change, so the panel would never re-run and the question
   * would be dropped. The id is what makes two identical questions in a row
   * two separate events.
   */
  handoff: (ChatHandoff & { id: number }) | null;
  /** Called by the panel once it has played the handoff into the chat. */
  clearHandoff: (id: number) => void;
};

const Ctx = createContext<QuickChatValue | null>(null);
const KEY = "sl_advisor_profile";

export function QuickChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfileState] = useState<Profile>({});
  const [stickyBarVisible, setStickyBarVisible] = useState(false);
  const [handoff, setHandoff] = useState<(ChatHandoff & { id: number }) | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) setProfileState(JSON.parse(saved));
    } catch {}
  }, []);

  function setProfile(p: Profile) {
    setProfileState(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
  }

  function openWithProfile(p: Profile) {
    setProfile(p);
    setOpen(true);
  }

  function openWith(next: ChatHandoff) {
    setHandoff({ ...next, id: Date.now() });
    setOpen(true);
  }

  function clearHandoff(id: number) {
    setHandoff((cur) => (cur?.id === id ? null : cur));
  }

  return (
    <Ctx.Provider
      value={{
        open,
        setOpen,
        profile,
        setProfile,
        openWithProfile,
        stickyBarVisible,
        setStickyBarVisible,
        openWith,
        handoff,
        clearHandoff,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useQuickChat() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      open: false,
      setOpen: () => {},
      profile: {},
      setProfile: () => {},
      openWithProfile: () => {},
      stickyBarVisible: false,
      setStickyBarVisible: () => {},
      openWith: () => {},
      handoff: null,
      clearHandoff: () => {},
    } as QuickChatValue;
  }
  return ctx;
}
