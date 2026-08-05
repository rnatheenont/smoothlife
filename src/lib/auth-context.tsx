"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { genOtp, genOrderId } from "./format";

export type Tier = "Bronze" | "Silver" | "Gold";

export type SLUser = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  passwordHash?: string;
  provider: "email" | "phone" | "line";
  avatar?: string;
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
  registerWithEmail: (name: string, email: string, password: string) => { ok: boolean; error?: string };
  loginWithEmail: (email: string, password: string) => { ok: boolean; error?: string };
  requestOtp: (phone: string) => string;
  verifyOtp: (phone: string, code: string, expected: string, name?: string) => { ok: boolean; error?: string };
  loginWithLine: (displayName: string) => void;
  logout: () => void;
  addOrder: (order: Omit<SLOrder, "id" | "userId" | "createdAt" | "status">) => SLOrder;
  getOrders: () => SLOrder[];
  addPoints: (amount: number) => void;
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

  useEffect(() => {
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId) {
      const users = readUsers();
      const found = users.find((u) => u.id === sessionId);
      if (found) setUser(found);
    }
    setLoading(false);
  }, []);

  function persistSession(u: SLUser) {
    setUser(u);
    localStorage.setItem(SESSION_KEY, u.id);
  }

  function registerWithEmail(name: string, email: string, password: string) {
    const users = readUsers();
    if (users.some((u) => u.email === email)) {
      return { ok: false, error: "อีเมลนี้ถูกใช้งานแล้ว กรุณาเข้าสู่ระบบ" };
    }
    const newUser: SLUser = {
      id: crypto.randomUUID(),
      name,
      email,
      passwordHash: simpleHash(password),
      provider: "email",
      points: 100,
      tier: "Bronze",
      createdAt: new Date().toISOString(),
    };
    const updated = [...users, newUser];
    writeUsers(updated);
    persistSession(newUser);
    return { ok: true };
  }

  function loginWithEmail(email: string, password: string) {
    const users = readUsers();
    const found = users.find((u) => u.email === email);
    if (!found) return { ok: false, error: "ไม่พบบัญชีนี้ กรุณาสมัครสมาชิกก่อน" };
    if (found.passwordHash !== simpleHash(password)) {
      return { ok: false, error: "รหัสผ่านไม่ถูกต้อง" };
    }
    persistSession(found);
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
