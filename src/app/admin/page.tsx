"use client";

import { useCallback, useEffect, useState } from "react";
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
  BookOpen,
  Loader2,
  HelpCircle,
  RefreshCw,
  Truck,
  Users,
  Zap,
  LayoutDashboard,
  CheckCircle2,
} from "lucide-react";
import { useAdminAction } from "@/components/admin/header-action";
import { PageHeader, SectionLabel, StatCard } from "@/components/admin/layout-kit";

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
  flashRunning: number | null;
  flashScheduled: number | null;
  flashOrdersFailed: number | null;
  refundsPending: number | null;
  kbDrafts: number | null;
  kbReviewDue: number | null;
};

const EMPTY: Stats = {
  waitingChats: null,
  pendingReviews: null,
  paidToday: null,
  activeSubs: null,
  subscribableOn: null,
  openQuestions: null,
  flashRunning: null,
  flashScheduled: null,
  flashOrdersFailed: null,
  refundsPending: null,
  kbDrafts: null,
  kbReviewDue: null,
};

export default function AdminHomePage() {
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/overview", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d.ok && setStats({ ...EMPTY, ...d.stats }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAdminAction({
    label: "รีเฟรชตัวเลข",
    icon: <RefreshCw size={15} aria-hidden />,
    onClick: load,
    disabled: loading,
  });

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
    {
      href: "/admin/flash-sale",
      icon: Zap,
      label: "Flash Sale · จ่ายแล้วแต่ไม่มีออเดอร์",
      value: stats.flashOrdersFailed,
      unit: "ราย",
    },
    {
      href: "/admin/checkout-transactions",
      icon: Receipt,
      label: "รอคืนเงิน (Flash Sale)",
      value: stats.refundsPending,
      unit: "รายการ",
    },
    {
      href: "/admin/knowledge-base",
      icon: BookOpen,
      label: "ความรู้ AI รออนุมัติ",
      value: stats.kbDrafts,
      unit: "บทความ",
    },
    {
      href: "/admin/knowledge-base",
      icon: BookOpen,
      label: "ความรู้ถึงรอบรีวิว",
      value: stats.kbReviewDue,
      unit: "บทความ",
    },
  ];

  const today = [
    {
      icon: Receipt,
      label: "ชำระเงินสำเร็จวันนี้",
      value: stats.paidToday,
      unit: "รายการ",
      href: "/admin/checkout-transactions",
    },
    { icon: Zap, label: "Flash Sale กำลังขาย", value: stats.flashRunning, unit: "แคมเปญ", href: "/admin/flash-sale" },
    { icon: Zap, label: "Flash Sale รอเริ่ม", value: stats.flashScheduled, unit: "แคมเปญ", href: "/admin/flash-sale" },
    {
      icon: Repeat,
      label: "สมาชิกที่ยังใช้งานอยู่",
      value: stats.activeSubs,
      unit: "ราย",
      href: "/admin/subscription-products",
    },
    {
      icon: Repeat,
      label: "สินค้าที่เปิดสมัครสมาชิก",
      value: stats.subscribableOn,
      unit: "รายการ",
      href: "/admin/subscription-products",
    },
  ];

  const sections = [
    { href: "/admin/inbox", icon: Inbox, label: "กล่องข้อความ", desc: "ตอบแชทลูกค้าทุกช่องทางจากที่เดียว" },
    { href: "/admin/free-gifts", icon: Gift, label: "โปรโมชั่น", desc: "ของแถมและแคมเปญหน้าร้าน" },
    {
      href: "/admin/free-gifts/widgets",
      icon: SlidersHorizontal,
      label: "Widgets",
      desc: "เปิด/ปิดกล่องโปรโมชั่นบนหน้าเว็บ",
    },
    { href: "/admin/points", icon: Award, label: "คะแนน", desc: "ปรับแต้มลูกค้าและตั้งของรางวัล" },
    { href: "/admin/reviews", icon: MessageSquareText, label: "รีวิวรออนุมัติ", desc: "ตรวจรีวิวก่อนขึ้นหน้าเว็บ" },
    { href: "/admin/gift-cards", icon: CreditCard, label: "บัตรของขวัญ", desc: "ออกและตรวจสอบบัตรของขวัญ" },
    {
      href: "/admin/subscription-products",
      icon: Repeat,
      label: "สินค้าสมัครสมาชิก",
      desc: "เลือกสินค้าที่สมัครรับประจำได้",
    },
    {
      href: "/admin/checkout-transactions",
      icon: Receipt,
      label: "รายการซื้อ (2C2P)",
      desc: "ตรวจการชำระเงินและคืนเงิน",
    },
    { href: "/admin/flash-sale", icon: Zap, label: "Flash Sale", desc: "ตั้งแคมเปญ คิวจริง และหน้าขายแบบพิเศษ" },
    {
      href: "/admin/knowledge-base",
      icon: BookOpen,
      label: "ฐานความรู้ AI",
      desc: "คำตอบที่อนุมัติแล้วให้ AI ใช้ตอบลูกค้า",
    },
    { href: "/admin/tracking-sync", icon: Truck, label: "ซิงก์เลขพัสดุ", desc: "ดึงเลขพัสดุจาก soko เข้า Shopify" },
    { href: "/admin/customers", icon: Users, label: "ลูกค้า & ผูกบัญชี", desc: "ค้นหาลูกค้าและผูกบัญชี LINE" },
  ];

  // Zero is the answer most of these give most days, and seven cards saying
  // zero is a page that has to be read before it can be dismissed. The ones
  // with something in them are shown full size; the rest say so in one line.
  const urgent = needsAttention.filter((c) => (c.value ?? 0) > 0);
  const clear = needsAttention.filter((c) => c.value === 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={<LayoutDashboard size={20} className="text-brand-600" />}
        title="ภาพรวมหลังบ้าน"
        subtitle="สรุปสิ่งที่ต้องดูวันนี้ แล้วค่อยเข้าไปจัดการในแต่ละหน้า"
      />

      <section>
        <SectionLabel className="mb-2">ต้องดำเนินการ</SectionLabel>
        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[76px] animate-pulse rounded-xl2 border border-slate-100 bg-slate-50/60" />
            ))}
          </div>
        ) : urgent.length === 0 ? (
          <p className="flex items-center gap-2 rounded-xl2 border border-emerald-100 bg-emerald-50/50 p-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" /> ไม่มีอะไรค้าง — ทุกคิวเคลียร์หมดแล้ว
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {urgent.map((c) => (
              <StatCard
                key={c.label}
                href={c.href}
                tone="alert"
                icon={<c.icon size={13} className="text-amber-600" />}
                label={c.label}
                value={show(c.value)}
                unit={c.unit}
              />
            ))}
          </div>
        )}
        {/* The cleared ones, kept visible: "no pending reviews" and "the
            review count failed to load" are different answers, and a card
            that disappears cannot tell them apart. */}
        {clear.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-slate-400">
            {clear.map((c) => (
              <Link key={c.label} href={c.href} className="hover:text-slate-600">
                {c.label} 0
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionLabel className="mb-2">สถานะร้าน</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {today.map((c) => (
            <StatCard
              key={c.label}
              href={c.href}
              icon={<c.icon size={13} className="text-slate-400" />}
              label={c.label}
              value={loading ? <Loader2 size={18} className="animate-spin text-slate-300" /> : show(c.value)}
              unit={c.unit}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionLabel className="mb-2">ทั้งหมด</SectionLabel>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href + s.label}
                href={s.href}
                className="group flex items-start gap-3 rounded-xl2 border border-slate-100 bg-white p-4 transition-colors hover:border-brand-teal/40"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-l bg-brand-gradient-soft">
                  <Icon size={16} className="text-brand-emerald" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-brand-ink">{s.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-400">{s.desc}</span>
                </span>
                <ArrowRight
                  size={15}
                  className="mt-1 shrink-0 text-slate-300 transition-colors group-hover:text-brand-emerald"
                />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
