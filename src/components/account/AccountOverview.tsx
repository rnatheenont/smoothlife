"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  CheckCircle2,
  CreditCard,
  Crown,
  Gift,
  Heart,
  KeyRound,
  LogOut,
  MapPin,
  MessageCircle,
  Package,
  Receipt,
  Repeat,
  ScanFace,
  Ticket,
  RotateCcw,
  Truck,
  User,
  Users,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import RewardsOverviewCard from "@/components/account/RewardsOverviewCard";
import { coupons } from "@/data/coupons";
import SkinScanSummaryCard from "@/components/account/SkinScanSummaryCard";
import { orderStage, type OrderStage } from "@/lib/order-status";

// The account overview, laid out the way Thai shoppers already read a
// marketplace account page: who you are at the top, then the four order
// states as tappable tiles with counts, then points/coupons, then the
// services this shop actually has, then settings. Everything here links to a
// page that already existed — this screen is navigation, not new features.

type OrderRow = {
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: string | null;
  refunded?: string | null;
  items: { slug: string | null }[];
  tracking?: { shipments: { steps: { key: string; state: string }[] }[] };
};

type Counts = Record<OrderStage, number>;

function countOrders(orders: OrderRow[]): Counts {
  const counts: Counts = { to_pay: 0, to_ship: 0, to_receive: 0, completed: 0, refunded: 0, cancelled: 0 };
  for (const o of orders) counts[orderStage(o)] += 1;
  return counts;
}

