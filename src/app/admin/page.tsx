"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Inbox,
  Gift,
  SlidersHorizontal,
  Award,
  MessageSquareText,
  CreditCard,
  Repeat,
  Receipt,
  ArrowRight,
  Loader2,
  HelpCircle,
} from "lucide-react";

// Admin home. It used to redirect straight into the promotions screen, which
// meant the answer to "what needs me today?" was: open all seven pages and
// look. This lists the same destinations, but leads with the two things that
// actually queue up — chats waiting for a human, reviews waiting for approval
// — and marks them when they are non-zero so they can be ignored when they are.

type Stats = {
  waitingChats: number | null;
  pendingReviews: number | null;
  paidToday: number | null;
  activeSubs: number | null;
  subscribableOn: number | null;
  openQuestions: number | null;
};

const EMPTY: Stats = {
  waitingChats: null,
  pendingReviews: null,
  paidToday: null,
  activeSubs: null,
  subscribableOn: null,
  openQuestions: null,
};

export default function AdminHomePage() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/overview")
      .then((r) => r.json())
      .then((d) => d.ok && setStats({ ...EMPTY, ...d.stats }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Anything past this is "a lot" — the exact number changes nothing about
  // what the reader does next.
  const show = (n: number | null) => (n === null ? "—" : n >= 100 ? "99+" : String(n));

  const needsAttention = [
    {
      href: "/admin/inbox",
      icon: Inbox,
      label: "แชทรอทีมงานตอบ",
      value: stats.waitingChats,
      unit: "บทสนทนา",
    },
    {
      href: "/admin/reviews",
      icon: MessageSquareText,
      label: "รีวิวรออนุมัติ",
      value: stats.pendingReviews,
      unit: "รีวิว",
    },
    {
      href: "/admin/inbox",
      icon: HelpCircle,
      label: "คำถามสินค้ายังไม่ตอบ",
      value: stats.openQuestions,
      unit: "คำถาม",
    },
  ];

  const today = [
    { icon: Receipt, label: "ชำระเงินสำเร็จวันนี้", value: stats.paidToday, unit: "รายการ", href: "/admin/checkout-transactions" },
    { icon: Repeat, label: "สมาชิกที่ยังใช้งานอยู่", value: stats.activeSubs, unit: "ราย", href: "/admin/subscription-products" },
    { icon: Repeat, label: "สินค้าที่เปิดสมัครสมาชิก", value: stats.subscribableOn, unit: "รายการ", href: "/admin/subscription-products" },
  ];

  const sections = [
    { href: "/admin/inbox", icon: Inbox, label: "กล่องข้อความ", desc: "ตอบแชทลูกค้าทุกช่องทางจากที่เดียว" },
    { href: "/admin/free-gifts", icon: Gift, label: "โปรโมชั่น", desc: "ของแถมและแคมเปญหน้าร้าน" },
    { href: "/admin/free-gifts/widgets", icon: SlidersHorizontal, label: "Widgets", desc: "เปิด/ปิดกล่องโปรโมชั่นบนหน้าเว็บ" },
    { href: "/admin/points", icon: Award, label: "คะแนน", desc: "ปรับแต้มลูกค้าและตั้งของรางวัล" },
    { href: "/admin/reviews", icon: MessageSquareText, label: "รีวิวรออนุมัติ", desc: "ตรวจรีวิวก่อนขึ้นหน้าเว็บ" },
    { href: "/admin/gift-cards", icon: CreditCard, label: "บัตรของขวัญ", desc: "ออกและตรวจสอบบัตรของขวัญ" },
    { href: "/admin/subscription-products", icon: Repeat, label: "สินค้าสมัครสมาชิก", desc: "เลือกสินค้าที่สมัครรับประจำได้" },
    { href: "/admin/checkout-transactions", icon: Receipt, label: "รายการซื้อ (2C2P)", desc: "ตรวจการชำระเงินและคืนเงิน" },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-brand-ink">ภาพรวมหลังบ้าน</h1>
        <p className="mt-1 text-sm text-slate-500">สรุปสิ่งที่ต้องดูวันนี้ แล้วค่อยเข้าไปจัดการในแต่ละหน้า</p>
      </div>

      <h2 className="mb-2 text-xs font-semibold text-slate-400">ต้องดำเนินการ</h2>
      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        {needsAttention.map((c) => {
          const Icon = c.icon;
          const urgent = (c.value ?? 0) > 0;
          return (
            <Link
              key={c.label}
              href={c.href}
              className={`rounded-xl2 border p-4 transition-colors ${
                urgent ? "border-amber-200 bg-amber-50/60 hover:border-amber-300" : "border-slate-100 hover:border-slate-200"
              }`}
            >
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon size={13} className={urgent ? "text-amber-600" : "text-slate-400"} /> {c.label}
              </p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className={`text-2xl font-bold ${urgent ? "text-amber-700" : "text-slate-300"}`}>
                  {loading ? <Loader2 size={18} className="animate-spin text-slate-300" /> : show(c.value)}
                </span>
                <span className="text-xs text-slate-400">{c.unit}</span>
              </p>
            </Link>
          );
        })}
      </div>

      <h2 className="mb-2 text-xs font-semibold text-slate-400">สถานะร้าน</h2>
      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        {today.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.label}
              href={c.href}
              className="rounded-xl2 border border-slate-100 p-4 transition-colors hover:border-slate-200"
            >
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Icon size={13} className="text-slate-400" /> {c.label}
              </p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-brand-ink">
                  {loading ? <Loader2 size={18} className="animate-spin text-slate-300" /> : show(c.value)}
                </span>
                <span className="text-xs text-slate-400">{c.unit}</span>
              </p>
            </Link>
          );
        })}
      </div>

      <h2 className="mb-2 text-xs font-semibold text-slate-400">ทั้งหมด</h2>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href + s.label}
              href={s.href}
              className="group flex items-start gap-3 rounded-xl2 border border-slate-100 p-4 transition-colors hover:border-brand-teal/40"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-gradient-soft">
                <Icon size={16} className="text-brand-emerald" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-brand-ink">{s.label}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{s.desc}</span>
              </span>
              <ArrowRight size={15} className="mt-1 shrink-0 text-slate-300 transition-colors group-hover:text-brand-emerald" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
