"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/admin/layout-kit";
import { ArrowLeft, CreditCard } from "lucide-react";
import PaymentModal from "@/components/PaymentModal";

// Admin → ระบบดีไซน์ → หน้าชำระเงิน. Every screen of the payment modal, openable
// without a real charge: the whole point of this page is that nobody has to
// spend money to find out what a refusal looks like.

type Demo = {
  key: string;
  label: string;
  blurb: string;
  phase: "paying" | "verifying" | "success" | "failed" | "unconfirmed";
  data?: { orderId?: string; amount?: number; failureReason?: string };
};

const DEMOS: Demo[] = [
  {
    key: "paying",
    label: "1 · กำลังชำระเงิน",
    blurb: "แถบสรุปยอด + หน้าของ 2C2P ในกรอบ (มือถือเต็มจอ)",
    phase: "paying",
  },
  {
    key: "verifying",
    label: "2 · กำลังยืนยัน",
    blurb: "ลูกค้าจ่ายเสร็จ ระบบกำลังรอ webhook ยืนยัน",
    phase: "verifying",
  },
  {
    key: "success",
    label: "3 · สำเร็จ",
    blurb: "ยืนยันจากหลังบ้านแล้วเท่านั้นถึงขึ้นหน้านี้ พร้อมรายการสินค้า",
    phase: "success",
    data: { orderId: "#1042", amount: 1590 },
  },
  {
    key: "failed-funds",
    label: "4 · ไม่สำเร็จ · ยอดไม่พอ",
    blurb: "แปลเหตุผลจากธนาคารเป็นคำแนะนำที่ทำต่อได้",
    phase: "failed",
    data: { failureReason: "Insufficient funds" },
  },
  {
    key: "failed-otp",
    label: "5 · ไม่สำเร็จ · OTP ไม่ผ่าน",
    blurb: "เคสเดียวกันแต่คำแนะนำต่างกันตามสาเหตุ",
    phase: "failed",
    data: { failureReason: "3DS authentication failed" },
  },
  {
    key: "unconfirmed",
    label: "6 · ยังไม่รู้ผล",
    blurb: "ไม่ฟันธงผลลัพธ์ บอกว่าปกติทราบผลภายในกี่นาที",
    phase: "unconfirmed",
  },
];

export default function PaymentPreviewPage() {
  const [open, setOpen] = useState<Demo | null>(null);

  return (
    <div>
      <Link
        href="/admin/design"
        className="mb-2 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-brand-ink"
      >
        <ArrowLeft size={13} /> กลับไประบบดีไซน์
      </Link>
      <PageHeader
        icon={<CreditCard size={20} className="text-brand-emerald" />}
        title="หน้าชำระเงิน (ตัวอย่าง)"
        subtitle="ทุกสถานะของหน้าชำระเงินจริง เปิดดูได้โดยไม่ต้องจ่ายเงิน — ย่อหน้าต่างเบราว์เซอร์ให้แคบเพื่อดูแบบมือถือ (เต็มจอ)"
      />

      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {DEMOS.map((demo) => (
          <li key={demo.key}>
            <button
              type="button"
              onClick={() => setOpen(demo)}
              className="flex w-full flex-col items-start gap-1 rounded-xl2 bg-white p-4 text-left ring-1 ring-surface-line transition hover:ring-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-800"
            >
              <span className="text-sm font-semibold text-brand-ink">{demo.label}</span>
              <span className="text-xs text-slate-500">{demo.blurb}</span>
            </button>
          </li>
        ))}
      </ul>

      {open && (
        <PaymentModal
          key={open.key}
          // A page on this site stands in for 2C2P's, which will not load
          // without a real payment token.
          webPaymentUrl="/help"
          cartToken="preview"
          previewPhase={open.phase}
          previewData={open.data}
          summary={{
            total: 1590,
            items: [
              { name: "Dentiste' The Iconic Smile — KENG x NAMPING EDITION", quantity: 1 },
              { name: "Smooth E Baby Face Foam 1.5 oz", quantity: 2 },
            ],
          }}
          onClose={() => setOpen(null)}
          onPaid={() => {}}
        />
      )}
    </div>
  );
}
