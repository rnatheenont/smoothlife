"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, Send, Globe, MessageCircle, Facebook, RefreshCw, CheckCheck, Sparkles, Bot, UserRound, Plus, ExternalLink, ClipboardList, ImagePlus, Languages } from "lucide-react";
import type { InboxListItem } from "@/app/api/admin/inbox/route";
import { Button } from "@/components/ui";
import { splitMarker } from "@/lib/chat-markers";
import { isTranscriptDump } from "@/lib/inbox-transcript";
import { resizeForUpload, type ResizedImage } from "@/lib/image-utils";

// Unified inbox (plan §7.2): conversation list, thread, customer panel.
// Only the web channel exists so far — LINE and Facebook adapters write into
// the same tables, so they will appear here without this screen changing.

type Message = {
  id: string;
  sender_type: string;
  content: string;
  is_draft: boolean;
  created_at: string;
  /** Short-lived signed link — the bucket is private, so this expires. */
  attachmentUrl?: string | null;
  delivered_content?: string | null;
  translation?: string | null;
};
type Canned = { id: string; title: string; content: string; category: string | null };
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

// "ทั้งหมด" leads, and is where the page opens. Landing on "รอตอบ" meant
// starting on a tab that is empty whenever the team is on top of things, which
// reads as an empty inbox rather than a cleared one.
const FILTERS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "waiting_human", label: "รอตอบ" },
  { key: "assigned", label: "รับแล้ว" },
  { key: "resolved", label: "ปิดแล้ว" },
];

// A second, independent question from the queue tabs above: not "where is this
// in the workflow" but "who is the customer talking to right now". A thread the
// bot is handling needs nobody; one a person has taken over is somebody's job
// until they finish it, and the two were mixed together under "ทั้งหมด".
const HANDLERS = [
  { key: "any", label: "ทุกคน" },
  { key: "ai", label: "AI ตอบอยู่" },
  { key: "staff", label: "ทีมงานดูแล" },
] as const;

type Handler = (typeof HANDLERS)[number]["key"];

function handlerOf(status: string): Handler {
  return status === "ai_handling" ? "ai" : status === "resolved" ? "any" : "staff";
}

