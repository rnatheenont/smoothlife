"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import {
  Send,
  Loader2,
  User as UserIcon,
  X,
  Check,
  Camera,
  ImagePlus,
  MessageCircleQuestion,
  Headset,
  Bot,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import type { useChatSession } from "@/lib/use-chat-session";
import { PHOTO_MARKER } from "@/lib/chat-image-store";
import { renderMessageContent } from "@/components/chat/ChatMessageContent";
import { Avatar, Button } from "@/components/ui";

// The conversation itself — everything from the escalation banner down to the
// disclaimer, with none of the chrome around it.
//
// It exists because there are two places to have the same conversation: the
// 390px widget in the corner, and the full-screen page at /chat. Both run the
// same `useChatSession` hook, and both render this. A product-card marker, a
// consent prompt, the route back to a human — each is written once here, so
// the two surfaces cannot drift into two subtly different assistants.
//
// The only thing the variant changes is size: a bubble read while shopping in
// a narrow column is not the same bubble read on a page opened on purpose.

export type ChatSession = ReturnType<typeof useChatSession>;

const SIZES = {
  widget: {
    column: "",
    scroller: "px-3.5 py-3.5",
    stackGap: "gap-3",
    bubbleText: "text-[13px]",
    bubblePad: "px-3.5 py-2.5",
    bubbleMax: { user: "max-w-[82%]", other: "max-w-[90%]" },
    avatar: "h-9 w-9",
    avatarIcon: 15,
    mascot: "h-10 w-10",
    chipIndent: "pl-11",
    rowGap: "gap-2",
    sidePad: "px-3.5",
    formPad: "p-2.5",
    inputText: "text-[13px]",
  },
  full: {
    column: "mx-auto w-full max-w-3xl",
    scroller: "px-4 py-6 sm:px-6",
    stackGap: "gap-5",
    bubbleText: "text-[15px]",
    bubblePad: "px-4 py-3",
    bubbleMax: { user: "max-w-[80%]", other: "max-w-[92%]" },
    avatar: "h-9 w-9",
    avatarIcon: 16,
    mascot: "h-11 w-11",
    chipIndent: "pl-12",
    rowGap: "gap-3",
    sidePad: "px-4 sm:px-6",
    formPad: "p-3",
    inputText: "text-[15px]",
  },
} as const;