function Tile({ icon: Icon, label, href, count }: { icon: LucideIcon; label: string; href: string; count: number | null }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-1.5 py-1 text-center">
      <span className="relative">
        <Icon size={26} strokeWidth={1.6} className="text-brand-800" aria-hidden="true" />
        {count !== null && count > 0 && (
          <span className="absolute -right-2.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sale px-1 text-[10px] font-bold text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </span>
      <span className="text-xs font-medium leading-tight text-brand-ink">{label}</span>
    </Link>
  );
}

function ServiceTile({ icon: Icon, label, href }: { icon: LucideIcon; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl2 border border-surface-line bg-white p-3 text-center shadow-card transition-colors hover:border-brand-teal"
    >
      <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-800">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="text-xs font-semibold leading-tight text-brand-ink">{label}</span>
    </Link>
  );
}

function SettingRow({ icon: Icon, label, href, value }: { icon: LucideIcon; label: string; href: string; value?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-mist/60">
      <Icon size={17} className="shrink-0 text-slate-500" aria-hidden="true" />
      <span className="text-sm font-medium text-brand-ink">{label}</span>
      {value && <span className="ml-auto max-w-[45%] truncate text-sm text-slate-500">{value}</span>}
      <ChevronRight size={16} className={`shrink-0 text-slate-300 ${value ? "" : "ml-auto"}`} />
    </Link>
  );
}

export default function AccountOverview() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const ordersRes = await fetch("/api/account/orders").then((r) => r.json());
        if (!alive) return;
        setCounts(countOrders(Array.isArray(ordersRes?.orders) ? ordersRes.orders : []));
      } catch {
        if (alive) setCounts({ to_pay: 0, to_ship: 0, to_receive: 0, completed: 0, refunded: 0, cancelled: 0 });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!user) return null;
  const c = counts;

  return (
    // Phones read it as one column, top to bottom — unchanged. From lg the
    // page becomes a two-column dashboard: the membership card and the order
    // states each span the width, then benefits beside skin and services
    // beside settings, so nothing sits in a narrow 340px strip next to the
    // sidebar. Only lg: classes differ; the phone layout is untouched.
    <div className="space-y-5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-6 lg:space-y-0">
      {/* Who you are — the membership card carries name, tier and points, so
          nothing here repeats it; the strip underneath only adds what the card
          has no room for. */}
      <div className="lg:col-span-2">
        <RewardsOverviewCard />
      </div>

      <div className="space-y-5 lg:contents">
        {/* Orders */}
        <div className="rounded-xl2 border border-surface-line bg-white shadow-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-surface-line px-4 py-3">
            <h2 className="text-sm font-bold text-brand-ink">การซื้อของฉัน</h2>
            <Link href="/account/orders" className="flex items-center gap-0.5 text-xs font-semibold text-brand-800">
              ดูประวัติการซื้อ <ChevronRight size={14} />
            </Link>
          </div>
          {/* Every stage an order can be in, each opening the orders page
              already filtered to that stage. */}
          <div className="grid grid-cols-3 gap-1 px-2 py-4 sm:grid-cols-6">
            <Tile icon={CreditCard} label="ที่ต้องชำระ" href="/account/orders?stage=to_pay" count={c?.to_pay ?? null} />
            <Tile icon={Package} label="ที่ต้องจัดส่ง" href="/account/orders?stage=to_ship" count={c?.to_ship ?? null} />
            <Tile icon={Truck} label="ที่ต้องได้รับ" href="/account/orders?stage=to_receive" count={c?.to_receive ?? null} />
            <Tile icon={CheckCircle2} label="สำเร็จ" href="/account/orders?stage=completed" count={c?.completed ?? null} />
            <Tile icon={RotateCcw} label="คืนเงิน/คืนสินค้า" href="/account/orders?stage=refunded" count={c?.refunded ?? null} />
            <Tile icon={XCircle} label="ยกเลิกแล้ว" href="/account/orders?stage=cancelled" count={c?.cancelled ?? null} />
          </div>
        </div>

        {/* Benefits — everything that saves money in one place, instead of
            points here, coupons in the header and referrals three rows down. */}
        <div>
          <h2 className="mb-3 text-sm font-bold text-brand-ink">สิทธิประโยชน์ของฉัน</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <ServiceTile icon={Ticket} label="แลกแต้ม" href="/account/points" />
            <ServiceTile icon={Gift} label={`คูปองส่วนลด ${coupons.length}`} href="/cart" />
            <ServiceTile icon={Users} label="ชวนเพื่อน รับ ฿100" href="/account/referral" />
            <ServiceTile icon={Crown} label="สิทธิสมาชิก" href="/loyalty" />
          </div>
        </div>

        {/* Skin — the scans already saved and the two ways to add another,
            so nothing about skin sits in a second place further down. */}
        <div>
          <h2 className="mb-3 text-sm font-bold text-brand-ink">ผิวของฉัน</h2>
          <SkinScanSummaryCard />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <ServiceTile icon={ScanFace} label="สแกนผิวใหม่" href="/skin-coach" />
            <ServiceTile icon={MessageCircle} label="ปรึกษา AI" href="/ai-assistant" />
          </div>
        </div>

        {/* Everything else you can do from an account */}
        <div>
          <h2 className="mb-3 text-sm font-bold text-brand-ink">บริการของเรา</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
            <ServiceTile icon={Repeat} label="สมัครรายเดือน" href="/account/subscriptions" />
            <ServiceTile icon={Heart} label="รายการโปรด" href="/account/wishlist" />
          </div>
        </div>

        {/* Settings */}
        <div>
          <h2 className="mb-3 text-sm font-bold text-brand-ink">ตั้งค่าบัญชี</h2>
          <div className="divide-y divide-surface-line overflow-hidden rounded-xl2 border border-surface-line bg-white shadow-card">
            <SettingRow icon={User} label="ข้อมูลส่วนตัว" href="/account/profile" value={user.phone || undefined} />
            <SettingRow icon={MapPin} label="ที่อยู่จัดส่ง" href="/account/addresses" />
            <SettingRow icon={Receipt} label="ที่อยู่ใบกำกับภาษี" href="/account/tax-addresses" />
            <SettingRow icon={KeyRound} label="เปลี่ยนรหัสผ่าน" href="/account/change-password" />
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
    </div>
  );
}
