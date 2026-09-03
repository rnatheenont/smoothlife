"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, Globe, MessageCircle, Facebook, RefreshCw, CheckCheck } from "lucide-react";
import type { InboxListItem } from "@/app/api/admin/inbox/route";

// Unified inbox (plan §7.2): conversation list, thread, customer panel.
// Only the web channel exists so far — LINE and Facebook adapters write into
// the same tables, so they will appear here without this screen changing.

type Message = { id: string; sender_type: string; content: string; is_draft: boolean; created_at: string };
type Customer = {
  name: string | null;
  phone: string | null;
  email: string | null;
  tier: string | null;
  spend12mo: number | null;
  points: number | null;
  subscriptions: { id: string; product_name: string; status: string; plan_months: number; next_charge_date: string | null }[];
};

const STATUS_LABEL: Record<string, string> = {
  ai_handling: "AI กำลังตอบ",
  waiting_human: "รอทีมงานตอบ",
  assigned: "ทีมงานรับแล้ว",
  resolved: "ปิดเคสแล้ว",
};
const STATUS_DOT: Record<string, string> = {
  ai_handling: "bg-emerald-400",
  waiting_human: "bg-amber-400",
  assigned: "bg-sky-400",
  resolved: "bg-slate-300",
};
const CHANNEL_ICON: Record<string, typeof Globe> = { web: Globe, line: MessageCircle, facebook: Facebook };

const FILTERS = [
  { key: "waiting_human", label: "รอตอบ" },
  { key: "assigned", label: "รับแล้ว" },
  { key: "all", label: "ทั้งหมด" },
  { key: "resolved", label: "ปิดแล้ว" },
];

export default function AdminInboxPage() {
  const [filter, setFilter] = useState("waiting_human");
  const [conversations, setConversations] = useState<InboxListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch(`/api/admin/inbox?status=${filter}`);
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } finally {
      setLoadingList(false);
    }
  }, [filter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadThread = useCallback(async (id: string) => {
    setLoadingThread(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/inbox/${id}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setCustomer(data.customer ?? null);
    } finally {
      setLoadingThread(false);
    }
  }, []);

  function select(id: string) {
    setSelectedId(id);
    setReply("");
    loadThread(id);
  }

  async function send() {
    if (!selectedId || !reply.trim()) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/inbox/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: reply.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ส่งไม่สำเร็จ");
        return;
      }
      setReply("");
      await loadThread(selectedId);
      await loadList();
    } catch {
      setError("ส่งไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSending(false);
    }
  }

  async function setStatus(status: string) {
    if (!selectedId) return;
    await fetch(`/api/admin/inbox/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await loadList();
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-brand-ink">กล่องข้อความรวม</h1>
        <button
          onClick={loadList}
          className="flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
        >
          <RefreshCw size={13} /> รีเฟรช
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filter === f.key ? "bg-brand-gradient text-white" : "border border-slate-200 text-slate-600"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_1fr_260px]">
        {/* list */}
        <div className="min-h-0 overflow-y-auto rounded-xl2 border border-slate-100">
          {loadingList ? (
            <p className="p-4 text-xs text-slate-400">กำลังโหลด...</p>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">ไม่มีบทสนทนาในหมวดนี้</p>
          ) : (
            conversations.map((c) => {
              const Icon = CHANNEL_ICON[c.channel] ?? Globe;
              return (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  className={`flex w-full flex-col gap-1 border-b border-slate-100 p-3 text-left ${
                    c.id === selectedId ? "bg-brand-gradient-soft" : "hover:bg-surface-soft"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[c.status] ?? "bg-slate-300"}`} />
                    <Icon size={12} className="shrink-0 text-slate-400" />
                    <span className="truncate text-xs font-semibold text-brand-ink">
                      {c.customerName || c.channel_user_id.slice(0, 12)}
                    </span>
                    {c.urgency === "urgent" && (
                      <span className="ml-auto shrink-0 rounded-full bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-500">
                        ด่วน
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-[11px] text-slate-500">{c.preview || c.subject || "—"}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(c.last_message_at).toLocaleString("th-TH")}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* thread */}
        <div className="flex min-h-0 flex-col rounded-xl2 border border-slate-100">
          {!selected ? (
            <p className="grid flex-1 place-items-center text-xs text-slate-400">เลือกบทสนทนาทางซ้าย</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
                <span className="text-xs font-semibold text-slate-500">
                  {STATUS_LABEL[selected.status] ?? selected.status} · {selected.channel}
                </span>
                <button
                  onClick={() => setStatus("resolved")}
                  className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                >
                  <CheckCheck size={12} /> ปิดเคส
                </button>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                {loadingThread ? (
                  <p className="text-xs text-slate-400">กำลังโหลด...</p>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                        m.sender_type === "customer"
                          ? "bg-surface-soft text-slate-700"
                          : m.sender_type === "staff"
                            ? "ml-auto bg-brand-gradient text-white"
                            : "ml-auto bg-slate-100 text-slate-600"
                      }`}
                    >
                      {m.sender_type === "ai" && <span className="mb-0.5 block text-[10px] opacity-60">น้อง Smoothie</span>}
                      {m.content}
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-slate-100 p-3">
                {error && <p className="mb-2 text-[11px] text-rose-500">{error}</p>}
                <div className="flex gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    placeholder="พิมพ์คำตอบ..."
                    className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-teal"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !reply.trim()}
                    className="shrink-0 rounded-lg bg-brand-gradient px-3 text-white disabled:opacity-50"
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* customer panel */}
        <div className="min-h-0 overflow-y-auto rounded-xl2 border border-slate-100 p-3">
          {!selected ? (
            <p className="text-xs text-slate-400">—</p>
          ) : !customer ? (
            <p className="text-xs text-slate-400">ยังไม่รู้ว่าเป็นลูกค้าคนไหน (ยังไม่ได้ผูกบัญชี)</p>
          ) : (
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <p className="font-semibold text-brand-ink">{customer.name || "ไม่ระบุชื่อ"}</p>
                {customer.email && <p className="text-slate-500">{customer.email}</p>}
                {customer.phone && <p className="text-slate-500">{customer.phone}</p>}
              </div>
              <div className="rounded-lg bg-surface-soft p-2.5">
                <p className="text-slate-500">
                  ระดับ <span className="font-semibold text-brand-ink">{customer.tier || "—"}</span>
                </p>
                <p className="text-slate-500">
                  แต้มคงเหลือ <span className="font-semibold text-brand-ink">{customer.points ?? "—"}</span>
                </p>
                {customer.spend12mo !== null && (
                  <p className="text-slate-500">ยอดซื้อ 12 เดือน ฿{customer.spend12mo.toLocaleString()}</p>
                )}
              </div>
              <div>
                <p className="mb-1 font-semibold text-slate-500">สมาชิกรายเดือน</p>
                {customer.subscriptions.length === 0 ? (
                  <p className="text-slate-400">—</p>
                ) : (
                  customer.subscriptions.map((s) => (
                    <p key={s.id} className="text-slate-500">
                      {s.product_name} · {s.status}
                      {s.next_charge_date && ` · ตัดถัดไป ${new Date(s.next_charge_date).toLocaleDateString("th-TH")}`}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
