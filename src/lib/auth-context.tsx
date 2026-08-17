"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Tier = "Bronze" | "Silver" | "Gold";

export type SLUser = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  gender?: "male" | "female" | "other" | null;
  birthdate?: string | null;
  passwordHash?: string;
  provider: "email" | "phone" | "line";
  // True when this session came from the real, Supabase-backed httpOnly
  // cookie (/api/auth/session) — email, phone, and line are all real now.
  // Gate any "real backend" feature (address book, points ledger, etc.) on
  // this rather than checking `provider`.
  real: boolean;
  avatar?: string | null;
  points: number;
  tier: Tier;
  createdAt: string;
};

type AuthContextValue = {
  user: SLUser | null;
  loading: boolean;
  registerWithEmail: (name: string, phone: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  completePhoneLogin: (user: SLUser) => void;
  logout: () => void;
  addPoints: (amount: number) => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USERS_KEY = "sl_users";
const SESSION_KEY = "sl_session";
export const SHOPIFY_ADDRESS_SUGGESTION_KEY = "sl_shopify_address_suggestion";

// Auth responses can carry a one-time Shopify default-address suggestion
// (see linkOrCreateShopifyCustomer) — stash it so /account/addresses can
// offer it even if the customer doesn't act on it the moment they log in.
function stashAddressSuggestion(data: { user?: { shopifyAddressSuggestion?: unknown } }) {
  if (typeof window === "undefined") return;
  if (data.user?.shopifyAddressSuggestion) {
    localStorage.setItem(SHOPIFY_ADDRESS_SUGGESTION_KEY, JSON.stringify(data.user.shopifyAddressSuggestion));
  }
}

function readUsers(): SLUser[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}
function writeUsers(users: SLUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SLUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSession() {
    // Real accounts (email) are backed by Supabase and identified by an
    // httpOnly session cookie — check that first.
    try {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        return true;
      }
    } catch {
      // server session check failed (offline, not configured yet) — fall
      // through to the local demo session below.
    }
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId) {
      const users = readUsers();
      const found = users.find((u) => u.id === sessionId);
      if (found) {
        setUser({ ...found, real: false });
        return true;
      }
    }
    return false;
  }

  useEffect(() => {
    loadSession().finally(() => setLoading(false));
  }, []);

  async function refreshUser() {
    await loadSession();
  }

  async function registerWithEmail(name: string, phone: string, email: string, password: string) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, password }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error || "สมัครสมาชิกไม่สำเร็จ" };
    stashAddressSuggestion(data);
    setUser(data.user);
    return { ok: true };
  }

  async function loginWithEmail(email: string, password: string) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error || "เข้าสู่ระบบไม่สำเร็จ" };
    stashAddressSuggestion(data);
    setUser(data.user);
    return { ok: true };
  }

  // Phone sign-in is real now (Firebase Phone Auth + /api/auth/otp/verify
  // already set the httpOnly session cookie) — this just mirrors that
  // server-confirmed user into local state, same as register/loginWithEmail.
  function completePhoneLogin(u: SLUser & { shopifyAddressSuggestion?: unknown }) {
    stashAddressSuggestion({ user: u });
    setUser(u);
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  }

  function addPoints(amount: number) {
    if (!user) return;
    const users = readUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx === -1) return;
    const newPoints = users[idx].points + amount;
    const tier: Tier = newPoints >= 3000 ? "Gold" : newPoints >= 1000 ? "Silver" : "Bronze";
    users[idx] = { ...users[idx], points: newPoints, tier };
    writeUsers(users);
    setUser(users[idx]);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        registerWithEmail,
        loginWithEmail,
        completePhoneLogin,
        logout,
        addPoints,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
