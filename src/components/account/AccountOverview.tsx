"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
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
  Star,
  Ticket,
  Truck,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import RewardsOverviewCard from "@/components/account/RewardsOverviewCard";
import { coupons } from "@/data/coupons";

// The account overview, laid out the way Thai shoppers already read a
// marketplace account page: who you are at the top, then the four order
// states as tappable tiles with counts, then points/coupons, then the
// services this shop actually has, then settings. Everything here links to a
// page that already existed — this screen is navigation, not new features.

type Step = { key: string; state: "done" | "current" | "todo" };
type Shipment = { steps: Step[] };
type OrderRow = {
  id: string;
  financialStatus: string | null;
  fulfillmentStatus: string | null;
  cancelledAt: string | null;
  items: { slug: string | null }[];
  tracking?: { shipments: Shipment[] };
};

type Counts = { toPay: number; toShip: number; toReceive: number; toReview: number };

const UNPAID = ["PENDING", "UNPAID", "PARTIALLY_PAID", "AUTHORIZED"];

function delivered(order: OrderRow): boolean {
  const shipments = order.tracking?.shipments ?? [];
  if (shipments.length === 0) return false;
  return shipments.every((s) => s.steps.some((st) => st.key === "delivered" && st.state !== "todo"));
}

function countOrders(orders: OrderRow[], reviewedSlugs: Set<string>): Counts {
  const live = orders.filter((o) => !o.cancelledAt);
  const toPay = live.filter((o) => UNPAID.includes(o.financialStatus || "")).length;
  const toShip = live.filter(
    (o) => !UNPAID.includes(o.financialStatus || "") && (o.fulfillmentStatus || "UNFULFILLED") !== "FULFILLED"
  ).length;
  const toReceive = live.filter((o) => o.fulfillmentStatus === "FULFILLED" && !delivered(o)).length;
  // Something you have in your hands and haven't rated yet.
  const waiting = new Set<string>();
  for (const o of live) {
    if (!delivered(o)) continue;
    for (const item of o.items) if (item.slug && !reviewedSlugs.has(item.slug)) waiting.add(item.slug);
  }
  return { toPay, toShip, toReceive, toReview: waiting.size };
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
        const [ordersRes, reviewsRes] = await Promise.all([
          fetch("/api/account/orders").then((r) => r.json()),
          fetch("/api/account/reviews").then((r) => r.json()).catch(() => ({ reviews: [] })),
        ]);
        if (!alive) return;
        const reviewed = new Set<string>(
          (reviewsRes?.reviews ?? []).map((r: { product_slug: string }) => r.product_slug)
        );
        setCounts(countOrders(Array.isArray(ordersRes?.orders) ? ordersRes.orders : [], reviewed));
      } catch {
        if (alive) setCounts({ toPay: 0, toShip: 0, toReceive: 0, toReview: 0 });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!user) return null;
  const c = counts;

  return (
    // Phones read it as one column, top to bottom. From lg the card and its
    // strip sit in their own narrow column beside everything you actually
    // came to tap, instead of a single 700px-wide ribbon of stacked blocks.
    <div className="space-y-5 lg:grid lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
      {/* Who you are — the membership card carries name, tier and points, so
          nothing here repeats it; the strip underneath only adds what the card
          has no room for. */}
      <div className="lg:sticky lg:top-24">
        <RewardsOverviewCard />
      </div>

      <div className="space-y-5">
        {/* Orders */}
        <div className="rounded-xl2 border border-surface-line bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-surface-line px-4 py-3">
            <h2 className="text-sm font-bold text-brand-ink">การซื้อของฉัน</h2>
            <Link href="/account/orders" className="flex items-center gap-0.5 text-xs font-semibold text-brand-800">
              ดูประวัติการซื้อ <ChevronRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-1 px-2 py-4">
            <Tile icon={CreditCard} label="ที่ต้องชำระ" href="/account/orders" count={c?.toPay ?? null} />
            <Tile icon={Package} label="ที่ต้องจัดส่ง" href="/account/orders" count={c?.toShip ?? null} />
            <Tile icon={Truck} label="ที่ต้องได้รับ" href="/account/orders" count={c?.toReceive ?? null} />
            <Tile icon={Star} label="ให้คะแนน" href="/account/reviews" count={c?.toReview ?? null} />
          </div>
        </div>

        {/* Benefits — everything that saves money in one place, instead of
            points here, coupons in the header and referrals three rows down. */}
        <div>
          <h2 className="mb-3 text-sm font-bold text-brand-ink">สิทธิประโยชน์ของฉัน</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ServiceTile icon={Ticket} label="แลกแต้ม" href="/account/points" />
            <ServiceTile icon={Gift} label={`คูปองส่วนลด ${coupons.length}`} href="/cart" />
            <ServiceTile icon={Users} label="ชวนเพื่อน รับ ฿100" href="/account/referral" />
            <ServiceTile icon={Crown} label="สิทธิสมาชิก" href="/loyalty" />
          </div>
        </div>

        {/* Services — the things you do on this site that aren't buying. */}
        <div>
          <h2 className="mb-3 text-sm font-bold text-brand-ink">บริการของเรา</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ServiceTile icon={ScanFace} label="สแกนผิว" href="/skin-coach" />
            <ServiceTile icon={MessageCircle} label="ปรึกษา AI" href="/ai-assistant" />
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