// Who said it and when. The thread showed neither: staff and AI replies were
// told apart only by bubble colour, and nothing on screen said whether a
// message arrived a minute or a day ago.
// Links go both ways: staff paste a depot map, customers paste a tracking
// page or a Shopee order. Same treatment on both sides of the thread.
const URL_RE = /https?:\/\/[^\s<]+[^\s<.,:;"')\]}]/g;

function withLinks(text: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  URL_RE.lastIndex = 0;
  while ((m = URL_RE.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <a
        key={k++}
        href={m[0]}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all underline underline-offset-2"
      >
        {m[0]}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

const CHANNEL_LABEL: Record<string, string> = {
  web: "เว็บไซต์",
  line: "LINE",
  facebook: "Facebook",
};

function countFor(key: string, counts: Record<string, number>) {
  if (key === "all") return (counts.waiting_human ?? 0) + (counts.assigned ?? 0) + (counts.ai_handling ?? 0);
  return counts[key] ?? 0;
}

// "3 ชม.ที่แล้ว" answers the question staff are actually asking — how long has
// this person been waiting — which a formatted date makes them work out.
function sinceLabel(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "เมื่อครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.round(hours / 24);
  return days === 1 ? "เมื่อวาน" : `${days} วันที่แล้ว`;
}

type ProductCard = { name: string; image: string; price: number; compareAtPrice?: number };

const PRODUCT_MARKER = /\[\[([a-z0-9-]+)\]\]/gi;

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

/**
 * The same card the customer saw, without the add-to-cart button.
 *
 * Staff were reading "[[smooth-e-physical-white-extra-fluid-spf50-pa]]" and
 * having to guess which product that was; seeing what the customer was shown is
 * most of answering a question about it. Buying on their behalf is not
 * something this screen should offer, so the button is not here.
 */
function ProductCardView({ slug, card }: { slug: string; card: ProductCard }) {
  return (
    <a
      href={`/product/${slug}`}
      target="_blank"
      rel="noopener noreferrer"
      className="my-1.5 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2 no-underline hover:border-brand-200"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={card.image} alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-lg bg-surface-soft object-cover" />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[12px] font-semibold leading-snug text-brand-ink">{card.name}</span>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[12px] font-bold text-brand-emerald">{baht(card.price)}</span>
          {card.compareAtPrice ? (
            <span className="text-[10px] text-slate-400 line-through">{baht(card.compareAtPrice)}</span>
          ) : null}
        </span>
      </span>
    </a>
  );
}

function renderMessage(text: string, cards: Record<string, ProductCard>): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  PRODUCT_MARKER.lastIndex = 0;
  while ((m = PRODUCT_MARKER.exec(text))) {
    if (m.index > last) parts.push(...withLinks(text.slice(last, m.index)));
    const card = cards[m[1]];
    // An unknown slug keeps its raw marker rather than vanishing: a product
    // that has been delisted is worth noticing, not hiding.
    parts.push(card ? <ProductCardView key={`p${k++}`} slug={m[1]} card={card} /> : m[0]);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(...withLinks(text.slice(last)));
  return parts;
}

function senderLabel(sender: string) {
  if (sender === "customer") return "ลูกค้า";
  if (sender === "staff") return "ทีมงาน";
  if (sender === "ai") return "น้อง Smoothie";
  return sender;
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "วันนี้";
  const yesterday = new Date(today.getTime() - 86400000);
  if (d.toDateString() === yesterday.toDateString()) return "เมื่อวาน";
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

export default function AdminInboxPage() {
  const [filter, setFilter] = useState("all");
  const [conversations, setConversations] = useState<InboxListItem[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [handler, setHandler] = useState<Handler>("any");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [productCards, setProductCards] = useState<Record<string, ProductCard>>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<ResizedImage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [showCanned, setShowCanned] = useState(false);
  const [caseUrl, setCaseUrl] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [filingCase, setFilingCase] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(async (silent = false) => {
    if (!silent) setLoadingList(true);
    try {
      const res = await fetch(`/api/admin/inbox?status=${filter}`);
      const data = await res.json();
      setConversations(data.conversations ?? []);
      setCounts(data.counts ?? {});
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, [filter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    fetch("/api/admin/canned-responses")
      .then((r) => r.json())
      .then((d) => setCanned(d.responses ?? []))
      .catch(() => {});
  }, []);

  const loadThread = useCallback(async (id: string, silent = false) => {
    if (!silent) {
      setLoadingThread(true);
      setError("");
    }
    try {
      const res = await fetch(`/api/admin/inbox/${id}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setCustomer(data.customer ?? null);
      setProductCards(data.products ?? {});
      setCaseUrl(data.conversation?.clickup_task_url ?? null);
      setSubject(data.conversation?.subject ?? null);
    } finally {
      if (!silent) setLoadingThread(false);
    }
  }, []);

  // Prefer what the escalation recorded as the request; fall back to the first
  // thing the customer actually said. Pasted transcripts are never it.
  const caseRequest =
    subject ||
    messages.find((m) => m.sender_type === "customer" && !isTranscriptDump(m.content))?.content.slice(0, 300) ||
    null;

  function select(id: string) {
    setSelectedId(id);
    setReply("");
    loadThread(id);
  }

  async function translate(messageId: string) {
    setTranslating(messageId);
    try {
      const res = await fetch(`/api/admin/inbox/${selectedId}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const r = await res.json();
      if (r.ok) {
        setMessages((cur) => cur.map((m) => (m.id === messageId ? { ...m, translation: r.translation } : m)));
      } else {
        setError(r.error || "แปลไม่สำเร็จ");
      }
    } catch {
      setError("แปลไม่สำเร็จ");
    } finally {
      setTranslating(null);
    }
  }

  async function send() {
    if (!selectedId || (!reply.trim() && !attachment)) return;
    const text = reply.trim();
    const image = attachment;
    setSending(true);
    setError("");
    // Shown before the round trip. The reload afterwards used to blank the
    // thread to "กำลังโหลด…" and scroll it back, so every send flashed the
    // whole conversation away and staff lost their place.
    setMessages((m) => [
      ...m,
      {
        id: `pending-${Date.now()}`,
        sender_type: "staff",
        content: text,
        is_draft: false,
        created_at: new Date().toISOString(),
        attachmentUrl: image?.dataUrl ?? null,
      },
    ]);
    setReply("");
    setAttachment(null);
    try {
      const res = await fetch(`/api/admin/inbox/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          image: image ? { base64: image.base64, mediaType: image.mediaType } : undefined,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ส่งไม่สำเร็จ");
        setReply(text);
        setAttachment(image);
        return;
      }
      // Silent: reconciles the optimistic message with the stored one without
      // emptying the panel on the way.
      await loadThread(selectedId, true);
      await loadList();
    } catch {
      setError("ส่งไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSending(false);
    }
  }

  async function draftWithAi() {
    if (!selectedId) return;
    setDrafting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/inbox/${selectedId}/draft`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "ร่างคำตอบไม่สำเร็จ");
        return;
      }
      // Replaces the box rather than appending: a draft is a starting point to
      // edit, and silently merging it into half-typed text would be worse.
      setReply(data.draft);
    } catch {
      setError("ร่างคำตอบไม่สำเร็จ");
    } finally {
      setDrafting(false);
    }
  }

  async function sendToClickUp() {
    if (!selectedId) return;
    setFilingCase(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/inbox/${selectedId}/clickup`, { method: "POST" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "สร้างเคสไม่สำเร็จ");
        return;
      }
      setCaseUrl(data.url);
    } catch {
      setError("สร้างเคสไม่สำเร็จ");
    } finally {
      setFilingCase(false);
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

  // Polls instead of waiting for a click. Staff sit on this screen while a
  // customer types, so a reply that only appears on refresh is a reply they
  // answer late. Five seconds is short enough to feel live and long enough
  // that an idle tab isn't hammering the database all day.
  useEffect(() => {
    const tick = () => {
      if (document.hidden) return;
      loadList(true);
      if (selectedId) loadThread(selectedId, true);
    };
    const id = window.setInterval(tick, 5000);
    // A tab that was hidden for a while is stale the moment it comes back.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [selectedId, loadList, loadThread]);

  // Jump to the newest message. Without this a polled reply lands below the
  // fold and the thread looks unchanged.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const visible = conversations.filter((c) => handler === "any" || handlerOf(c.status) === handler);

  // Staff were closing cases on a hunch. The useful fact is that the last word
  // was ours and the customer has not come back — that is what "probably done"
  // actually looks like, and saying it beats making them read timestamps.
  const lastMsg = messages[messages.length - 1];
  const quietFor = lastMsg ? (Date.now() - new Date(lastMsg.created_at).getTime()) / 3_600_000 : 0;
  const quietHint =
    lastMsg && lastMsg.sender_type === "staff" && quietFor >= 24
      ? `ลูกค้าไม่ตอบมา ${sinceLabel(lastMsg.created_at).replace("ที่แล้ว", "")} — น่าจะปิดเคสได้`
      : null;

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  // Measured rather than calculated. This was h-[calc(100vh-8rem)], and 8rem
  // is a guess at the site header plus the admin page padding — it was short,
  // so the panel ran past the bottom of the window and the reply box was cut
  // off the screen. Reading the container's own offset gets it right whatever
  // sits above it.
  const shellRef = useRef<HTMLDivElement>(null);
  const [shellHeight, setShellHeight] = useState<number>();
  useEffect(() => {
    const measure = () => {
      const el = shellRef.current;
      if (el) setShellHeight(Math.max(420, window.innerHeight - el.getBoundingClientRect().top - 24));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div ref={shellRef} style={shellHeight ? { height: shellHeight } : undefined} className="flex flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-brand-ink">กล่องข้อความรวม</h1>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> อัปเดตอัตโนมัติทุก 5 วินาที
        </span>
        <button
          onClick={() => loadList()}
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
            {/* The number is the point of the tab: "รอตอบ 3" is a queue, "รอตอบ"
                is a place you have to click to find out. */}
            {countFor(f.key, counts) > 0 && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  filter === f.key ? "bg-white/25" : "bg-slate-100 text-slate-500"
                }`}
              >
                {countFor(f.key, counts)}
              </span>
            )}
          </button>
        ))}
        {counts.unread > 0 && (
          <span className="ml-auto self-center rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
            ยังไม่ได้อ่าน {counts.unread}
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-0.5 text-[11px] text-slate-400">กำลังคุยกับ</span>
        {HANDLERS.map((h) => {
          const n = conversations.filter((c) => h.key === "any" || handlerOf(c.status) === h.key).length;
          return (
            <button
              key={h.key}
              onClick={() => setHandler(h.key)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                handler === h.key
                  ? "border-brand-200 bg-brand-50 text-brand-800"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              {h.key === "ai" && <Bot size={11} />}
              {h.key === "staff" && <UserRound size={11} />}
              {h.label}
              {n > 0 && <span className="text-slate-400">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[280px_1fr_260px]">
        {/* list */}
        <div className="min-h-0 overflow-y-auto rounded-xl2 border border-slate-100">
          {loadingList ? (
            <p className="p-4 text-xs text-slate-400">กำลังโหลด…</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">ไม่มีบทสนทนาในหมวดนี้</p>
          ) : (
            visible.map((c) => {
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
                    <span className={`truncate text-xs ${c.unread > 0 ? "font-bold text-brand-ink" : "font-semibold text-brand-ink"}`}>
                      {c.customerName || c.channel_user_id.slice(0, 12)}
                    </span>
                    {c.unread > 0 && (
                      <span className="ml-auto shrink-0 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                        {c.unread}
                      </span>
                    )}
                    {c.unread === 0 && c.urgency === "urgent" && (
                      <span className="ml-auto shrink-0 rounded-full bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-500">
                        ด่วน
                      </span>
                    )}
                  </span>

                  {/* Where it came from. A case Smoothie could not answer is a
                      different thing from someone chatting to the bot, and the
                      channel says which of three inboxes it would have been. */}
                  <span className="flex flex-wrap items-center gap-1">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        c.origin === "escalation"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {c.origin === "escalation" ? "ส่งต่อจาก AI" : "แชทกับ AI"}
                    </span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {CHANNEL_LABEL[c.channel] ?? c.channel}
                    </span>
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                      {STATUS_LABEL[c.status] ?? c.status}
                    </span>
                  </span>

                  <span className="line-clamp-2 text-[11px] text-slate-500">{c.preview || c.subject || "—"}</span>
                  <span className="text-[10px] text-slate-400">{sinceLabel(c.last_message_at)}</span>
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
                {caseUrl ? (
                  <a
                    href={caseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 rounded-full border border-brand-teal/40 px-2.5 py-1 text-[11px] font-semibold text-brand-emerald"
                  >
                    <ExternalLink size={11} /> เปิดเคสใน ClickUp
                  </a>
                ) : (
                  <button
                    onClick={sendToClickUp}
                    disabled={filingCase}
                    className="ml-auto flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600 disabled:opacity-50"
                    title="ส่งต่อเป็นเคสที่ต้องติดตามงาน (ร้องเรียน/คืนสินค้า)"
                  >
                    {filingCase ? <Loader2 size={11} className="animate-spin" /> : <ClipboardList size={11} />}
                    ส่งต่อเป็นเคส
                  </button>
                )}
                {quietHint && (
                  <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
                    {quietHint}
                  </span>
                )}
                <button
                  onClick={() => setStatus("resolved")}
                  className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                    quietHint
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  <CheckCheck size={12} /> ปิดเคส
                </button>
              </div>

              {/* The request, pinned. The thread scrolls to the newest message,
                  so what the customer actually asked for sat at the top out of
                  view and staff had to scroll up past the whole conversation to
                  find out what the case was about. */}
              {caseRequest && (
                <div className="border-b border-amber-100 bg-amber-50/60 px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">เรื่องที่แจ้ง</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{caseRequest}</p>
                </div>
              )}

              <div className="flex-1 space-y-2.5 overflow-y-auto p-4">
                {loadingThread ? (
                  <p className="text-xs text-slate-400">กำลังโหลด…</p>
                ) : (
                  messages.map((m, i) => {
                    const fromCustomer = m.sender_type === "customer";
                    const prev = messages[i - 1];
                    const newDay = !prev || !sameDay(prev.created_at, m.created_at);
                    return (
                      <div key={m.id}>
                        {/* This thread ran across two days with nothing to say
                            so — "ก็ยังโอเคอยู่นะคะ" and the question under it
                            were a day apart and read as one exchange. */}
                        {newDay && (
                          <div className="my-3 flex items-center gap-2">
                            <span className="h-px flex-1 bg-slate-100" />
                            <span className="text-[10px] font-medium text-slate-400">{dayLabel(m.created_at)}</span>
                            <span className="h-px flex-1 bg-slate-100" />
                          </div>
                        )}
                        <div className={`flex flex-col gap-0.5 ${fromCustomer ? "items-start" : "items-end"}`}>
                          <span className="px-1 text-[10px] text-slate-400">
                            {senderLabel(m.sender_type)} · {timeLabel(m.created_at)}
                          </span>
                          {m.content === "— เรื่องใหม่จากลูกค้า —" ? (
                            <span className="my-1 w-full text-center text-[10px] font-semibold text-amber-600">
                              — เรื่องใหม่จากลูกค้า —
                            </span>
                          ) : isTranscriptDump(m.content) ? (
                            // Folded away rather than deleted. It is the chat
                            // that led here, worth keeping, but at full length
                            // it pushed the customer's actual request off the
                            // screen — staff had to scroll up to find out what
                            // the case was even about.
                            <details className="max-w-[85%] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                              <summary className="cursor-pointer select-none font-medium text-slate-500">
                                บทสนทนากับน้อง Smoothie ก่อนหน้านี้
                              </summary>
                              <p className="mt-2 whitespace-pre-wrap text-slate-500">{m.content}</p>
                            </details>
                          ) : (
                          <div
                            className={`max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap ${
                              fromCustomer
                                ? "bg-surface-soft text-slate-700"
                                : m.sender_type === "staff"
                                  ? "bg-brand-gradient text-white"
                                  : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {m.attachmentUrl && (
                              <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" title="เปิดรูปขนาดเต็ม">
                                {/* Signed URLs expire, so next/image's optimiser —
                                    which caches by URL — is the wrong tool here. */}
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={m.attachmentUrl}
                                  alt=""
                                  className="mb-1.5 max-h-40 rounded-lg border border-slate-200 object-contain"
                                />
                              </a>
                            )}
                            {/* The AI's replies still carry their trailing
                                [[ASK: ...]] marker in storage — the customer's
                                panel needs it to rebuild the answer buttons.
                                Staff should just see the question. */}
                            {renderMessage(splitMarker(m.content).text, productCards)}
                            {/* Staff should be able to see what went out in
                                their name, not just what they typed. */}
                            {/* On demand. Most threads are Thai and an agent
                                who reads English does not need this, so
                                translating every foreign message on open would
                                spend a model call on work nobody asked for. */}
                            {m.sender_type === "customer" &&
                              !m.translation &&
                              !/[\u0E00-\u0E7F]/.test(m.content) &&
                              /\p{L}/u.test(m.content) && (
                                <button
                                  onClick={() => translate(m.id)}
                                  disabled={translating === m.id}
                                  className="mt-1.5 flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-surface-soft disabled:opacity-50"
                                >
                                  {translating === m.id ? <Loader2 size={10} className="animate-spin" /> : <Languages size={10} />}
                                  {translating === m.id ? "กำลังแปล…" : "แปลเป็นไทย"}
                                </button>
                              )}
                            {m.translation && (
                              <span className="mt-1.5 block border-t border-slate-200 pt-1.5 text-[11px] text-slate-500">
                                <span className="font-semibold">แปล:</span> {m.translation}
                              </span>
                            )}
                            {m.delivered_content && (
                              <span className="mt-1.5 block border-t border-white/25 pt-1.5 text-[11px] opacity-90">
                                <span className="font-semibold">ส่งให้ลูกค้าเป็น:</span> {m.delivered_content}
                              </span>
                            )}
                          </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                {/* Scroll anchor — see the effect that pins the view here. */}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-100 p-3">
                {error && <p className="mb-2 text-[11px] text-rose-500">{error}</p>}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={draftWithAi}
                    disabled={drafting}
                    className="flex items-center gap-1 rounded-full border border-brand-teal/40 px-2.5 py-1 text-[11px] font-semibold text-brand-emerald disabled:opacity-50"
                  >
                    {drafting ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    ให้ AI ร่างคำตอบ
                  </button>
                  <button
                    onClick={() => setShowCanned((v) => !v)}
                    className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                  >
                    <Plus size={11} /> คำตอบสำเร็จรูป ({canned.length})
                  </button>
                  <button
                    onClick={() => setStatus(selected.status === "ai_handling" ? "assigned" : "ai_handling")}
                    className="flex items-center gap-1 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                    title="สลับว่าจะให้ AI ตอบต่อ หรือทีมงานดูแลเอง"
                  >
                    {selected.status === "ai_handling" ? <Bot size={11} /> : <UserRound size={11} />}
                    {selected.status === "ai_handling" ? "AI ตอบอยู่" : "ทีมงานดูแลอยู่"}
                  </button>
                </div>

                {showCanned && (
                  // Grouped and taller: thirteen replies through a 128px window
                  // is a scroll to find anything, and the category is what
                  // staff are actually looking under — "จัดส่ง", "คืนสินค้า".
                  <div className="mb-2 max-h-64 overflow-y-auto rounded-lg border border-slate-100">
                    {canned.length === 0 ? (
                      <p className="p-2 text-[11px] text-slate-400">ยังไม่มีคำตอบสำเร็จรูป</p>
                    ) : (
                      Object.entries(
                        canned.reduce<Record<string, Canned[]>>((acc, c) => {
                          const key = c.category || "ทั่วไป";
                          (acc[key] ??= []).push(c);
                          return acc;
                        }, {})
                      ).map(([category, items]) => (
                        <div key={category}>
                          <p className="sticky top-0 bg-surface-soft px-2 py-1 text-[10px] font-semibold text-slate-500">
                            {category}
                          </p>
                          {items.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                // Appended, not replaced: staff often type a
                                // name or an order number first and losing it
                                // to a template is a small daily annoyance.
                                setReply((prev) => (prev.trim() ? `${prev.trimEnd()}\n${c.content}` : c.content));
                                setShowCanned(false);
                              }}
                              className="block w-full border-b border-slate-50 p-2 text-left text-[11px] hover:bg-surface-soft"
                            >
                              <span className="font-semibold text-brand-ink">{c.title}</span>
                              <span className="line-clamp-1 text-slate-400">{c.content}</span>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {attachment && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-surface-soft p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={attachment.dataUrl} alt="" width={48} height={48} className="h-12 w-12 rounded object-cover" />
                    <span className="flex-1 text-[11px] text-slate-500">แนบรูปนี้ไปกับข้อความ</span>
                    <button
                      onClick={() => setAttachment(null)}
                      className="rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-white"
                    >
                      เอาออก
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        setAttachment(await resizeForUpload(file));
                      } catch {
                        setError("อ่านไฟล์รูปไม่สำเร็จ");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    title="แนบรูป"
                    className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-surface-soft"
                  >
                    <ImagePlus size={15} />
                  </button>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      // Enter sends, Shift+Enter starts a line. Staff answer
                      // dozens of these; reaching for the mouse every time is
                      // the slow part.
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void send();
                      }
                    }}
                    rows={2}
                    placeholder="พิมพ์คำตอบ…"
                    className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand-teal"
                  />
                  <Button
                    size="none"
                    className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg p-0"
                    onClick={send}
                    disabled={sending || (!reply.trim() && !attachment)}
                  >
                    {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-400">Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่</p>
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
