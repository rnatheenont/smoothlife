"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Profile = Record<string, string>;

type QuickChatValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  profile: Profile;
  setProfile: (p: Profile) => void;
  openWithProfile: (p: Profile) => void;
};

const Ctx = createContext<QuickChatValue | null>(null);
const KEY = "sl_advisor_profile";

export function QuickChatProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [profile, setProfileState] = useState<Profile>({});

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
    <Ctx.Provider value={{ open, setOpen, profile, setProfile, openWithProfile }}>{children}</Ctx.Provider>
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
    } as QuickChatValue;
  }
  return ctx;
}
