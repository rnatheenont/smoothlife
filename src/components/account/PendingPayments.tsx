"use client";

// Payments that never turned into an order, said plainly.
//
// Every message here answers the question the customer already has in front of
// them — "the bank says my money is gone, so where is my order" — and the most
// common true answer is the least obvious one: a bank can hold an amount on a
// card it then declines, and release it days later. Nobody guesses that, so the
// page says it.
import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Info } from "lucide-react";
import { formatTHB } from "@/lib/format";
import type { AccountPaymentKind } from "@/app/api/account/payments/route";

type Payment = {
  invoiceNo: string;
  amount: number;
  createdAt: string;
  isFlashSale: boolean;
  kind: AccountPaymentKind;
  attempts: number;
};

const COPY: Record<AccountPaymentKind, { title: string; body: string; tone: string; Icon: typeof Info }> = {
  failed: {
    title: "การชำระเงินไม่สำเร็จ",
    body:
      "ไม่มีการเรียกเก็บเงินจากบัญชีของคุณ หากเห็นยอดนี้ในแอปธนาคาร นั่นคือวงเงินที่ธนาคารกันไว้ชั่วคราว " +
      "และจะคืนให้อัตโนมัติภายใน 3–14 วัน หากเกินกว่านั้น กรุณาติดต่อธนาคารผู้ออกบัตร",
    tone: "border-slate-200 bg-slate-50 text-slate-700",
    Icon: Info,
  },
  unresolved: {
    title: "ยังยืนยันผลการชำระเงินไม่ได้",
    body:
      "เรากำลังตรวจสอบกับผู้ให้บริการชำระเงิน หากเงินถูกตัดไปแล้ว ทีมงานจะติดต่อกลับและดำเนินการให้ " +
      "กรุณาอย่าชำระเงินซ้ำ เพื่อไม่ให้ถูกตัดสองครั้ง",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    Icon: Clock,
  },
  paid_no_order: {
    title: "ได้รับเงินแล้ว แต่ยังไม่มีคำสั่งซื้อ",
    body: "ทีมงานกำลังตรวจสอบและจะติดต่อกลับโดยเร็ว หากต้องการสอบถามเพิ่มเติม ทักหาเราทาง LINE ได้เลย",
    tone: "border-rose-200 bg-rose-50 text-rose-900",
    Icon: AlertTriangle,
  },
  refund_pending: {
    title: "เราได้รับเงินของคุณหลังสิทธิ์จองหมดเวลา",
    body: "ทีมงานจะคืนเงินเต็มจำนวนไปยังช่องทางที่คุณชำระ ไม่ต้องทำอะไรเพิ่ม",
    tone: "border-amber-200 bg-amber-50 text-amber-900",
    Icon: AlertTriangle,
  },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function PendingPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/account/payments", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.ok) setPayments(d.payments as Payment[]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (payments.length === 0) return null;

  return (
    <div className="mb-5 flex flex-col gap-3">
      {payments.map((p) => {
        const copy = COPY[p.kind];
        return (
          <div key={p.invoiceNo} className={`rounded-xl2 border p-4 text-sm leading-relaxed ${copy.tone}`}>
            <p className="flex items-center gap-2 font-bold">
              <copy.Icon size={15} aria-hidden /> {copy.title}
            </p>
            <p className="mt-1.5 text-[13px]">{copy.body}</p>
            <p className="mt-2 text-xs opacity-75">
              {formatTHB(p.amount)} · {when(p.createdAt)}
              {p.isFlashSale && " · Flash Sale"}
              {p.attempts > 1 && ` · ลองทั้งหมด ${p.attempts} ครั้ง`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
