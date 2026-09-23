"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, X, ExternalLink, AlertTriangle, Info, Lock } from "lucide-react";
import { formatTHB } from "@/lib/format";
import { Button } from "@/components/ui";

// Keeps the customer on smoothlife.com through the whole payment: 2C2P's page
// runs in a frame here instead of taking over the browser. 2C2P allows this
// (`x-frame-options: ALLOWALL`, `frame-ancestors *` on pgw.2c2p.com).
//
// What 2C2P cannot promise is the *bank's* 3-D Secure page, which a card
// payment redirects into inside this same frame. Plenty of issuers send
// X-Frame-Options: DENY, and a blank frame at the OTP step is worse than a
// plain redirect would have been — so an "open in a new tab" escape is
// present from the first second and becomes prominent if nothing happens.
//
// Success is never inferred from the customer arriving back. 2C2P's backend
// webhook is what marks a payment paid, so this polls our own status endpoint
// and only then says the words "ชำระเงินสำเร็จ".

type Phase = "paying" | "verifying" | "success" | "failed" | "unconfirmed";

/**
 * 2C2P returns the issuer's own wording, in English and often terse
 * ("Insufficient funds", "Do not honour"). The customer needs the next step,
 * not the bank's vocabulary — and when it is something we cannot read, the
 * honest advice is the general one.
 */
function failureAdvice(reason: string | null): string {
  const text = (reason ?? "").toLowerCase();
  if (/insufficient|not enough|limit exceed|exceed.*limit/.test(text)) {
    return "ยอดในบัตรไม่พอหรือเกินวงเงิน — ลองใช้บัตรอื่น หรือติดต่อธนาคารเพื่อขอเพิ่มวงเงิน สินค้าในตะกร้ายังอยู่ครบ";
  }
  if (/expire|invalid card|invalid number|incorrect/.test(text)) {
    return "ข้อมูลบัตรไม่ถูกต้องหรือบัตรหมดอายุ — ตรวจเลขบัตร วันหมดอายุ และ CVV แล้วลองใหม่อีกครั้ง";
  }
  if (/cancel|abort|user/.test(text)) {
    return "รายการถูกยกเลิกก่อนชำระเสร็จ สินค้าในตะกร้ายังอยู่ครบ ลองชำระเงินใหม่ได้เลย";
  }
  if (/3ds|otp|authenticat/.test(text)) {
    return "ยืนยันตัวตนกับธนาคารไม่สำเร็จ (OTP/3-D Secure) — ลองใหม่อีกครั้ง หรือชำระด้วย PromptPay QR แทน";
  }
  if (/do not honou?r|declin|refus|reject/.test(text)) {
    return "ธนาคารผู้ออกบัตรปฏิเสธรายการนี้ — ลองใช้บัตรอื่น หรือติดต่อธนาคารผู้ออกบัตร สินค้าในตะกร้ายังอยู่ครบ";
  }
  return "สินค้าในตะกร้ายังอยู่ครบ ลองชำระเงินใหม่ หรือเปลี่ยนวิธีชำระเงินได้เลย";
}

const STUCK_HINT_AFTER_MS = 20_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 90_000;
// Gentler than the post-return poll: this one runs for as long as someone is
// on the payment page, which can be the whole reservation window.
const WATCH_INTERVAL_MS = 3_000;

/**
 * The status endpoint returns what Shopify stores: a GID
 * ("gid://shopify/Order/7743402541207"). Nobody is going to read that out over
 * the phone — show the order number inside it.
 */
function orderLabel(id: string): string {
  return id.split("/").pop() || id;
}

/** What is being paid for, so the frame is not the only thing on screen. */
export type OrderSummary = { total: number; items?: { name: string; quantity: number }[] };

