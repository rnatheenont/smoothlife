"use client";

import { CalendarClock, CreditCard, XCircle } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { formatTHB } from "@/lib/format";

// Agreeing to a recurring charge, once, at the moment of paying.
//
// This used to be a checkbox beside every subscribe button — forty of them
// on the subscription page's grid, one per card, each gating its own button.
// A consent repeated forty times is not read forty times: it is the thing in
// the way of the button, and the shopper's job became clearing it. The terms
// also could not fit next to a card, so what each checkbox actually said was
// one clipped line of a longer arrangement.
//
// So it is asked once, here, at the step where the money starts moving, with
// the whole arrangement on screen: what is charged, how often, until when,
// and what happens at the end. Pressing a button that reads "ยอมรับและไป
// ชำระเงิน" with those terms in view is the affirmative act — the same
// clickwrap every payment page relies on, and more informed than a checkbox
// that had room for eleven words.
//
// The wording here follows SubscriptionTermsInfo, which is the one place the
// terms are written.

export default function SubscribeConsentDialog({
  open,
  onClose,
  onConfirm,
  itemName,
  months,
  pricePerCycle,
  discountPct,
  submitting = false,
  error,
}: {
  open: boolean;
  onClose: () => void;
  /** Runs the subscribe the button was going to run. */
  onConfirm: () => void;
  itemName: string;
  months: number;
  /** What is charged each month, after the term's discount. */
  pricePerCycle: number;
  discountPct: number;
  submitting?: boolean;
  error?: string | null;
}) {
  const terms = [
    {
      icon: CreditCard,
      text: (
        <>
          ตัดเงิน <strong className="text-brand-ink">{formatTHB(pricePerCycle)}</strong> ทุกเดือนจากบัตรที่ผูกไว้
          ในราคาที่ล็อกไว้ ไม่เปลี่ยนระหว่างเทอม
        </>
      ),
    },
    {
      icon: CalendarClock,
      text: (
        <>
          ครบ <strong className="text-brand-ink">{months} เดือน</strong> ระบบปิดรายการให้เอง
          <strong className="text-brand-ink"> ไม่มีต่อเทอมอัตโนมัติ</strong>
        </>
      ),
    },
    {
      icon: XCircle,
      text: (
        <>
          ยกเลิกได้ทุกเมื่อที่หน้า &ldquo;การสมัครของฉัน&rdquo; มีผลเมื่อจบเทอม
          รอบที่เหลือยังตัดเงินและจัดส่งตามปกติ ไม่มีค่าปรับ
        </>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="ยืนยันการสมัคร"
      description="อ่านเงื่อนไขการตัดเงินก่อนไปหน้าชำระเงิน"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            ยกเลิก
          </Button>
          <Button onClick={onConfirm} loading={submitting} disabled={submitting}>
            {submitting ? "กำลังไปหน้าชำระเงิน…" : "ยอมรับและไปชำระเงิน"}
          </Button>
        </>
      }
    >
      <div className="rounded-xl2 bg-surface-soft p-3.5">
        <p translate="no" className="text-sm font-bold text-brand-ink">
          {itemName}
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-xs text-slate-500">
            ราคา/เดือน {discountPct > 0 && `(-${discountPct}%)`} × {months} เดือน
          </span>
          <span className="text-lg font-extrabold text-brand-800">{formatTHB(pricePerCycle)}</span>
        </div>
        {/* The number nobody works out for themselves while deciding, and the
            one a complaint is always about. */}
        <p className="mt-1 text-right text-[11px] text-slate-500">
          รวมทั้งเทอม {formatTHB(pricePerCycle * months)}
        </p>
      </div>

      <ul className="mt-3.5 flex flex-col gap-2">
        {terms.map(({ icon: Icon, text }, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
            <Icon size={14} className="mt-0.5 shrink-0 text-brand-emerald" aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>

      {/* Says plainly what the button below is: the agreement itself. */}
      <p className="mt-3 text-[11px] text-slate-500">
        การกด &ldquo;ยอมรับและไปชำระเงิน&rdquo; ถือว่าคุณยอมรับให้ตัดเงินตามเงื่อนไขข้างต้น
      </p>

      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </Modal>
  );
}
