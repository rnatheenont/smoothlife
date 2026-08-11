"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Send, Loader2, RotateCcw, User as UserIcon, X, Plus, Check, Camera, ImagePlus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useQuickChat } from "@/lib/quickchat-context";
import { useCart } from "@/lib/cart-context";
import { getProductBySlug } from "@/data/products";
import { formatTHB } from "@/lib/format";
import { resizeForUpload, ResizedImage } from "@/lib/image-utils";
import { hasStoredConsent, grantConsent } from "@/components/skin-coach/ConsentGate";

type Msg = { role: "user" | "assistant"; content: string; image?: string };

// Matches the [[slug]] markers the model is told to use, but also tolerates
// a stray single-bracket [slug] (models occasionally drop a bracket) and
// bare /product/slug links, so a product card still renders instead of
// leaking raw marker text into the chat bubble.
const MARKER = /\[\[([a-z0-9-]+)\]\]|\[([a-z0-9]+(?:-[a-z0-9]+)+)\]|\/product\/([a-z0-9-]+)/gi;

// Lightweight markdown-bold support (**text**) so an occasional ** from the
// model renders as bold instead of showing the literal asterisks — the chat
// bubble is plain whitespace-pre-wrap text, not a markdown renderer.
const BOLD = /\*\*(.+?)\*\*/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  let bm: RegExpExecArray | null;
  BOLD.lastIndex = 0;
  let k = 0;
  while ((bm = BOLD.exec(text))) {
    if (bm.index > last) parts.push(text.slice(last, bm.index));
    parts.push(<strong key={`${keyPrefix}b${k++}`}>{bm[1]}</strong>);
    last = bm.index + bm[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function ProductChip({ slug }: { slug: string }) {
  const product = getProductBySlug(slug);
  const { addItem } = useCart();
  const { t } = useLang();
  const [added, setAdded] = useState(false);
  if (!product) return null;

  return (
    <div className="my-2 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <Link href={`/product/${product.slug}`} className="shrink-0 relative h-14 w-14 block">
        <Image
          src={product.image}
          alt={product.name}
          fill
          className="rounded-lg object-cover bg-surface-soft"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          href={`/product/${product.slug}`}
          className="block text-[12px] font-semibold leading-snug text-brand-ink line-clamp-2 hover:text-brand-emerald"
        >
          {product.name}
        </Link>
        <div className="mt-0.5 flex items-baseline gap-1.5">
          <span className="text-[12px] font-bold text-brand-emerald">{formatTHB(product.price)}</span>
          {product.compareAtPrice ? (
            <span className="text-[10px] text-slate-400 line-through">{formatTHB(product.compareAtPrice)}</span>
          ) : null}
        </div>
      </div>
      <button
        onClick={() => {
          addItem(product.slug, 1);
          setAdded(true);
        }}
        aria-label={t("เพิ่มลงตะกร้า", "Add to cart")}
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-white transition-colors ${
          added ? "bg-slate-300" : "bg-brand-gradient"
        }`}
      >
        {added ? <Check size={15} /> : <Plus size={15} />}
      </button>
    </div>
  );
}

function renderContent(text: string) {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MARKER.lastIndex = 0;
  let key = 0;
  while ((m = MARKER.exec(text))) {
    // ProductChip already carries its own top/bottom margin, so any blank
    // lines the model left right next to a marker would double up the gap —
    // trim newline runs at both ends of each text segment, not just one.
    const before = text.slice(last, m.index).replace(/^\n+|\n+$/g, "");
    if (before) out.push(<span key={`t${key}`}>{renderInline(before, `t${key++}`)}</span>);
    out.push(<ProductChip key={`p${key++}`} slug={m[1] || m[2] || m[3]} />);
    last = m.index + m[0].length;
  }
  const tail = text.slice(last).replace(/^\n+/, "");
  if (tail) out.push(<span key={`t${key}`}>{renderInline(tail, `t${key++}`)}</span>);
  return out;
}

export default function QuickChat() {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const { open, setOpen, profile } = useQuickChat();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<ResizedImage | null>(null);
  const [awaitingConsentImage, setAwaitingConsentImage] = useState<ResizedImage | null>(null);
  const [imageConsent, setImageConsent] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [followups, setFollowups] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Only surface follow-up suggestion chips every other assistant reply so
  // they help re-engage the chat without showing up after literally every
  // message, which reads as spammy/annoying.
  const assistantTurnCount = useRef(0);

  useEffect(() => {
    setImageConsent(hasStoredConsent());
  }, []);

  const hasProfile = Object.keys(profile || {}).length > 0;

  const suggestions =
    lang === "en"
      ? [
          "Build me a simple morning routine",
          "Which serum suits me best?",
          "Can I use vitamin C with retinol?",
          "Any supplements for better sleep?",
        ]
      : [
          "ช่วยจัดรูทีนเช้าแบบง่ายๆ ให้หน่อย",
          "เซรั่มตัวไหนเหมาะกับฉันที่สุด",
          "ใช้วิตามินซีคู่กับเรตินอลได้ไหม",
          "มีอาหารเสริมช่วยเรื่องการนอนไหม",
        ];

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading, open]);

  async function handleImagePick(file: File) {
    setImageError(null);
    try {
      const resized = await resizeForUpload(file);
      if (imageConsent) {
        setPendingImage(resized);
      } else {
        setAwaitingConsentImage(resized);
      }
    } catch {
      setImageError(t("ไม่สามารถอ่านรูปนี้ได้ กรุณาลองใหม่อีกครั้ง", "Couldn't read that photo, please try again."));
    }
  }

  function confirmImageConsent() {
    grantConsent();
    setImageConsent(true);
    if (awaitingConsentImage) setPendingImage(awaitingConsentImage);
    setAwaitingConsentImage(null);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  async function send(text: string, image?: ResizedImage | null) {
    const clean = text.trim();
    if ((!clean && !image) || loading) return;
    const fallbackText = lang === "en" ? "What product is this? Do you carry it?" : "รูปนี้คือสินค้าอะไรครับ มีขายไหม";
    const userMsg: Msg = { role: "user", content: clean || fallbackText, image: image?.dataUrl };
    const next: Msg[] = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setPendingImage(null);
    setFollowups([]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          profile,
          lang,
          image: image ? { base64: image.base64, mediaType: image.mediaType } : undefined,
        }),
      });
      if (!res.body) throw new Error("no response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      // Network chunks arrive in bursts (a handful of tokens at a time),
      // which reads as jumpy if painted directly. Decouple painting from
      // network timing: accumulate the full text as it arrives, and reveal
      // it to the UI a few characters at a time on a steady clock instead —
      // a smooth, constant-speed typewriter regardless of chunk burstiness.
      let full = "";
      let shown = 0;
      let netDone = false;
      const CHARS_PER_TICK = 3;
      const TICK_MS = 16;
      // The model may tack on a trailing "[[SUGGEST: ...]]" marker (see
      // route.ts) that must never flash on screen as raw bracket text. The
      // instant the literal "[[SUGGEST:" substring shows up anywhere in the
      // accumulated text, freeze the reveal boundary right before it and
      // never advance past it — everything from there on is the marker
      // (it's always last), regardless of how much more streams in after.
      const SUGGEST_OPEN = "[[SUGGEST:";
      function suggestOpenIndex() {
        const idx = full.indexOf(SUGGEST_OPEN);
        if (idx === -1) return -1;
        return full[idx - 1] === "\n" ? idx - 1 : idx;
      }
      function visibleTarget() {
        const idx = suggestOpenIndex();
        if (idx !== -1) return idx;
        if (netDone) return full.length;
        // marker hasn't started (or hasn't fully arrived) yet — hold back a
        // small safety margin in case "[[SUGGEST:" is split across chunks
        return Math.max(0, full.length - SUGGEST_OPEN.length);
      }

      async function readNetwork() {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          full += decoder.decode(value, { stream: true });
        }
        netDone = true;
      }

      async function revealLoop() {
        while (shown < visibleTarget() || !netDone) {
          const target = visibleTarget();
          if (shown < target) {
            shown = Math.min(target, shown + CHARS_PER_TICK);
            setMessages([...next, { role: "assistant", content: full.slice(0, shown) }]);
          }
          await new Promise((r) => setTimeout(r, TICK_MS));
        }
      }

      await Promise.all([readNetwork(), revealLoop()]);

      const cutIdx = suggestOpenIndex();
      const finalText = cutIdx !== -1 ? full.slice(0, cutIdx).trimEnd() : full;
      setMessages([...next, { role: "assistant", content: finalText || "…" }]);

      assistantTurnCount.current += 1;
      let parsed: string[] = [];
      if (cutIdx !== -1) {
        const inner = full
          .slice(cutIdx)
          .replace(/^\n/, "")
          .replace(/^\[\[SUGGEST:/i, "")
          .replace(/\]\]\s*$/, "");
        parsed = inner
          .split("|")
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3);
      }
      // odd turns only (1st, 3rd, 5th assistant reply...) — every other one
      setFollowups(parsed.length && assistantTurnCount.current % 2 === 1 ? parsed : []);
    } catch {
      setMessages([
        ...next,
        {
          role: "assistant",
          content:
            lang === "en"
              ? "Sorry, I couldn't connect. Please try again."
              : "ขออภัยครับ เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        aria-label={t("คุยกับน้อง Smoothie", "Chat with Smoothie")}
        className={`fixed bottom-[calc(72px+env(safe-area-inset-bottom))] lg:bottom-5 right-4 lg:right-5 z-[80] flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white shadow-cardHover transition-transform hover:scale-105 active:scale-95 h-12 w-12 ${
          open ? "" : "lg:h-14 lg:w-auto lg:justify-start lg:pl-4 lg:pr-5"
        }`}
      >
        {open ? (
          <X size={20} />
        ) : (
          <>
            <span className="relative grid h-9 w-9 shrink-0 place-items-center">
              <Image src="/mascot/smoothie-hi.png" alt="" fill sizes="36px" className="object-contain" />
              <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-white animate-pulse" />
            </span>
            <span className="hidden lg:inline text-sm font-semibold whitespace-nowrap">
              {t("คุยกับน้อง Smoothie", "Ask Smoothie")}
            </span>
          </>
        )}
      </button>

      {open && (
        <div className="fixed bottom-[calc(136px+env(safe-area-inset-bottom))] lg:bottom-24 right-4 sm:right-5 z-[80] w-[calc(100vw-2rem)] sm:w-[390px] h-[min(760px,calc(100dvh-136px-env(safe-area-inset-bottom)-16px))] lg:h-[min(760px,82dvh)] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-fadeUp">
          <div className="flex items-center justify-between gap-3 bg-brand-ink px-4 py-3">
            <div className="flex items-center gap-2.5 text-white min-w-0">
              <span className="relative grid h-9 w-9 shrink-0 place-items-center">
                <Image src="/mascot/smoothie-hi.png" alt="" fill sizes="36px" className="object-contain" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate">
                  {t("คุยกับน้อง Smoothie", "Chat with Smoothie")}
                </p>
                <p className="text-[11px] text-white/60 leading-tight truncate">
                  {hasProfile
                    ? t("อ่านโปรไฟล์ผิวของคุณแล้ว", "Using your skin profile")
                    : t("ถามอะไรก็ได้เกี่ยวกับผิว ผม หรือสุขภาพ", "Ask about skin, hair or wellness")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    setMessages([]);
                    setFollowups([]);
                    assistantTurnCount.current = 0;
                  }}
                  aria-label={t("เริ่มใหม่", "Reset")}
                  className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
                >
                  <RotateCcw size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label={t("ปิด", "Close")}
                className="grid h-7 w-7 place-items-center rounded-full text-white/60 hover:text-white hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div ref={scroller} className="flex-1 min-h-[200px] overflow-y-auto overscroll-contain bg-surface-soft px-3.5 py-3.5 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="py-2">
                <p className="text-[13px] text-slate-500 mb-3 text-center">
                  {hasProfile
                    ? t(
                        "ผมอ่านคำตอบจากแบบประเมินของคุณแล้ว ถามอะไรก็ได้ครับ",
                        "I've read your quiz answers — ask me anything."
                      )
                    : t("ถามอะไรก็ได้ หรือเริ่มจากคำถามเหล่านี้", "Ask anything, or start with one of these")}
                </p>
                <Link
                  href="/skin-coach"
                  className="mb-2 flex items-center gap-2.5 rounded-xl bg-brand-gradient px-3.5 py-2.5 text-left text-[13px] font-semibold text-white shadow-cardHover"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20">
                    <Camera size={13} />
                  </span>
                  {t("วิเคราะห์ผิวหน้าด้วยรูปถ่าย", "Analyze my skin from a photo")}
                </Link>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-[13px] text-slate-600 hover:border-brand-teal hover:text-brand-emerald transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "user" ? (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600 overflow-hidden">
                    {user?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.avatar} alt={user.name} className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <UserIcon size={15} />
                    )}
                  </span>
                ) : (
                  <span className="relative h-10 w-10 shrink-0 -mt-0.5">
                    <Image src="/mascot/smoothie-hi.png" alt="" fill sizes="40px" className="object-contain" />
                  </span>
                )}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-[13px] whitespace-pre-wrap leading-relaxed ${
                    m.role === "user"
                      ? "max-w-[82%] bg-brand-gradient text-white rounded-tr-sm"
                      : "max-w-[90%] bg-white text-slate-700 border border-slate-100 rounded-tl-sm"
                  }`}
                >
                  {m.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt="" className="mb-2 max-h-40 rounded-lg object-cover" />
                  )}
                  {m.role === "assistant" ? renderContent(m.content) : m.content}
                </div>
              </div>
            ))}

            {loading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2">
                <span className="relative h-10 w-10 shrink-0 -mt-0.5">
                  <Image src="/mascot/smoothie-question.png" alt="" fill sizes="40px" className="object-contain" />
                </span>
                <div className="rounded-2xl rounded-tl-sm bg-white border border-slate-100 px-3.5 py-2.5 text-[13px] text-slate-400 flex items-center gap-2">
                  <Loader2 size={13} className="animate-spin" /> {t("กำลังคิด...", "Thinking...")}
                </div>
              </div>
            )}

            {!loading && followups.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pl-11">
                {followups.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-brand-teal/40 bg-white px-3 py-1.5 text-[12px] text-brand-emerald hover:bg-brand-gradient-soft transition-colors"
                  >
                    {s}
                  </button>
                ))}
                <button
                  onClick={() => setFollowups([])}
                  aria-label={t("ซ่อนคำแนะนำ", "Hide suggestions")}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-slate-300 hover:text-slate-500"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {imageError && (
            <p className="bg-white px-4 pt-2 text-[11px] text-red-500 text-center">{imageError}</p>
          )}
          {awaitingConsentImage && (
            <div className="border-t border-slate-100 bg-amber-50 px-3.5 py-3">
              <p className="mb-2 text-[12px] leading-relaxed text-slate-700">
                {t(
                  "รูปที่แนบอาจมีข้อมูลอ่อนไหว (เช่น ผิวหรือปัญหาสุขภาพ) เราจะส่งไปให้ AI วิเคราะห์ชั่วคราวเท่านั้น ไม่เก็บรูปไว้บนเซิร์ฟเวอร์ ยินยอมให้ดำเนินการต่อไหมคะ",
                  "The photo may contain sensitive info (e.g. skin/health). We only send it to the AI temporarily and don't store it on our server. Consent to continue?"
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={confirmImageConsent}
                  className="rounded-full bg-brand-gradient px-3.5 py-1.5 text-[12px] font-semibold text-white"
                >
                  {t("ยินยอม ดำเนินการต่อ", "Consent & continue")}
                </button>
                <button
                  type="button"
                  onClick={() => setAwaitingConsentImage(null)}
                  className="rounded-full border border-slate-200 px-3.5 py-1.5 text-[12px] text-slate-500"
                >
                  {t("ยกเลิก", "Cancel")}
                </button>
              </div>
            </div>
          )}
          {pendingImage && (
            <div className="flex items-center gap-2 border-t border-slate-100 bg-white px-3 pt-2.5">
              <div className="relative h-12 w-12 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage.dataUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  aria-label={t("ลบรูป", "Remove photo")}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-white"
                >
                  <X size={11} />
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                {t("แนบรูปสินค้าไว้แล้ว พิมพ์คำถามเพิ่มเติมได้ (ไม่บังคับ)", "Photo attached — add a question if you like (optional)")}
              </p>
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input, pendingImage);
            }}
            className="flex items-center gap-2 border-t border-slate-100 bg-white p-2.5"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImagePick(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label={t("แนบรูปสินค้าเพื่อถาม", "Attach a product photo")}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-400 hover:bg-surface-soft hover:text-brand-emerald"
            >
              <ImagePlus size={17} />
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pendingImage
                  ? t("ถามเกี่ยวกับรูปนี้... (ไม่พิมพ์ก็ได้)", "Ask about this photo... (optional)")
                  : t("พิมพ์คำถามของคุณ...", "Type your question...")
              }
              className="flex-1 rounded-full border border-slate-200 bg-surface-soft px-4 py-2.5 text-[13px] outline-none focus:border-brand-teal"
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && !pendingImage)}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-gradient text-white disabled:opacity-40"
              aria-label="Send"
            >
              <Send size={15} />
            </button>
          </form>
          <p className="bg-white px-4 pb-2.5 text-[10px] text-slate-400 text-center leading-snug">
            {lang === "en"
              ? "AI guidance only — not a substitute for a doctor or pharmacist."
              : "คำแนะนำจาก AI เป็นข้อมูลทั่วไป ไม่ใช่คำวินิจฉัยทางการแพทย์"}
          </p>
        </div>
      )}
    </>
  );
}
