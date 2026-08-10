"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { genOtp, genOrderId } from "./format";

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
  avatar?: string | null;
  points: number;
  tier: Tier;
  createdAt: string;
};

export type SLOrder = {
  id: string;
  userId: string;
  items: { slug: string; name: string; qty: number; price: number; image: string }[];
  total: number;
  status: "Processing" | "Shipped" | "Delivered";
  createdAt: string;
  address: string;
  paymentMethod: string;
  coupon?: string;
  discount?: number;
  pointsEarned?: number;
};

type AuthContextValue = {
  user: SLUser | null;
  loading: boolean;
  registerWithEmail: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithEmail: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  requestOtp: (phone: string) => string;
  verifyOtp: (phone: string, code: string, expected: string, name?: string) => { ok: boolean; error?: string };
  loginWithLine: (displayName: string) => void;
  logout: () => void;
  addOrder: (order: Omit<SLOrder, "id" | "userId" | "createdAt" | "status">) => SLOrder;
  getOrders: () => SLOrder[];
  addPoints: (amount: number) => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const USERS_KEY = "sl_users";
const SESSION_KEY = "sl_session";
const ORDERS_KEY = "sl_orders";

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
function simpleHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(36);
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
        setUser(found);
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

  function persistSession(u: SLUser) {
    setUser(u);
    localStorage.setItem(SESSION_KEY, u.id);
  }

  async function registerWithEmail(name: string, email: string, password: string) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!data.ok) return { ok: false, error: data.error || "สมัครสมาชิกไม่สำเร็จ" };
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
    setUser(data.user);
    return { ok: true };
  }

  function requestOtp(_phone: string) {
    return genOtp();
  }

  function verifyOtp(phone: string, code: string, expected: string, name?: string) {
    if (code !== expected) {
      return { ok: false, error: "รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่" };
    }
    const users = readUsers();
    let found = users.find((u) => u.phone === phone);
    if (!found) {
      found = {
        id: crypto.randomUUID(),
        name: name || `คุณ ${phone.slice(-4)}`,
        phone,
        provider: "phone",
        points: 100,
        tier: "Bronze",
        createdAt: new Date().toISOString(),
      };
      writeUsers([...users, found]);
    }
    persistSession(found);
    return { ok: true };
  }

  function loginWithLine(displayName: string) {
    const users = readUsers();
    const lineId = `line_${simpleHash(displayName)}`;
    let found = users.find((u) => u.id === lineId);
    if (!found) {
      found = {
        id: lineId,
        name: displayName,
        provider: "line",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + encodeURIComponent(displayName),
        points: 150,
        tier: "Bronze",
        createdAt: new Date().toISOString(),
      };
      writeUsers([...users, found]);
    }
    persistSession(found);
  }

  function logout() {
    setUser(null);
    localStorage.removeItem(SESSION_KEY);
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  }

  function addOrder(order: Omit<SLOrder, "id" | "userId" | "createdAt" | "status">) {
    const all: SLOrder[] = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    const newOrder: SLOrder = {
      ...order,
      id: genOrderId(),
      userId: user?.id || "guest",
      createdAt: new Date().toISOString(),
      status: "Processing",
    };
    localStorage.setItem(ORDERS_KEY, JSON.stringify([newOrder, ...all]));
    addPoints(order.pointsEarned !== undefined ? order.pointsEarned : Math.floor(order.total / 100));
    return newOrder;
  }

  function getOrders() {
    if (!user) return [];
    const all: SLOrder[] = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    return all.filter((o) => o.userId === user.id);
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
        requestOtp,
        verifyOtp,
        loginWithLine,
        logout,
        addOrder,
        getOrders,
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
