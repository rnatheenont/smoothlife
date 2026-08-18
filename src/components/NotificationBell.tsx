"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Award, AlertTriangle, MessageCircle, CheckCircle2, Package } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { NotificationRow } from "@/app/api/account/notifications/route";

const ICONS: Record<string, typeof Bell> = {
  points_earned: Award,
  order_cancelled: AlertTriangle,
  question_answered: MessageCircle,
  chat_resolved: CheckCircle2,
};

const POLL_MS = 60_000;

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/account/notifications");
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      // best-effort — leave whatever state we already have
    }
  }

  useEffect(() => {
    if (!user?.real) return;
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return () => clearInterval(interval);
  }, [user?.real]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function markRead(id: string) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at || new Date().toISOString() } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    fetch("/api/account/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  async function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() })));
    setUnreadCount(0);
    fetch("/api/account/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    }).catch(() => {});
  }

  function handleRowClick(n: NotificationRow) {
    if (!n.read_at) markRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  if (!user?.real) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="การแจ้งเตือน"
        className="relative flex items-center"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <span
            key={unreadCount}
            className="absolute -top-2 -right-2 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand-sky px-1 text-[10px] font-bold text-white animate-pop"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[90vw] rounded-xl2 border border-slate-100 bg-white shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="font-bold text-sm text-brand-ink">การแจ้งเตือน</span>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-semibold text-brand-emerald">
                อ่านทั้งหมด
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">ยังไม่มีการแจ้งเตือน</p>
            ) : (
              notifications.map((n) => {
                const Icon = ICONS[n.type] || Package;
                const unread = !n.read_at;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => handleRowClick(n)}
                    className={`w-full flex items-start gap-2.5 px-4 py-3 text-left border-b border-slate-50 last:border-0 hover:bg-surface-soft transition-colors ${
                      unread ? "bg-brand-gradient-soft/40" : ""
                    }`}
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald">
                      <Icon size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className={`block text-sm truncate ${unread ? "font-bold text-brand-ink" : "font-medium text-slate-600"}`}>
                          {n.title}
                        </span>
                        {unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-sky" />}
                      </span>
                      {n.body && <span className="block text-xs text-slate-500 truncate">{n.body}</span>}
                      <span className="block text-[11px] text-slate-400 mt-0.5">
                        {new Date(n.created_at).toLocaleString("th-TH")}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