export default function PaymentModal({
  webPaymentUrl,
  cartToken,
  onClose,
  onPaid,
  summary,
  previewPhase,
  previewData,
}: {
  webPaymentUrl: string;
  cartToken: string;
  /** Customer backed out — the order was never paid. */
  onClose: () => void;
  /** Confirmed paid by our own backend, not by the redirect. */
  onPaid: () => void;
  summary?: OrderSummary;
  /**
   * Preview only (admin → ระบบดีไซน์): opens on a given phase and never polls,
   * so every screen here can be looked at without a real payment. Nothing in
   * the shop passes it.
   */
  previewPhase?: Phase;
  /** Preview only: the values a real payment would have supplied. */
  previewData?: { orderId?: string; amount?: number; failureReason?: string };
}) {
  const [phase, setPhase] = useState<Phase>(previewPhase ?? "paying");
  const [orderId, setOrderId] = useState<string | null>(previewData?.orderId ?? null);
  const [amount, setAmount] = useState<number | null>(previewData?.amount ?? null);
  const [failureReason, setFailureReason] = useState<string | null>(previewData?.failureReason ?? null);
  const [showStuckHint, setShowStuckHint] = useState(false);
  // 2C2P's page is cross-origin, so the only thing we can know about it is
  // that it finished loading — enough to stop showing a white rectangle.
  const [frameReady, setFrameReady] = useState(false);
  // Leaving mid-payment asks first, in the app's own words rather than the
  // browser's dialog.
  const [confirmingClose, setConfirmingClose] = useState(false);
  const paidNotified = useRef(false);

  // If the frame is still showing the payment page well after it should have
  // loaded, the most likely cause is an issuer page refusing to be framed —
  // which looks identical to "nothing happened" from out here, since we can't
  // read a cross-origin frame.
  useEffect(() => {
    if (phase !== "paying") return;
    const t = setTimeout(() => setShowStuckHint(true), STUCK_HINT_AFTER_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type !== "2c2p:returned" || e.data?.cartToken !== cartToken) return;
      setPhase("verifying");
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [cartToken]);

  // 2C2P does not reliably send the frame back to frontendReturnUrl. A
  // PromptPay QR paid in a banking app leaves 2C2P's own "payment successful"
  // page sitting in the frame, and an issuer page opened in a new tab returns
  // there instead of here — either way no "2c2p:returned" ever arrives and the
  // modal stays on the payment page after the money has left the customer's
  // account. So watch our own transaction from the moment this opens rather
  // than waiting to be told they came back.
  useEffect(() => {
    if (previewPhase || phase !== "paying") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function watch() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/checkout/status?cartToken=${encodeURIComponent(cartToken)}`);
        const data = await res.json();
        if (cancelled) return;
        // Only success cuts the payment short. A decline can still be retried
        // on 2C2P's page with the same token, and taking the frame away would
        // end an attempt the customer is still in the middle of.
        if (data.ok && data.status === "success") {
          setOrderId(data.orderId ?? null);
          setAmount(typeof data.amount === "number" ? data.amount : null);
          setPhase("success");
          return;
        }
      } catch {
        /* transient — the customer is still on the payment page */
      }
      timer = setTimeout(watch, WATCH_INTERVAL_MS);
    }

    timer = setTimeout(watch, WATCH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, cartToken, previewPhase]);

  useEffect(() => {
    if (previewPhase || phase !== "verifying") return;
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/checkout/status?cartToken=${encodeURIComponent(cartToken)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && data.status === "success") {
          setOrderId(data.orderId ?? null);
          setAmount(typeof data.amount === "number" ? data.amount : null);
          setPhase("success");
          return;
        }
        if (data.ok && data.status === "failed") {
          setFailureReason(data.failureReason ?? null);
          setPhase("failed");
          return;
        }
      } catch {
        /* transient — keep polling until the deadline */
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        // Paid or not, we genuinely don't know yet. Saying either would be a
        // guess, and "you paid" is the more damaging guess to get wrong.
        setPhase("unconfirmed");
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [phase, cartToken, previewPhase]);

  useEffect(() => {
    if (previewPhase) return;
    if (phase === "success" && !paidNotified.current) {
      paidNotified.current = true;
      // The money arrived while they were being asked whether to abandon it.
      setConfirmingClose(false);
      onPaid();
    }
  }, [phase, onPaid, previewPhase]);

  function requestClose() {
    if (phase === "paying" || phase === "verifying") {
      setConfirmingClose(true);
      return;
    }
    onClose();
  }

  const isResult = phase === "success" || phase === "failed" || phase === "unconfirmed";

  return (
    <div className="fixed inset-0 z-120 flex items-stretch justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-black/50" onClick={requestClose} />

      <div
        // A phone gives the card form every pixel it can: entering a card
        // number and an OTP in a letterboxed frame is the worst place to save
        // space. From sm up it is the floating card it always was.
        className={`relative flex w-full flex-col overflow-hidden bg-white shadow-cardHover animate-fadeUp sm:rounded-xl2 ${
          isResult ? "h-full sm:h-auto sm:max-w-sm" : "h-full sm:h-[88vh] sm:max-w-2xl"
        }`}
        role="dialog"
        aria-modal="true"
      >
        {!isResult && (
          <>
            {/* Who is being paid, and how much — the frame below says neither,
                and a payment page with no context is one people abandon. */}
            {summary && (
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-slate-100 bg-surface-soft px-4 py-2.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-ink">
                  <Lock size={13} className="text-brand-emerald" aria-hidden /> ชำระเงินให้ Smoothlife.com
                </p>
                <p className="text-xs text-slate-600">
                  ยอดรวม <span className="font-bold text-brand-ink">{formatTHB(summary.total)}</span>
                  <span className="ms-2 text-slate-400">ผ่าน 2C2P</span>
                </p>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-brand-ink">
                {phase === "verifying" ? "กำลังยืนยันการชำระเงิน…" : "ชำระเงินอย่างปลอดภัย"}
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={webPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-full px-1.5 py-1 text-[11px] font-semibold text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                >
                  <ExternalLink size={12} /> เปิดในแท็บใหม่
                </a>
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="ปิด"
                  className="grid size-8 place-items-center rounded-full text-slate-400 hover:bg-surface-soft hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {showStuckHint && phase === "paying" && (
              // Not a warning: some issuers simply refuse to be framed, which
              // is ordinary and has a one-tap answer. Amber made it read as a
              // failure.
              <div className="flex items-start gap-2 border-b border-sky-100 bg-sky-50 px-4 py-2.5 text-[11px] text-sky-900">
                <Info size={13} className="mt-0.5 shrink-0" />
                <span>
                  หน้าชำระเงินไม่ขึ้นหรือค้างอยู่? บางธนาคารไม่อนุญาตให้แสดงหน้ากรอก OTP ในกรอบนี้ —{" "}
                  <a
                    href={webPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-700"
                  >
                    เปิดในแท็บใหม่
                  </a>{" "}
                  แล้วชำระเงินต่อได้เลย
                </span>
              </div>
            )}

            <div className="relative flex-1">
              <iframe
                src={webPaymentUrl}
                title="ชำระเงินผ่าน 2C2P"
                onLoad={() => setFrameReady(true)}
                className="h-full w-full"
                // The payment page needs to run scripts, submit its own forms
                // and redirect itself into the issuer's 3DS page.
                sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation-by-user-activation allow-popups"
              />
              {!frameReady && phase === "paying" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white">
                  <Loader2 size={26} className="animate-spin text-brand-emerald" />
                  <p className="text-sm text-slate-500">กำลังเปิดหน้าชำระเงินที่ปลอดภัย…</p>
                </div>
              )}
              {phase === "verifying" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95">
                  <Loader2 size={28} className="animate-spin text-brand-emerald" />
                  <p className="text-sm text-slate-500">กำลังตรวจสอบผลการชำระเงิน…</p>
                  <p className="text-[11px] text-slate-500">กรุณาอย่าปิดหน้าต่างนี้</p>
                </div>
              )}
            </div>
          </>
        )}

        {isResult && (
          // The result screens drop the header that held the close button, and
          // on a phone this card fills the screen, so there is no backdrop left
          // to tap either. Without this the modal genuinely cannot be dismissed
          // after a payment goes through.
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="absolute end-3 top-3 grid size-9 place-items-center rounded-full text-slate-400 hover:bg-surface-soft hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
          >
            <X size={18} />
          </button>
        )}

        {phase === "success" && (
          <div className="p-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-gradient-soft">
              <CheckCircle2 size={34} className="text-brand-emerald" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-brand-ink">ชำระเงินสำเร็จ</h3>
            {amount !== null && <p className="mt-1 text-sm text-slate-500">ยอดชำระ {formatTHB(amount)}</p>}
            {orderId && (
              <p className="mt-3 rounded-lg bg-surface-soft px-3 py-2 text-xs text-slate-600">
                เลขคำสั่งซื้อ <span className="font-semibold text-brand-ink">{orderLabel(orderId)}</span>
              </p>
            )}
            {summary?.items && summary.items.length > 0 && (
              // What they paid for, without a trip to the orders page.
              <ul className="mt-3 flex flex-col gap-1 rounded-lg bg-surface-soft px-3 py-2 text-left text-xs text-slate-600">
                {summary.items.slice(0, 6).map((item) => (
                  <li key={item.name} className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">×{item.quantity}</span>
                  </li>
                ))}
                {summary.items.length > 6 && <li className="text-slate-400">และอีก {summary.items.length - 6} รายการ</li>}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              เราได้รับคำสั่งซื้อของคุณแล้ว รายละเอียดการจัดส่งจะถูกส่งไปที่อีเมลของคุณ
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Button href="/account/orders">
                ดูคำสั่งซื้อของฉัน
              </Button>
              <Link
                href="/shop"
                className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
              >
                ช้อปต่อ
              </Link>
            </div>
          </div>
        )}

        {phase === "failed" && (
          <div className="p-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-rose-50">
              <AlertTriangle size={32} className="text-rose-500" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-brand-ink">ชำระเงินไม่สำเร็จ</h3>
            <p className="mt-2 text-sm text-slate-500">
              {failureReason || "การชำระเงินถูกปฏิเสธ ไม่มีการตัดเงินจากบัญชีของคุณ"}
            </p>
            <p className="mt-2 text-xs text-slate-500">{failureAdvice(failureReason)}</p>
            <Button fullWidth className="mt-6" type="button" onClick={onClose}>
              ลองใหม่อีกครั้ง
            </Button>
          </div>
        )}

        {phase === "unconfirmed" && (
          <div className="p-7 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-amber-50">
              <Loader2 size={30} className="animate-spin text-amber-500" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-brand-ink">กำลังรอผลการชำระเงิน</h3>
            <p className="mt-2 text-sm text-slate-500">
              ระบบยังยืนยันผลไม่ได้ในขณะนี้ หากเงินถูกตัดแล้ว คำสั่งซื้อจะขึ้นในบัญชีของคุณภายในไม่กี่นาที
            </p>
            <p className="mt-2 text-xs text-slate-500">ปกติจะทราบผลภายใน 5 นาที · กรุณาอย่าชำระเงินซ้ำ เพื่อไม่ให้ถูกตัดเงินสองครั้ง</p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Button href="/account/orders">
                ตรวจสอบคำสั่งซื้อของฉัน
              </Button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
              >
                ปิด
              </button>
            </div>
          </div>
        )}
        {/* Leaving mid-payment, asked in the app's own words: a native
            confirm() cannot be styled, looks different in every browser, and
            arrives as a system alert in the middle of paying for something. */}
        {confirmingClose && (
          <div className="absolute inset-0 z-10 grid place-items-center bg-black/40 p-4">
            <div className="w-full max-w-xs rounded-xl2 bg-white p-5 text-center shadow-cardHover" role="alertdialog" aria-modal="true">
              <h3 className="text-base font-bold text-brand-ink">ปิดหน้าต่างการชำระเงิน?</h3>
              <p className="mt-1.5 text-sm text-slate-600">การชำระเงินยังไม่เสร็จสิ้น ถ้าปิดตอนนี้รายการจะยังไม่ถูกบันทึก</p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingClose(false)}
                  className="min-h-11 rounded-full bg-brand-800 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800 focus-visible:ring-offset-2"
                >
                  ชำระเงินต่อ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingClose(false);
                    onClose();
                  }}
                  className="min-h-11 rounded-full border border-slate-200 text-sm font-semibold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
