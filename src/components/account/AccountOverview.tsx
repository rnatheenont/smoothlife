"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  CreditCard,
  Heart,
  Lock,
  MessageSquareText,
  LogOut,
  MapPin,
  PackageCheck,
  PackageSearch,
  Receipt,
  Repeat,
  Sparkles,
  Truck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import type { Tier } from "@/lib/auth-context";
import { tierCard, tierDisplayName } from "@/lib/tier";
import { Avatar } from "@/components/ui";
import SkinScanSummaryCard from "@/components/account/SkinScanSummaryCard";
import { TIER_CRITERIA, loyaltyTierProgress } from "@/lib/loyalty-shared";
import { formatTHB } from "@/lib/format";
import type { AddressRow } from "@/app/api/account/addresses/route";

// The account overview, laid out to the owner's design: a greeting, one wide
// membership strip, the Skin Coach invitation, the four order states as
// counters, then the settings rows. Every entry appears exactly once — a link
// that already exists in the sidebar group for its own section is not
// repeated here.

type Step = { key: string; state: "done" | "current" | "todo" };
type OrderRow = {
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: string | null;
  tracking?: { shipments: { steps: Step[] }[] };
};

type Counts = { toPay: number; preparing: number; shipping: number; delivered: number; total: number };

const UNPAID = ["PENDING", "UNPAID", "PARTIALLY_PAID", "AUTHORIZED"];

function isDelivered(order: OrderRow): boolean {
  const shipments = order.tracking?.shipments ?? [];
  if (shipments.length === 0) return false;
  return shipments.every((s) => s.steps.some((st) => st.key === "delivered" && st.state !== "todo"));
}

function countOrders(orders: OrderRow[]): Counts {
  const live = orders.filter((o) => !o.cancelledAt);
  const paid = (o: OrderRow) => !UNPAID.includes(o.financialStatus || "");
  return {
    toPay: live.filter((o) => !paid(o)).length,
    preparing: live.filter((o) => paid(o) && (o.fulfillmentStatus || "UNFULFILLED") !== "FULFILLED").length,
    shipping: live.filter((o) => o.fulfillmentStatus === "FULFILLED" && !isDelivered(o)).length,
    delivered: live.filter((o) => isDelivered(o)).length,
    total: live.length,
  };
}

function Counter({ icon: Icon, label, count, href }: { icon: LucideIcon; label: string; count: number | null; href: string }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1 py-2 text-center">
      <span className="flex items-center gap-2">
        <Icon size={22} strokeWidth={1.6} className="text-brand-800" aria-hidden="true" />
        <span className="text-xl font-bold tabular-nums text-brand-ink">{count ?? "–"}</span>
      </span>
      <span className="text-xs text-slate-500">{label}</span>
    </Link>
  );
}

