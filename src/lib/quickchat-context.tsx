"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

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
};

const Ctx = createContext<QuickChatValue | null>(null);
const KEY = "sl_advisor_profile";

export function QuickChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfileState] = useState<Profile>({});
  const [stickyBarVisible, setStickyBarVisible] = useState(false);

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

  return (
    <Ctx.Provider
      value={{ open, setOpen, profile, setProfile, openWithProfile, stickyBarVisible, setStickyBarVisible }}
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
    } as QuickChatValue;
  }
  return ctx;
}
