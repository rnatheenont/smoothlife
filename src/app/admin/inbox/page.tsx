"use client";

import clsx from "clsx";
import CustomerPanel, {
  type Customer,
  type Insight,
} from "@/components/admin/inbox/CustomerPanel";
import IconButton from "@/components/admin/IconButton";
import AlertSettings from "@/components/admin/inbox/AlertSettings";
import ChannelBadge from "@/components/admin/inbox/ChannelBadge";
import CustomerAvatar from "@/components/admin/inbox/CustomerAvatar";
import {
  useInboxLayout,
  ColumnResizer,
  LIST_MIN,
  LIST_MAX,
  PANEL_MIN,
  PANEL_MAX,
} from "@/components/admin/inbox/layout";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Loader2,
  Send,
  RefreshCw,
  CheckCheck,
  Sparkles,
  Bot,
  UserRound,
  Plus,
  ExternalLink,
  ClipboardList,
  ImagePlus,
  Languages,
  BookOpen,
  Check,
  Inbox,
  ChevronLeft,
  ArrowUpRight,
  PanelRight,
  PanelRightClose,
  BellRing,
} from "lucide-react";
import type { InboxListItem } from "@/app/api/admin/inbox/route";
import { Button } from "@/components/ui";
import { splitMarker } from "@/lib/chat-markers";
import { isTranscriptDump } from "@/lib/inbox-transcript";
import { resizeForUpload, type ResizedImage } from "@/lib/image-utils";
import { useAdminAction } from "@/components/admin/header-action";

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
// The same four states as a stripe down the edge of a row. Stronger than the
// dot was: it is read at a glance down a column, not looked at.
const STATUS_STRIPE: Record<string, string> = {
  ai_handling: "bg-emerald-500",
  waiting_human: "bg-amber-500",
  assigned: "bg-sky-500",
  resolved: "bg-transparent",
};

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
      </a>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}


