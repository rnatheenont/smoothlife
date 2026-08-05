"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type DayResult = {
  faceDetected: boolean;
  acne: { score: number; note: string };
  darkSpots: { score: number; note: string };
  wrinkles: { score: number; note: string };
  overallNote: string;
  disclaimer: string;
};

export type DayEntry = {
  day: number; // 1-7
  capturedAt: string; // ISO timestamp
  thumbDataUrl: string; // small preview only, never full resolution
  result: DayResult;
};

type State = {
  consented: boolean;
  consentedAt: string | null;
  startedAt: string | null;
  entries: Record<number, DayEntry>;
};

type Ctx = State & {
  giveConsent: () => void;
  addEntry: (entry: DayEntry) => void;
  resetAll: () => void;
  currentDay: number; // next day the user should capture, 1-8 (8 = complete)
};

const STORAGE_KEY = "sl_glow_challenge_v1";
const EMPTY_STATE: State = { consented: false, consentedAt: null, startedAt: null, entries: {} };

const GlowCtx = createContext<Ctx | null>(null);

function load(): State {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw);
    return { ...EMPTY_STATE, ...parsed };
  } catch {
    return EMPTY_STATE;
  }
}

function save(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable — the session still works, it just won't persist
  }
}

export function GlowChallengeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  function giveConsent() {
    setState((prev) => {
      const next = { ...prev, consented: true, consentedAt: new Date().toISOString() };
      save(next);
      return next;
    });
  }

  function addEntry(entry: DayEntry) {
    setState((prev) => {
      const next: State = {
        ...prev,
        startedAt: prev.startedAt || new Date().toISOString(),
        entries: { ...prev.entries, [entry.day]: entry },
      };
      save(next);
      return next;
    });
  }

  function resetAll() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setState(EMPTY_STATE);
  }

  const days = Object.keys(state.entries).map(Number);
  const currentDay = days.length === 0 ? 1 : Math.min(8, Math.max(...days) + 1);

  const value: Ctx = { ...state, giveConsent, addEntry, resetAll, currentDay };

  // Avoid rendering consent-gated content until we've read localStorage once,
  // so we never briefly flash the consent screen for a returning user.
  if (!hydrated) return null;

  return <GlowCtx.Provider value={value}>{children}</GlowCtx.Provider>;
}

export function useGlowChallenge() {
  const ctx = useContext(GlowCtx);
  if (!ctx) throw new Error("useGlowChallenge must be used inside GlowChallengeProvider");
  return ctx;
}