function SettingRow({
  icon: Icon,
  label,
  desc,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  desc: string;
  value?: string;
  href: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-mist/60 md:px-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-brand-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-slate-500">{desc}</span>
      </span>
      {value && <span className="hidden max-w-[35%] truncate text-right text-xs text-slate-500 sm:block">{value}</span>}
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </Link>
  );
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 1)}${"*".repeat(Math.max(3, name.length - 1))}@${domain}`;
}

export default function AccountOverview() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [addressCount, setAddressCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/account/orders")
      .then((r) => r.json())
      .then((d) => alive && setCounts(countOrders(Array.isArray(d?.orders) ? d.orders : [])))
      .catch(() => alive && setCounts({ toPay: 0, preparing: 0, shipping: 0, delivered: 0, total: 0 }));
    fetch("/api/account/addresses")
      .then((r) => r.json())
      .then((d) => alive && setAddressCount((d.addresses as AddressRow[] | undefined)?.length ?? 0))
      .catch(() => alive && setAddressCount(null));
    return () => {
      alive = false;
    };
  }, []);

  if (!user) return null;

  const card = tierCard[user.tier];
  const spend = user.tierSpend ?? 0;
  const progress = loyaltyTierProgress(spend, user.tierOrders ?? 0);
  const topThreshold = TIER_CRITERIA[TIER_CRITERIA.length - 1].minSpend;
  const nextThreshold = TIER_CRITERIA.find((t) => t.name === progress.next)?.minSpend ?? topThreshold;
  const ladderPercent = Math.min(100, Math.round((spend / topThreshold) * 100));

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold text-brand-ink md:text-3xl">สวัสดี คุณ {user.name.split(" ")[0]}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
          จัดการข้อมูลบัญชีของคุณได้ที่นี่
          <Link href="/account/profile" className="flex items-center gap-0.5 font-semibold text-brand-800">
            แก้ไขโปรไฟล์ <ChevronRight size={14} />
          </Link>
        </p>
      </div>

      {/* Membership. A tinted card with the tier's colour along its top edge —
          desktop keeps the owner's one-row strip, a phone gets the same facts
          regrouped into a panel of two numbers and one full-width button. */}
      <div className="relative overflow-hidden rounded-2xl shadow-cardHover ring-1 ring-black/5">
        <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: card.gradient }} aria-hidden="true" />
        <span
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-70"
          style={{ background: card.shine }}
          aria-hidden="true"
        />
        <span
          className="pointer-events-none absolute -bottom-24 -left-10 h-44 w-44 rounded-full opacity-50"
          style={{ background: card.shine }}
          aria-hidden="true"
        />
        <div
          className="relative p-4 pt-5 md:p-6"
          style={{ background: `linear-gradient(115deg, ${card.shine}, rgba(255,255,255,0.75))` }}
        >
          {/* Phone */}
          <div className="md:hidden">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-2 ring-white">
                <Avatar src={user.avatar} name={user.name} className="h-14 w-14" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Smoothlife Member</p>
                <p className="text-lg font-bold leading-tight text-brand-ink">{tierDisplayName[user.tier].en} Member</p>
                <p className="truncate text-xs text-slate-500">{user.name}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 divide-x divide-black/5 rounded-xl bg-white/80 py-3 shadow-sm ring-1 ring-black/5">
              <Link href="/account/points" className="px-3">
                <span className="block text-[11px] text-slate-500">คะแนนสะสม</span>
                <span className="flex items-baseline gap-1 text-xl font-bold text-brand-ink">
                  {user.points.toLocaleString("th-TH")}
                  <span className="text-xs font-medium text-slate-500">แต้ม</span>
                </span>
              </Link>
              <div className="px-3">
                <span className="block text-[11px] text-slate-500">ยอดเลื่อนระดับ</span>
                <span className="flex items-baseline gap-1 text-xl font-bold text-brand-ink">
                  {formatTHB(spend)}
                  {progress.next && <span className="text-xs font-medium text-slate-500">/ {formatTHB(nextThreshold)}</span>}
                </span>
              </div>
            </div>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
              <div className="h-full rounded-full" style={{ width: `${Math.max(ladderPercent, 2)}%`, background: card.gradient }} />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              {progress.next
                ? `อีก ${formatTHB(progress.remaining)} เพื่อเป็น ${tierDisplayName[progress.next as Tier].en}`
                : "คุณอยู่ระดับสูงสุดแล้ว"}
            </p>

            <div className="mt-4 flex items-center gap-2">
              <Link
                href="/loyalty"
                className="flex-1 rounded-full bg-brand-800 px-5 py-2.5 text-center text-sm font-semibold text-white"
              >
                ดูสิทธิประโยชน์
              </Link>
              <Link
                href="/account/points"
                className="rounded-full border border-black/10 bg-white/70 px-4 py-2.5 text-sm font-semibold text-brand-ink"
              >
                รายละเอียด
              </Link>
            </div>
          </div>

          {/* Desktop */}
          <div className="hidden gap-6 md:grid md:grid-cols-[1.1fr_auto_0.9fr_auto_auto] md:items-center">
            <div className="flex items-center gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-white ring-2 ring-white">
                <Avatar src={user.avatar} name={user.name} className="h-14 w-14" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Smoothlife Member</p>
                <p className="mt-0.5 text-lg font-bold text-brand-ink">{tierDisplayName[user.tier].en} Member</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{user.name}</p>
              </div>
            </div>

            <span className="h-14 w-px bg-black/10" aria-hidden="true" />

            <Link href="/account/points" className="block">
              <span className="text-xs text-slate-500">คะแนนสะสมของคุณ</span>
              <span className="flex items-center gap-1 text-2xl font-bold text-brand-ink">
                {user.points.toLocaleString("th-TH")}
                <span className="text-sm font-medium text-slate-500">แต้ม</span>
                <ChevronRight size={16} className="text-slate-400" />
              </span>
            </Link>

            <div className="w-48">
              <p className="text-xs text-slate-500">ยอดใช้จ่ายเพื่อเลื่อนระดับ</p>
              <p className="mt-0.5 flex items-baseline gap-1 text-lg font-bold text-brand-ink">
                {formatTHB(spend)}
                {progress.next && <span className="text-xs font-medium text-slate-500">/ {formatTHB(nextThreshold)}</span>}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full" style={{ width: `${Math.max(ladderPercent, 2)}%`, background: card.gradient }} />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {progress.next
                  ? `อีก ${formatTHB(progress.remaining)} เพื่อเป็น ${tierDisplayName[progress.next as Tier].en}`
                  : "คุณอยู่ระดับสูงสุดแล้ว"}
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              <Link
                href="/loyalty"
                className="inline-flex items-center gap-1 rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white"
              >
                ดูสิทธิประโยชน์ <ChevronRight size={15} />
              </Link>
              <Link href="/account/points" className="flex items-center gap-0.5 text-xs font-semibold text-slate-600">
                รายละเอียดระดับสมาชิก <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Everything about skin in one place: the invitation to scan, and the
          scans already saved. */}
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-brand-ink">ผิวของฉัน</h2>
        <div className="flex flex-col gap-3 rounded-xl2 bg-brand-gradient-soft p-4 sm:flex-row sm:items-center sm:gap-4 md:px-6">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-brand-800 sm:mr-1">
          <Sparkles size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 sm:-ml-1">
          <p className="text-sm font-bold text-brand-ink">ปรึกษาผู้เชี่ยวชาญผิว AI</p>
          <p className="mt-0.5 text-xs text-slate-600">รับคำแนะนำสกินแคร์ที่เหมาะกับคุณ ฟรี!</p>
        </div>
        <Link
            href="/skin-coach"
            className="w-full shrink-0 rounded-full border border-brand-teal bg-white px-5 py-2.5 text-center text-sm font-semibold text-brand-800 sm:w-auto"
          >
            เปิด Skin Coach
          </Link>
        </div>
        <SkinScanSummaryCard />
      </div>

      {/* Orders */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-brand-ink">คำสั่งซื้อของฉัน</h2>
          <Link href="/account/orders" className="flex items-center gap-0.5 text-sm font-semibold text-brand-800">
            ดูคำสั่งซื้อทั้งหมด <ChevronRight size={15} />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-1">
          <Counter icon={CreditCard} label="รอชำระเงิน" count={counts?.toPay ?? null} href="/account/orders" />
          <Counter icon={PackageSearch} label="กำลังจัดเตรียม" count={counts?.preparing ?? null} href="/account/orders" />
          <Counter icon={Truck} label="อยู่ระหว่างจัดส่ง" count={counts?.shipping ?? null} href="/account/orders" />
          <Counter icon={PackageCheck} label="จัดส่งแล้ว" count={counts?.delivered ?? null} href="/account/orders" />
        </div>

        {counts?.total === 0 && (
          <div className="mt-3 rounded-xl2 border border-surface-line bg-white px-6 py-10 text-center shadow-card">
            <PackageSearch size={34} strokeWidth={1.3} className="mx-auto text-slate-300" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-brand-ink">ยังไม่มีคำสั่งซื้อ</p>
            <p className="mt-1 text-xs text-slate-500">เริ่มช้อปสินค้าที่คุณชื่นชอบ เพื่อดูประวัติคำสั่งซื้อได้ที่นี่</p>
            <Link
              href="/shop"
              className="mt-4 inline-block rounded-full bg-brand-800 px-6 py-2.5 text-sm font-semibold text-white"
            >
              เลือกซื้อสินค้า
            </Link>
          </div>
        )}
      </div>

      {/* Settings and the rest of the account */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-brand-ink">ข้อมูลและการตั้งค่า</h2>
        <div className="divide-y divide-surface-line overflow-hidden rounded-xl2 border border-surface-line bg-white shadow-card">
          <SettingRow
            icon={User}
            label="ข้อมูลส่วนตัว"
            desc="จัดการชื่อ เบอร์โทรศัพท์ อีเมล และข้อมูลบัญชี"
            value={user.email ? maskEmail(user.email) : user.phone || undefined}
            href="/account/profile"
          />
          <SettingRow
            icon={MapPin}
            label="ที่อยู่จัดส่ง"
            desc="จัดการที่อยู่สำหรับการจัดส่งสินค้า"
            value={addressCount === null ? undefined : `${addressCount} ที่อยู่`}
            href="/account/addresses"
          />
          <SettingRow icon={Receipt} label="ที่อยู่ใบกำกับภาษี" desc="สำหรับขอใบกำกับภาษีเต็มรูปแบบ" href="/account/tax-addresses" />
          <SettingRow icon={Lock} label="ความปลอดภัย" desc="เปลี่ยนรหัสผ่าน และตั้งค่าความปลอดภัยบัญชี" href="/account/change-password" />
          <SettingRow icon={Repeat} label="สมัครรายเดือน" desc="แพ็กเกจที่กำลังใช้งานและรอบตัดเงิน" href="/account/subscriptions" />
          <SettingRow icon={Users} label="แนะนำเพื่อน" desc="ชวนเพื่อนมาช้อป รับส่วนลดคนละ ฿100" href="/account/referral" />
          <SettingRow icon={Heart} label="รายการโปรด" desc="สินค้าที่คุณบันทึกไว้" href="/account/wishlist" />
          <SettingRow icon={MessageSquareText} label="รีวิวของฉัน" desc="รีวิวที่เขียนไว้และแต้มที่ได้รับ" href="/account/reviews" />
        </div>
      </div>

      <button
        onClick={() => {
          logout();
          router.push("/");
        }}
        className="flex w-full items-center justify-center gap-2 rounded-xl2 border border-rose-200 py-3 text-sm font-semibold text-rose-700 lg:hidden"
      >
        <LogOut size={16} />
        ออกจากระบบ
      </button>
    </div>
  );
}