function countFor(key: string, counts: Record<string, number>) {
  // "ทั้งหมด" fetches every thread, resolved included (see the API route), so
  // its badge has to count them all: it read 1 above a list of six.
  if (key === "all")
    return (counts.waiting_human ?? 0) + (counts.assigned ?? 0) + (counts.ai_handling ?? 0) + (counts.resolved ?? 0);
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

type ProductCard = { name: string; image: string; price: number; compareAtPrice?: number; inStock?: boolean };

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
      <img
        src={card.image}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 shrink-0 rounded-lg bg-surface-soft object-cover"
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[12px] font-semibold leading-snug text-brand-ink">{card.name}</span>
        <span className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[12px] font-bold text-brand-800">{baht(card.price)}</span>
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
  const [insight, setInsight] = useState<Insight | null>(null);
  const [discussedSlugs, setDiscussedSlugs] = useState<string[]>([]);
  const [viewedSlugs, setViewedSlugs] = useState<string[]>([]);
  const [urgency, setUrgency] = useState<"normal" | "urgent">("normal");
  const { layout, setList, setPanel, togglePanel } = useInboxLayout();
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [reply, setReply] = useState("");
  const [attachment, setAttachment] = useState<ResizedImage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  // A reply bound for a customer who doesn't write Thai goes through here
  // first — staff see exactly what will land in the customer's language
  // before it's irreversible, and can edit it right there.
  const [checkingTranslation, setCheckingTranslation] = useState(false);
  const [pendingTranslation, setPendingTranslation] = useState<{ original: string; translated: string } | null>(
    null,
  );
  const [translating, setTranslating] = useState<string | null>(null);
  // Answers already promoted into the knowledge base in this session, so the
  // button says so instead of quietly making a second draft of the same thing.
  const [promoting, setPromoting] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<string[]>([]);
  const [drafting, setDrafting] = useState(false);
  const [canned, setCanned] = useState<Canned[]>([]);
  const [showCanned, setShowCanned] = useState(false);
  const [caseUrl, setCaseUrl] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [filingCase, setFilingCase] = useState(false);
  const [error, setError] = useState("");
  /**
   * Turn one reply into a draft article: the answer, plus the customer message
   * it answered, which is how the question gets phrased in a real thread.
   */
  const promoteToKb = async (message: Message) => {
    const index = messages.findIndex((m) => m.id === message.id);
    const question = [...messages.slice(0, index)].reverse().find((m) => m.sender_type === "customer")?.content ?? "";
    setPromoting(message.id);
    setError("");
    try {
      const res = await fetch("/api/admin/kb/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: splitMarker(question).text,
          answer: splitMarker(message.delivered_content || message.content).text,
          conversationId: selectedId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "บันทึกเข้าฐานความรู้ไม่สำเร็จ");
      setPromoted((ids) => [...ids, message.id]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกเข้าฐานความรู้ไม่สำเร็จ");
    } finally {
      setPromoting(null);
    }
  };

  const bottomRef = useRef<HTMLDivElement>(null);

  const loadList = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingList(true);
      try {
        const res = await fetch(`/api/admin/inbox?status=${filter}`);
        const data = await res.json();
        setConversations(data.conversations ?? []);
        setCounts(data.counts ?? {});
      } finally {
        if (!silent) setLoadingList(false);
      }
    },
    [filter],
  );

  useEffect(() => {
    loadList();
  }, [loadList]);

  useAdminAction({
    label: "รีเฟรชกล่องข้อความ",
    icon: <RefreshCw size={15} className={loadingList ? "animate-spin" : ""} aria-hidden />,
    onClick: () => loadList(),
    disabled: loadingList,
  });

  useEffect(() => {
    fetch("/api/admin/canned-responses")
      .then((r) => r.json())
      .then((d) => setCanned(d.responses ?? []))
      .catch(() => {});
  }, []);

  /** Raise the flag the inbox list has always known how to draw. The column
   *  and the badge shipped with the first version of this screen; until now
   *  nothing in the product ever set it, so it was a lamp with no switch. */
  const flagUrgent = useCallback(async () => {
    if (!selectedId) return;
    const res = await fetch(`/api/admin/inbox/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urgency: "urgent" }),
    });
    if (!res.ok) return;
    setUrgency("urgent");
    // The list draws the "ด่วน" badge off its own copy of the row.
    loadList();
  }, [selectedId, loadList]);

  /** Drop a product into the reply as the marker that renders its card, so
   *  nobody has to remember a slug and type it by hand. */
  const insertProduct = useCallback((slug: string) => {
    setReply((current) => (current.trimEnd() ? `${current.trimEnd()}\n[[${slug}]]` : `[[${slug}]]`));
  }, []);

  /** `read` is whether this load counts as a person looking at the thread.
   *  The five-second poll passes false — see the GET handler for why. */
  const loadThread = useCallback(async (id: string, silent = false, read = true) => {
    if (!silent) {
      setLoadingThread(true);
      setError("");
    }
    try {
      const res = await fetch(`/api/admin/inbox/${id}${read ? "" : "?read=0"}`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setCustomer(data.customer ?? null);
      setProductCards(data.products ?? {});
      setInsight(data.insight ?? null);
      setDiscussedSlugs(data.discussedSlugs ?? []);
      setViewedSlugs(data.viewedSlugs ?? []);
      setUrgency(data.conversation?.urgency === "urgent" ? "urgent" : "normal");
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

  // The actual send. `deliveredOverride` is what staff saw and approved in
  // the translation preview — passing it tells the server "this exact text,
  // don't translate again", so what staff confirmed is word-for-word what
  // goes out, not a second independent translation of the same reply.
  async function doSend(text: string, image: ResizedImage | null, deliveredOverride?: string) {
    if (!selectedId) return;
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
    setPendingTranslation(null);
    try {
      const res = await fetch(`/api/admin/inbox/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          image: image ? { base64: image.base64, mediaType: image.mediaType } : undefined,
          deliveredOverride,
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

  // What the "ส่ง" button and Enter actually call. A reply with no text (a
  // photo on its own) or one already confirmed in the preview panel sends
  // straight away; anything else is checked first in case it needs
  // translating, so staff see that before it reaches the customer, not after.
  async function send() {
    if (!selectedId || (!reply.trim() && !attachment)) return;
    const text = reply.trim();
    const image = attachment;
    if (!text) return doSend(text, image);
    setCheckingTranslation(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/inbox/${selectedId}/preview-translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      const data = await res.json();
      if (data.ok && data.translated) {
        // Held for confirmation — see the panel in the composer below.
        setPendingTranslation({ original: text, translated: data.translated });
        return;
      }
    } catch {
      // A failed check must never block a reply: fall through and send as
      // typed. The server translates again on the way out regardless, so
      // nothing here was the only chance to get it right.
    } finally {
      setCheckingTranslation(false);
    }
    await doSend(text, image);
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
      if (selectedId) loadThread(selectedId, true, false);
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
      {/* One band instead of two rows that did the same kind of job in two
          different styles — status above, "กำลังคุยกับ" below, with the view
          controls stranded up in the title row. Everything that changes what
          the list shows now sits together on the left, and everything that
          changes what the screen shows sits together on the right. */}
      <div className="mb-3 flex items-center gap-2 rounded-xl2 border border-slate-100 bg-white px-2 py-2 md:gap-3 md:px-3">
        {/* Not PageHeader: this screen measures its own height and fills it
            with three panes, so the subtitle every other page carries would
            come straight out of the conversation list. Gone on a phone, where
            the breadcrumb directly above says the same word and a line of
            screen is worth more than saying it twice. */}
        <h1 className="hidden shrink-0 items-center gap-1.5 text-base font-bold text-brand-ink md:flex">
          <Inbox size={17} className="text-brand-emerald" /> กล่องข้อความ
        </h1>

        <span className="hidden h-5 w-px bg-surface-line md:block" />

        {/* One strip that scrolls sideways on a phone rather than wrapping to
            three rows. The controls on the right stay put while it does. */}
        <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
          <div className="flex w-max items-center gap-1 md:gap-3">
        <div role="group" aria-label="กรองตามสถานะ" className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f.key
                  ? "bg-brand-gradient text-white"
                  : "text-slate-600 hover:bg-surface-soft"
              }`}
            >
              {f.label}
              {/* The number is the point of the tab: "รอตอบ 3" is a queue,
                  "รอตอบ" is a place you have to click to find out. */}
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
        </div>

        <span className="h-5 w-px shrink-0 bg-surface-line" />

        {/* The label that used to float in front of these is their group name
            now: it told the eye nothing it could not get from the options. */}
        <div role="group" aria-label="กรองตามผู้ที่กำลังดูแล" className="flex gap-1">
          {HANDLERS.map((h) => {
            const n = conversations.filter((c) => h.key === "any" || handlerOf(c.status) === h.key).length;
            return (
              <button
                key={h.key}
                onClick={() => setHandler(h.key)}
                aria-pressed={handler === h.key}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  handler === h.key
                    ? "bg-brand-50 text-brand-800"
                    : "text-slate-500 hover:bg-surface-soft"
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

          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <span
            title="อัปเดตอัตโนมัติทุก 5 วินาที"
            className="hidden h-1.5 w-1.5 rounded-full bg-emerald-400 sm:block"
          />
          {counts.unread > 0 && (
            <span
              title={`ยังไม่ได้อ่าน ${counts.unread} ข้อความ`}
              className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-600"
            >
              <span className="hidden sm:inline">ยังไม่ได้อ่าน </span>
              {counts.unread}
            </span>
          )}
          <IconButton
            label="ตั้งค่าปลายทางแจ้งเตือน"
            icon={<BellRing size={15} />}
            pressed={showAlertSettings}
            onClick={() => setShowAlertSettings((v) => !v)}
          />
          <span className="hidden lg:inline-flex">
            <IconButton
              label={layout.panelHidden ? "แสดงข้อมูลลูกค้า" : "ซ่อนข้อมูลลูกค้า"}
              icon={layout.panelHidden ? <PanelRight size={15} /> : <PanelRightClose size={15} />}
              pressed={layout.panelHidden}
              onClick={togglePanel}
            />
          </span>
        </div>
      </div>

      {showAlertSettings && <AlertSettings onClose={() => setShowAlertSettings(false)} />}

      {/* The two outer columns are dragged to whatever width the person using
          them wants and remembered per browser (see ./layout). They started at
          a fixed 320 and 300, which was a guess: a long Thai product name
          wraps to three lines in the list, and on a wide monitor the thread in
          the middle gets a measure nobody wants to read. Below lg the grid
          collapses and the widths do not apply. */}
      <div
        className="grid min-h-0 flex-1 gap-3 lg:[grid-template-columns:var(--inbox-cols)]"
        style={
          {
            "--inbox-cols": `minmax(0,${layout.list}px) minmax(0,1fr)${
              layout.panelHidden ? "" : ` minmax(0,${layout.panel}px)`
            }`,
          } as React.CSSProperties
        }
      >
        {/* Three panes side by side is a desktop idea. On a phone they became
            three 200px boxes stacked down a 1,900px page, each with its own
            scrollbar — so below lg this behaves like every chat app: the list,
            and then the thread once you pick one, with a way back. */}
        <div
          className={clsx("relative min-h-0", selectedId && "hidden lg:block")}
        >
          <ColumnResizer
            edge="right"
            width={layout.list}
            min={LIST_MIN}
            max={LIST_MAX}
            onResize={setList}
            label="ปรับความกว้างรายการแชท"
          />
          <div className="h-full overflow-y-auto rounded-xl2 bg-white shadow-card">
          {loadingList ? (
            <p className="p-4 text-xs text-slate-400">กำลังโหลด…</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">ไม่มีบทสนทนาในหมวดนี้</p>
          ) : (
            visible.map((c) => {
              return (
                <button
                  key={c.id}
                  onClick={() => select(c.id)}
                  // Each thing a row has to say gets a place of its own: the
                  // state is the stripe, the channel is the badge on the
                  // avatar, the name is the name, and the second line is all
                  // preview. It used to be a chip plus whatever preview fitted
                  // after it — and since nearly every conversation here arrives
                  // from the assistant, that chip was on every row, pushing the
                  // one thing that differs between them off the end of the line.
                  className={`relative flex w-full items-start gap-2.5 border-b border-slate-100 py-2.5 pe-3 ps-4 text-left ${
                    c.id === selectedId ? "bg-brand-gradient-soft" : "hover:bg-surface-soft"
                  }`}
                >
                  <span
                    aria-hidden
                    title={STATUS_LABEL[c.status] ?? c.status}
                    className={`absolute inset-y-0 start-0 w-[3px] ${STATUS_STRIPE[c.status] ?? "bg-transparent"}`}
                  />
                  <span className="relative shrink-0">
                    <CustomerAvatar
                      name={c.customerName}
                      src={c.customerAvatar}
                      seed={c.channel_user_id}
                      size={32}
                    />
                    {/* On the avatar, the way every chat app says which app a
                        message came through. */}
                    <ChannelBadge
                      channel={c.channel}
                      compact
                      className="absolute -bottom-0.5 -end-0.5 ring-2 ring-white"
                    />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      {c.origin === "escalation" && (
                        // A mark, not a pill: it is on nearly every row, so it
                        // has to cost almost nothing. The tooltip is what makes
                        // it legible the first time someone wonders.
                        <span title="ส่งต่อจาก AI" aria-label="ส่งต่อจาก AI" className="shrink-0">
                          <ArrowUpRight size={13} aria-hidden className="text-amber-500" />
                        </span>
                      )}
                      <span
                        className={`min-w-0 truncate text-[13px] ${c.unread > 0 ? "font-bold text-brand-ink" : "font-semibold text-brand-ink"}`}
                      >
                        {c.customerName || c.channel_user_id.slice(0, 12)}
                      </span>
                      {c.urgency === "urgent" && (
                        <span className="shrink-0 rounded-full bg-rose-50 px-1.5 text-[10px] font-semibold text-rose-500">
                          ด่วน
                        </span>
                      )}
                      {c.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                          {c.unread}
                        </span>
                      )}
                      <span className="ms-auto shrink-0 text-[10px] text-slate-500">
                        {sinceLabel(c.last_message_at)}
                      </span>
                    </span>
                    {/* The whole line: the only part of a row that says what
                        this conversation is actually about. */}
                    <span className="min-w-0 truncate text-xs text-slate-500">
                      {c.preview || c.subject || "—"}
                    </span>
                  </span>
                </button>
              );
            })
          )}
          </div>
        </div>

        {/* thread */}
        <div
          className={clsx(
            // White, like the list and the customer panel. It was a tinted
            // panel to rank it below them, which inverted the hierarchy: the
            // thread is the work, and on a tint the message bubbles — one of
            // them the same tint — had nothing to stand on. It reads as the
            // main surface because it is the widest and the only one with
            // bubbles on it, not because it is a different colour.
            "flex min-h-0 flex-col rounded-xl2 bg-white shadow-card",
            !selectedId && "hidden lg:flex",
          )}
        >
          {!selected ? (
            <p className="grid flex-1 place-items-center text-xs text-slate-400">เลือกบทสนทนาทางซ้าย</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-surface-line px-4 py-2.5">
                {/* The way back, which a phone has no other way to offer. */}
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="-ml-1 flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-brand-800 hover:bg-surface-soft lg:hidden"
                >
                  <ChevronLeft size={14} /> รายการ
                </button>
                <span className="text-xs font-semibold text-slate-500">
                  {STATUS_LABEL[selected.status] ?? selected.status} · {selected.channel}
                </span>
                {caseUrl ? (
                  <a
                    href={caseUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto flex items-center gap-1 rounded-full border border-brand-teal/40 px-2.5 py-1 text-[11px] font-semibold text-brand-800"
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
                    quietHint ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600"
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
                <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">เรื่องที่แจ้ง</p>
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
                            <span className="text-[10px] font-medium text-slate-500">{dayLabel(m.created_at)}</span>
                            <span className="h-px flex-1 bg-slate-100" />
                          </div>
                        )}
                        <div className={`flex flex-col gap-0.5 ${fromCustomer ? "items-start" : "items-end"}`}>
                          <span className="px-1 text-[10px] text-slate-500">
                            {senderLabel(m.sender_type)} · {timeLabel(m.created_at)}
                          </span>
                          {m.content === "— เรื่องใหม่จากลูกค้า —" ? (
                            <span className="my-1 flex w-full items-center gap-2">
                              <span className="h-px flex-1 bg-amber-200" />
                              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                เรื่องใหม่จากลูกค้า
                              </span>
                              <span className="h-px flex-1 bg-amber-200" />
                            </span>
                          ) : isTranscriptDump(m.content) ? (
                            // Folded away rather than deleted. It is the chat
                            // that led here, worth keeping, but at full length
                            // it pushed the customer's actual request off the
                            // screen — staff had to scroll up to find out what
                            // the case was even about.
                            <details className="max-w-[85%] rounded-xl border border-surface-line bg-surface-soft px-3 py-2 text-xs xl:max-w-[68ch]">
                              <summary className="cursor-pointer select-none font-medium text-slate-500">
                                บทสนทนากับน้อง Smoothie ก่อนหน้านี้
                              </summary>
                              <p className="mt-2 whitespace-pre-wrap text-slate-500">{m.content}</p>
                            </details>
                          ) : (
                            <div
                              className={`max-w-[85%] rounded-xl px-3 py-2 text-xs whitespace-pre-wrap xl:max-w-[68ch] ${
                                fromCustomer
                                  ? // Incoming: a plain fill, the quietest of
                                    // the three. It used to be surface-soft,
                                    // the panel's own colour, so the bubble
                                    // was invisible and the words floated.
                                    // The hairline is what gives it an edge:
                                    // a fill this close to white (1.12:1) is
                                    // a shape you see by its border.
                                    "bg-surface-muted text-slate-700 ring-1 ring-surface-line"
                                  : m.sender_type === "staff"
                                    ? // A person from the team. Solid brand
                                      // rather than the gradient: the gradient
                                      // ends on #00aeef, where white 12px text
                                      // sits at about 2.3:1 — under half of
                                      // what WCAG AA asks for. brand-800 with
                                      // white clears 7:1.
                                      "bg-brand-800 text-white"
                                    : // The assistant. Ours, but not a person,
                                      // so it is brand-tinted instead of brand
                                      // — and no longer the same grey as the
                                      // customer's bubble.
                                      "bg-brand-50 text-brand-ink ring-1 ring-brand-100"
                              }`}
                            >
                              {m.attachmentUrl && (
                                <a
                                  href={m.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="เปิดรูปขนาดเต็ม"
                                >
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
                                    {translating === m.id ? (
                                      <Loader2 size={10} className="animate-spin" />
                                    ) : (
                                      <Languages size={10} />
                                    )}
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
                              {/* A real question with an answer a person already
                                approved is the best thing the knowledge base
                                can be fed — one tap files it as a draft. */}
                              {!fromCustomer && !m.is_draft && m.content.trim().length > 20 && (
                                <button
                                  onClick={() => promoteToKb(m)}
                                  disabled={promoting === m.id || promoted.includes(m.id)}
                                  title="เก็บคำตอบนี้ไว้ให้ AI ใช้ตอบครั้งหน้า (บันทึกเป็นฉบับร่าง)"
                                  className={`mt-1.5 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    m.sender_type === "staff"
                                      ? "bg-white/20 text-white hover:bg-white/30"
                                      : "border border-slate-200 bg-white text-slate-500 hover:bg-surface-soft"
                                  } disabled:opacity-60`}
                                >
                                  {promoting === m.id ? (
                                    <Loader2 size={10} className="animate-spin" />
                                  ) : promoted.includes(m.id) ? (
                                    <Check size={10} />
                                  ) : (
                                    <BookOpen size={10} />
                                  )}
                                  {promoted.includes(m.id) ? "เก็บเป็นฉบับร่างแล้ว" : "เพิ่มเข้าฐานความรู้"}
                                </button>
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

              <div className="border-t border-surface-line bg-surface-soft/60 p-3">
                {error && <p className="mb-2 text-[11px] text-rose-500">{error}</p>}
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <button
                    onClick={draftWithAi}
                    disabled={drafting}
                    className="flex items-center gap-1 rounded-full border border-brand-teal/40 px-2.5 py-1 text-[11px] font-semibold text-brand-800 disabled:opacity-50"
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
                  <div className="mb-2 max-h-64 overflow-y-auto rounded-lg border border-slate-100 bg-white">
                    {canned.length === 0 ? (
                      <p className="p-2 text-[11px] text-slate-400">ยังไม่มีคำตอบสำเร็จรูป</p>
                    ) : (
                      Object.entries(
                        canned.reduce<Record<string, Canned[]>>((acc, c) => {
                          const key = c.category || "ทั่วไป";
                          (acc[key] ??= []).push(c);
                          return acc;
                        }, {}),
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

                {pendingTranslation && (
                  <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                    <p className="text-[10px] font-semibold text-amber-800">
                      ลูกค้าคุยเป็นภาษาอื่น — นี่คือข้อความที่จะส่งไปจริง ๆ (แก้ไขได้ก่อนส่ง)
                    </p>
                    <p className="mt-1.5 text-[10px] text-slate-500">ที่พิมพ์ไว้: {pendingTranslation.original}</p>
                    <textarea
                      value={pendingTranslation.translated}
                      onChange={(e) =>
                        setPendingTranslation((p) => (p ? { ...p, translated: e.target.value } : p))
                      }
                      rows={2}
                      className="mt-1.5 w-full resize-none rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs outline-hidden focus:border-brand-teal"
                    />
                    <div className="mt-1.5 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPendingTranslation(null)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-white"
                      >
                        แก้ไขคำตอบเอง
                      </button>
                      <Button
                        size="none"
                        className="rounded-full px-3 py-1 text-[11px]"
                        disabled={sending || !pendingTranslation.translated.trim()}
                        onClick={() => doSend(pendingTranslation.original, attachment, pendingTranslation.translated)}
                      >
                        ส่งข้อความนี้
                      </Button>
                    </div>
                  </div>
                )}

                {attachment && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-surface-soft p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={attachment.dataUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 rounded-sm object-cover"
                    />
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
                    disabled={!!pendingTranslation}
                    rows={2}
                    placeholder="พิมพ์คำตอบ…"
                    className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-xs outline-hidden focus:border-brand-teal disabled:bg-surface-soft disabled:text-slate-400"
                  />
                  <Button
                    size="none"
                    className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg p-0"
                    onClick={send}
                    disabled={sending || checkingTranslation || !!pendingTranslation || (!reply.trim() && !attachment)}
                  >
                    {sending || checkingTranslation ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                  </Button>
                </div>
                <p className="mt-1.5 text-[10px] text-slate-500">Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่</p>
              </div>
            </>
          )}
        </div>

        {/* customer panel */}
        <div
          className={clsx(
            "relative min-h-0",
            !selectedId && "hidden lg:block",
            // Hidden only on desktop: below lg this is its own view, reached
            // by picking a conversation, and there is no column to reclaim.
            layout.panelHidden && "lg:hidden",
          )}
        >
          <ColumnResizer
            edge="left"
            width={layout.panel}
            min={PANEL_MIN}
            max={PANEL_MAX}
            onResize={setPanel}
            label="ปรับความกว้างข้อมูลลูกค้า"
          />
          <div className="h-full overflow-y-auto rounded-xl2 bg-white p-3 shadow-card">
          {!selected ? (
            <p className="text-xs text-slate-400">—</p>
          ) : (
            <CustomerPanel
              conversationId={selected.id}
              customer={customer}
              insight={insight}
              products={productCards}
              discussedSlugs={discussedSlugs}
              viewedSlugs={viewedSlugs}
              urgency={urgency}
              onInsight={setInsight}
              onFlagUrgent={flagUrgent}
              onInsertProduct={insertProduct}
            />
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
