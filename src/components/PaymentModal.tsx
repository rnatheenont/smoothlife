"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, X, ExternalLink, AlertTriangle } from "lucide-react";
import { formatTHB } from "@/lib/format";

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

const STUCK_HINT_AFTER_MS = 20_000;
const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 90_000;

export default function PaymentModal({
  webPaymentUrl,
  cartToken,
  onClose,
  onPaid,
}: {
  webPaymentUrl: string;
  cartToken: string;
  /** Customer backed out — the order was never paid. */
  onClose: () => void;
  /** Confirmed paid by our own backend, not by the redirect. */
  onPaid: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("paying");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [showStuckHint, setShowStuckHint] = useState(false);
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

  useEffect(() => {
    if (phase !== "verifying") return;
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
  }, [phase, cartToken]);

  useEffect(() => {
    if (phase === "success" && !paidNotified.current) {
      paidNotified.current = true;
      onPaid();
    }
  }, [phase, onPaid]);

  function requestClose() {
    if (phase === "paying" || phase === "verifying") {
      if (!window.confirm("การชำระเงินยังไม่เสร็จสิ้น ต้องการปิดหน้าต่างนี้หรือไม่?")) return;
    }
    onClose();
  }

  const isResult = phase === "success" || phase === "failed" || phase === "unconfirmed";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={requestClose} />

      <div
        className={`relative flex w-full flex-col overflow-hidden rounded-xl2 bg-white shadow-cardHover animate-fadeUp ${
          isResult ? "max-w-sm" : "h-[88vh] max-w-2xl"
        }`}
        role="dialog"
        aria-modal="true"
      >
        {!isResult && (
          <>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-bold text-brand-ink">
                {phase === "verifying" ? "กำลังยืนยันการชำระเงิน..." : "ชำระเงินอย่างปลอดภัย"}
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={webPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[11px] font-semibold text-brand-emerald"
                >
                  <ExternalLink size={12} /> เปิดในแท็บใหม่
                </a>
                <button type="button" onClick={requestClose} aria-label="ปิด">
                  <X size={18} className="text-slate-400" />
                </button>
              </div>
            </div>

            {showStuckHint && phase === "paying" && (
              <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50 px-4 py-2.5 text-[11px] text-amber-800">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>
                  หน้าชำระเงินไม่ขึ้นหรือค้างอยู่? บางธนาคารไม่อนุญาตให้แสดงหน้ากรอก OTP ในกรอบนี้ —{" "}
                  <a
                    href={webPaymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline"
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
                className="h-full w-full"
                // The payment page needs to run scripts, submit its own forms
                // and redirect itself into the issuer's 3DS page.
                sandbox="allow-scripts allow-forms allow-same-origin allow-top-navigation-by-user-activation allow-popups"
              />
              {phase === "verifying" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/95">
                  <Loader2 size={28} className="animate-spin text-brand-emerald" />
                  <p className="text-sm text-slate-500">กำลังตรวจสอบผลการชำระเงิน...</p>
                  <p className="text-[11px] text-slate-400">กรุณาอย่าปิดหน้าต่างนี้</p>
                </div>
              )}
            </div>
          </>
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
                เลขคำสั่งซื้อ <span className="font-semibold text-brand-ink">{orderId}</span>
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              เราได้รับคำสั่งซื้อของคุณแล้ว รายละเอียดการจัดส่งจะถูกส่งไปที่อีเมลของคุณ
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href="/account/orders"
                className="rounded-full bg-brand-gradient py-2.5 text-sm font-semibold text-white"
              >
                ดูคำสั่งซื้อของฉัน
              </Link>
              <Link href="/shop" className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600">
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
            <p className="mt-2 text-xs text-slate-400">สินค้าในตะกร้ายังอยู่ครบ ลองชำระเงินใหม่ได้เลย</p>
            <button
              type="button"
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-brand-gradient py-2.5 text-sm font-semibold text-white"
            >
              ลองใหม่อีกครั้ง
            </button>
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
            <p className="mt-2 text-xs text-slate-400">กรุณาอย่าชำระเงินซ้ำ เพื่อไม่ให้ถูกตัดเงินสองครั้ง</p>
            <div className="mt-6 flex flex-col gap-2.5">
              <Link
                href="/account/orders"
                className="rounded-full bg-brand-gradient py-2.5 text-sm font-semibold text-white"
              >
                ตรวจสอบคำสั่งซื้อของฉัน
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-slate-600"
              >
                ปิด
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