export default function ChatConversation({
  session,
  variant,
  active,
}: {
  session: ChatSession;
  variant: keyof typeof SIZES;
  /** Whether this surface is the one on screen — gates the scroll-to-latest
   *  so the widget doesn't jump a conversation the customer can't see. */
  active: boolean;
}) {
  const { lang, t } = useLang();
  const { user } = useAuth();
  const ui = SIZES[variant];

  const {
    messages,
    input,
    setInput,
    loading,
    send,
    restoringHistory,
    historyLoaded,
    suggestions,
    hasProfile,
    pendingImage,
    setPendingImage,
    awaitingConsentImage,
    setAwaitingConsentImage,
    imageError,
    handleImagePick,
    confirmImageConsent,
    followups,
    setFollowups,
    askOptions,
    setAskOptions,
    setHelpOpen,
    closeOffer,
    setCloseOffer,
    caseLooksSettled,
    humanHandling,
    escalating,
    escalateMsg,
    setEscalateMsg,
    escalate,
    resolveCase,
    resolvingCase,
    backToAi,
    backToAiBusy,
    helpOpen,
    openHelpTopics,
    noteOpen,
    setNoteOpen,
    note,
    setNote,
  } = session;

  const scroller = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrolledOnceRef = useRef(false);

  // The first scroll after opening (which lands on a just-restored history)
  // should jump straight to the latest message — animating a smooth scroll
  // through the whole conversation on every open reads as slow and, worse,
  // makes it look like the chat starts empty before "catching up". Only
  // messages that arrive while the surface is already open (a new reply
  // streaming in) get the smooth animation.
  useEffect(() => {
    if (!active) {
      scrolledOnceRef.current = false;
      return;
    }
    // `historyLoaded` only flips to true (together with `restoringHistory`)
    // inside the session hook's restore effect — on the very first render
    // right after `active` becomes true, both are still at their pre-fetch
    // values, so `restoringHistory` alone doesn't catch this pass. Without
    // the `!historyLoaded` check here too, this effect fires once on the
    // still-empty container, "using up" the instant jump — leaving the
    // real restored history to animate in with a smooth scroll instead.
    if (!historyLoaded || restoringHistory) return;
    const behavior = scrolledOnceRef.current ? "smooth" : "auto";
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior });
    scrolledOnceRef.current = true;
  }, [messages, loading, active, restoringHistory, historyLoaded]);

  return (
    <>
      {escalateMsg && (
        <div className={`flex items-start justify-between gap-2 border-b border-slate-100 bg-amber-50 py-2.5 ${ui.sidePad}`}>
          <p className={`${ui.column} text-[12px] leading-relaxed text-slate-700`}>{escalateMsg}</p>
          <button
            onClick={() => setEscalateMsg(null)}
            aria-label={t("ปิด", "Close")}
            className="shrink-0 text-slate-500 hover:text-slate-600"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div
        ref={scroller}
        className={`flex min-h-[200px] flex-1 flex-col overflow-y-auto overscroll-contain bg-surface-soft ${ui.scroller}`}
      >
        <div className={`flex flex-1 flex-col ${ui.stackGap} ${ui.column}`}>
          {restoringHistory ? (
            <div className="flex flex-1 items-center justify-center py-10 text-slate-500">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : (
            messages.length === 0 && (
              <div className="py-2">
                <p className="mb-1 text-center text-[13px] font-semibold text-brand-ink">
                  {t(
                    "สวัสดีค่ะ ฉันน้อง Smoothie ผู้ช่วย AI ของ Smoothlife.com",
                    "Hi, I'm Smoothie — Smoothlife.com's AI assistant"
                  )}
                </p>
                <p className="mb-3 text-center text-[13px] text-slate-500">
                  {hasProfile
                    ? t(
                        "ฉันอ่านคำตอบจากแบบประเมินของคุณแล้ว ถามอะไรก็ได้ค่ะ",
                        "I've read your quiz answers — ask me anything."
                      )
                    : t("ถามอะไรก็ได้ หรือเริ่มจากคำถามเหล่านี้", "Ask anything, or start with one of these")}
                </p>
                <Button
                  size="none"
                  fullWidth
                  href="/skin-coach"
                  className="mb-2 justify-start gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13px] shadow-cardHover"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/20">
                    <Camera size={13} />
                  </span>
                  {t("วิเคราะห์ผิวหน้าด้วยรูปถ่าย", "Analyze my skin from a photo")}
                </Button>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-[13px] text-slate-600 transition-colors hover:border-brand-teal hover:text-brand-800"
                    >
                      <MessageCircleQuestion size={14} className="shrink-0 text-brand-emerald/70" />
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

          {messages.map((m, i) => {
            // A photo attached in an earlier session (before a reload)
            // never gets its actual image back — it was only ever sent to
            // the AI for temporary analysis, never stored — but the
            // "[[PHOTO]] " prefix (see route.ts persistMessage) lets the
            // bubble at least show a placeholder instead of the text
            // looking like an orphaned, contextless question.
            const hadPhoto = m.role === "user" && !m.image && m.content.startsWith(PHOTO_MARKER);
            const displayContent = hadPhoto ? m.content.slice(PHOTO_MARKER.length) : m.content;
            return (
              <div key={i} className={`flex ${ui.rowGap} ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "user" ? (
                  <span
                    className={`grid ${ui.avatar} shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 text-slate-600`}
                  >
                    <Avatar
                      src={user?.avatar}
                      name={user?.name ?? ""}
                      className={ui.avatar}
                      fallback={<UserIcon size={ui.avatarIcon} />}
                    />
                  </span>
                ) : m.fromStaff ? (
                  <span
                    className={`grid ${ui.avatar} shrink-0 place-items-center rounded-full bg-brand-50 text-brand-800 ring-1 ring-brand-200`}
                  >
                    <Headset size={16} />
                  </span>
                ) : (
                  <span className={`relative ${ui.mascot} -mt-0.5 shrink-0`}>
                    <Image src="/mascot/smoothie-say.png" alt="" fill sizes="44px" className="object-contain" />
                  </span>
                )}
                <div
                  className={`whitespace-pre-wrap rounded-2xl leading-relaxed ${ui.bubblePad} ${ui.bubbleText} ${
                    m.role === "user"
                      ? `${ui.bubbleMax.user} rounded-tr-sm bg-brand-gradient text-white`
                      : m.fromStaff
                        ? `${ui.bubbleMax.other} rounded-tl-sm border border-brand-200 bg-brand-50 text-slate-700`
                        : `${ui.bubbleMax.other} rounded-tl-sm border border-slate-100 bg-white text-slate-700`
                  }`}
                >
                  {/* Staff replies are delivered through the same field the
                      AI's answers use, so without this the customer watches
                      a person reply under Smoothie's name — most confusing
                      right after they have chosen to go back to the bot. */}
                  {m.fromStaff && (
                    <span className="mb-1 block text-[11px] font-semibold text-brand-800">
                      {t("ทีมงาน Smoothlife", "Smoothlife team")}
                    </span>
                  )}
                  {m.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.image} alt="" className="mb-2 max-h-40 rounded-lg object-cover" />
                  )}
                  {hadPhoto && (
                    <span className="mb-1.5 flex items-center gap-1.5 text-[11px] text-white/75">
                      <Camera size={12} />
                      {t("แนบรูปไว้ตรงนี้ (รูปไม่ได้อยู่ในเครื่องนี้)", "Photo was attached here (not on this device)")}
                    </span>
                  )}
                  {m.role === "assistant" ? renderMessageContent(displayContent) : displayContent}
                </div>
              </div>
            );
          })}

          {loading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className={`flex ${ui.rowGap}`}>
              <span className={`relative ${ui.mascot} -mt-0.5 shrink-0`}>
                <Image src="/mascot/smoothie-question.png" alt="" fill sizes="44px" className="object-contain" />
              </span>
              <div
                className={`flex items-center gap-2 rounded-2xl rounded-tl-sm border border-slate-100 bg-white text-slate-500 ${ui.bubblePad} ${ui.bubbleText}`}
              >
                <Loader2 size={13} className="animate-spin" /> {t("กำลังคิด…", "Thinking…")}
              </div>
            </div>
          )}

          {!loading && (askOptions.length > 0 || helpOpen || caseLooksSettled || closeOffer) && (
            <div className={`flex flex-wrap items-center gap-1.5 ${ui.chipIndent}`}>
              {askOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setHelpOpen(false);
                    send(s);
                  }}
                  className="rounded-full bg-brand-gradient px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-xs transition-opacity hover:opacity-90"
                >
                  {s}
                </button>
              ))}
              {/* Offered only after a person has actually answered. Quiet
                  means "that solved it" or "they gave up" and those look
                  identical from the inbox — the customer is the only one who
                  knows which, and this is one tap. */}
              {caseLooksSettled && !helpOpen && (
                <button
                  onClick={resolveCase}
                  disabled={resolvingCase}
                  className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                >
                  <Check size={12} />
                  {t("เรื่องนี้เรียบร้อยแล้ว", "This is sorted")}
                </button>
              )}
              {/* Smoothie thinks she finished this one. Two ways out, both
                  one tap: agree, or say it is not finished — the second is
                  what stops a wrong guess from burying a real problem. */}
              {closeOffer && !helpOpen && !caseLooksSettled && (
                <>
                  <button
                    onClick={() => {
                      setCloseOffer(false);
                      void resolveCase();
                    }}
                    disabled={resolvingCase}
                    className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-[12px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Check size={12} />
                    {t("เรียบร้อยแล้ว ขอบคุณ", "All sorted, thanks")}
                  </button>
                  <button
                    onClick={() => {
                      setCloseOffer(false);
                      setAskOptions([]);
                      setNoteOpen(true);
                    }}
                    className="flex items-center gap-1 rounded-full border border-brand-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-brand-800 hover:bg-brand-50"
                  >
                    <Headset size={12} />
                    {t("ยังไม่จบ ขอคุยกับแอดมิน", "Not yet — talk to a person")}
                  </button>
                </>
              )}
              {helpOpen && (
                <button
                  onClick={() => {
                    setHelpOpen(false);
                    setAskOptions([]);
                    setNoteOpen(true);
                  }}
                  className="flex items-center gap-1 rounded-full border border-brand-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-brand-800 hover:bg-brand-50"
                >
                  <Headset size={12} />
                  {t("ติดต่อแอดมิน", "Talk to a person")}
                </button>
              )}
            </div>
          )}

          {!loading && followups.length > 0 && (
            <div className={`flex flex-wrap items-center gap-1.5 ${ui.chipIndent}`}>
              {followups.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="flex items-center gap-1.5 rounded-full border border-brand-teal/40 bg-white px-3 py-1.5 text-[12px] text-brand-800 transition-colors hover:bg-brand-gradient-soft"
                >
                  <MessageCircleQuestion size={13} className="shrink-0" />
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
      </div>

      {noteOpen && (
        <div className={`border-t border-slate-100 bg-surface-soft py-3 ${ui.sidePad}`}>
          <div className={ui.column}>
            <p className="mb-1.5 text-[12px] font-semibold text-brand-ink">
              {t("ฝากข้อความถึงแอดมิน", "Leave a message for our team")}
            </p>
            <p className="mb-2 text-[11px] leading-relaxed text-slate-500">
              {t(
                "ทีมงานจะติดต่อกลับภายใน 1 วันทำการ ระหว่างรอ คุยกับน้อง Smoothie ต่อได้ตามปกติค่ะ",
                "The team replies within 1 business day. You can keep chatting with Smoothie meanwhile."
              )}
            </p>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={t(
                "เช่น ของยังไม่ถึง อยากเปลี่ยนที่อยู่จัดส่ง",
                "e.g. my parcel hasn't arrived, I need to change the address"
              )}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] outline-hidden focus-visible:border-brand-600 focus-visible:ring-2 focus-visible:ring-brand-600"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="none"
                className="px-3.5 py-1.5 text-[12px]"
                onClick={() => escalate(note)}
                loading={escalating}
                disabled={!note.trim()}
              >
                {escalating ? t("กำลังส่ง…", "Sending…") : t("ฝากข้อความ", "Send")}
              </Button>
              <button
                type="button"
                onClick={() => setNoteOpen(false)}
                className="rounded-full border border-slate-200 px-3.5 py-1.5 text-[12px] text-slate-500"
              >
                {t("ยกเลิก", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reaching a human was previously a 28px headset icon in the header
          that only appeared once a conversation existed — findable if you
          already knew it was there. These say what they do, and are
          present from the first screen. */}
      <div className={`scrollbar-none border-t border-slate-100 bg-white py-2 ${ui.sidePad}`}>
        {/* nowrap + shrink-0 + a scrolling row, because these labels are
            Thai and the widget panel is ~340px: left to wrap they broke
            across two lines mid-word and the bar came out ragged. */}
        {/* One door, not two. "Help centre" and "Leave a message" were the
            same intent — I need something the bot cannot give me — and
            splitting them made the customer guess which was which before
            they had said what they wanted. */}
        <div className={`scrollbar-none flex items-center gap-1.5 overflow-x-auto ${ui.column}`}>
          <Button
            variant="ghost"
            size="none"
            className={`shrink-0 gap-1.5 whitespace-nowrap rounded-full border border-slate-200/80 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-brand-800 ${
              helpOpen || noteOpen ? "border-brand-200 bg-brand-50 text-brand-800" : ""
            }`}
            onClick={openHelpTopics}
            disabled={escalating}
          >
            <MessageCircleQuestion size={13} />
            {t("ช่วยเหลือ / ติดต่อแอดมิน", "Help & contact")}
          </Button>
          {humanHandling && (
            <Button
              variant="ghost"
              size="none"
              className="shrink-0 gap-1.5 whitespace-nowrap rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-[11px] font-medium text-brand-800 transition-colors hover:bg-brand-100"
              onClick={backToAi}
              disabled={backToAiBusy}
            >
              <Bot size={13} />
              {backToAiBusy ? t("กำลังเปลี่ยน…", "Switching…") : t("คุยกับ Smoothie", "Back to Smoothie")}
            </Button>
          )}
        </div>
      </div>

      {imageError && <p className="bg-white px-4 pt-2 text-center text-[11px] text-red-500">{imageError}</p>}
      {awaitingConsentImage && (
        <div className={`border-t border-slate-100 bg-amber-50 py-3 ${ui.sidePad}`}>
          <div className={ui.column}>
            <p className="mb-2 text-[12px] leading-relaxed text-slate-700">
              {humanHandling
                ? t(
                    "ตอนนี้ทีมงานเป็นผู้ดูแลเคสของคุณอยู่ รูปที่ส่งจะถูกเก็บไว้บนระบบของเรา เพื่อให้ทีมงานเปิดดูได้ — เฉพาะเจ้าหน้าที่ที่ดูแลเคสนี้เท่านั้น ไม่เปิดเผยต่อบุคคลอื่น และจะลบอัตโนมัติเมื่อปิดเคส หรืออย่างช้าภายใน 30 วัน รูปอาจมีข้อมูลอ่อนไหว (เช่น ผิวหรือสุขภาพ) กรุณาส่งเท่าที่จำเป็นต่อการตรวจสอบ ยินยอมให้เก็บรูปไว้ให้ทีมงานตรวจสอบไหมคะ",
                    "A member of our team is handling your case, so this photo will be stored on our system for them to see — visible only to the staff on this case, deleted when the case is closed, and within 30 days at the latest. Photos may contain sensitive information (e.g. skin or health); please send only what's needed. Consent to store it for the team?"
                  )
                : t(
                    "รูปที่แนบอาจมีข้อมูลอ่อนไหว (เช่น ผิวหรือปัญหาสุขภาพ) เราจะส่งไปให้ AI วิเคราะห์ชั่วคราวเท่านั้น ไม่เก็บรูปไว้บนเซิร์ฟเวอร์ — จะเก็บสำเนาย่อไว้ในเครื่องนี้เท่านั้น เพื่อให้คุณย้อนดูประวัติได้ ยินยอมให้ดำเนินการต่อไหมคะ",
                    "The photo may contain sensitive info (e.g. skin/health). We only send it to the AI temporarily and don't store it on our server — a small copy stays on this device so you can see it in your history. Consent to continue?"
                  )}
            </p>
            <div className="flex gap-2">
              <Button size="none" className="px-3.5 py-1.5 text-[12px]" type="button" onClick={confirmImageConsent}>
                {t("ยินยอม ดำเนินการต่อ", "Consent & continue")}
              </Button>
              <button
                type="button"
                onClick={() => setAwaitingConsentImage(null)}
                className="rounded-full border border-slate-200 px-3.5 py-1.5 text-[12px] text-slate-500"
              >
                {t("ยกเลิก", "Cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingImage && (
        <div className={`border-t border-slate-100 bg-white pt-2.5 ${ui.sidePad}`}>
          <div className={`flex items-center gap-2 ${ui.column}`}>
            <div className="relative h-12 w-12 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingImage.dataUrl}
                alt=""
                width={48}
                height={48}
                className="h-12 w-12 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => setPendingImage(null)}
                aria-label={t("ลบรูป", "Remove photo")}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-slate-700 text-white"
              >
                <X size={11} />
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              {t(
                "แนบรูปสินค้าไว้แล้ว พิมพ์คำถามเพิ่มเติมได้ (ไม่บังคับ)",
                "Photo attached — add a question if you like (optional)"
              )}
            </p>
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input, pendingImage);
        }}
        className={`border-t border-slate-100 bg-white ${ui.formPad}`}
      >
        <div className={`flex items-center gap-2 ${ui.column}`}>
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
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-surface-soft hover:text-brand-800"
          >
            <ImagePlus size={17} />
          </button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              pendingImage
                ? t("ถามเกี่ยวกับรูปนี้... (ไม่พิมพ์ก็ได้)", "Ask about this photo... (optional)")
                : t("วันนี้คุณรู้สึกยังไง…", "How are you feeling today?")
            }
            className={`flex-1 rounded-full border border-slate-200 bg-surface-soft px-4 py-2.5 outline-hidden focus:border-brand-teal ${ui.inputText}`}
          />
          <Button
            size="none"
            className="grid h-9 w-9 shrink-0 place-items-center"
            type="submit"
            disabled={loading || (!input.trim() && !pendingImage)}
            aria-label="Send"
          >
            <Send size={15} />
          </Button>
        </div>
      </form>
      <p className="bg-white px-4 pb-2.5 text-center text-[10px] leading-snug text-slate-500">
        {lang === "en"
          ? "AI guidance only — not a substitute for a doctor or pharmacist."
          : "คำแนะนำจาก AI เป็นข้อมูลทั่วไป ไม่ใช่คำวินิจฉัยทางการแพทย์"}
      </p>
    </>
  );
}
