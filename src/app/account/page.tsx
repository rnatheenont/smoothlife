"use client";

import Link from "next/link";
import {
  Package,
  Heart,
  Award,
  LogOut,
  MapPin,
  Bell,
  Camera,
  ChevronRight,
  ShoppingBag,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWishlist } from "@/lib/cart-context";
import { formatTHB } from "@/lib/format";
import AccountGate from "@/components/AccountGate";
import { useRouter } from "next/navigation";

const tierThreshold: Record<string, number> = { Bronze: 1000, Silver: 3000, Gold: 3000 };

const statusLabel: Record<string, string> = {
  Processing: "กำลังเตรียมพัสดุ",
  Shipped: "จัดส่งแล้ว",
  Delivered: "ส่งสำเร็จ",
};

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl2 border border-slate-100 bg-white p-4 shadow-card">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-2.5">
        <Icon size={15} />
      </div>
      <p className="text-lg font-bold text-brand-ink leading-tight">{value}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function ActionTile({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: any;
  label: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-start gap-2.5 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card hover:border-brand-teal transition-colors"
    >
      <div className="grid h-10 w-10 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald">
        <Icon size={18} />
      </div>
      <div className="flex-1">
        <span className="block text-sm font-semibold text-brand-ink leading-snug">{label}</span>
        {badge && <span className="text-[11px] text-brand-emerald font-medium">{badge}</span>}
      </div>
    </Link>
  );
}

function AccountDashboard() {
  const { user, logout, getOrders } = useAuth();
  const { slugs } = useWishlist();
  const router = useRouter();
  if (!user) return null;
  const orders = getOrders();
  const latestOrder = orders[0];
  const nextGoal = tierThreshold[user.tier] || 3000;
  const progress = Math.min(100, Math.round((user.points / nextGoal) * 100));

  return (
    <div className="container-page py-6 md:py-10 max-w-5xl mx-auto">
      {/* Hero */}
      <div className="rounded-xl2 bg-brand-ink text-white p-5 sm:p-6 md:p-8 flex items-center gap-4 mb-6">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white/10 text-xl font-bold overflow-hidden">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name} className="h-14 w-14 rounded-full object-cover" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">{user.name}</h1>
          <p className="text-xs text-white/60 truncate">{user.email || user.phone || "เข้าสู่ระบบผ่าน LINE"}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs font-semibold bg-white/10 rounded-full px-2.5 py-1">{user.tier} Member</span>
            <span className="text-xs text-white/70">{user.points} คะแนน</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-brand-gradient" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Stats row — 2 cols on mobile, 4 on larger screens */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Package} label="คำสั่งซื้อทั้งหมด" value={orders.length} />
        <StatCard icon={Heart} label="รายการโปรด" value={slugs.length} />
        <StatCard icon={Award} label="คะแนนสะสม" value={user.points} />
        <StatCard icon={ShoppingBag} label="ระดับสมาชิก" value={user.tier} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <h2 className="text-sm font-bold text-brand-ink mb-3">เมนูลัด</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <ActionTile href="/account/orders" icon={Package} label="คำสั่งซื้อและติดตามพัสดุ" />
            <ActionTile href="/account/wishlist" icon={Heart} label="รายการโปรดและรูทีนที่บันทึกไว้" />
            <ActionTile href="/account/points" icon={Award} label="คะแนนสะสมและระดับสมาชิก" />
            <ActionTile href="/skin-coach" icon={Camera} label="วิเคราะห์ผิวหน้าด้วย AI" badge="ใหม่" />
            <ActionTile href="/checkout" icon={MapPin} label="ที่อยู่จัดส่ง" badge="จัดการตอนชำระเงิน" />
            <ActionTile href="/account" icon={Bell} label="การแจ้งเตือนโปรโมชั่น" badge="เปิดใช้งาน" />
          </div>
        </div>

        <div>
          <h2 className="text-sm font-bold text-brand-ink mb-3">คำสั่งซื้อล่าสุด</h2>
          {latestOrder ? (
            <Link
              href="/account/orders"
              className="block rounded-xl2 border border-slate-100 bg-white p-4 shadow-card hover:border-brand-teal transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-brand-ink">#{latestOrder.id}</span>
                <span className="text-[11px] font-medium text-brand-emerald bg-brand-gradient-soft rounded-full px-2 py-0.5">
                  {statusLabel[latestOrder.status] || latestOrder.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 line-clamp-2 mb-2">
                {latestOrder.items.map((i) => i.name).join(", ")}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-bold text-brand-ink text-sm">{formatTHB(latestOrder.total)}</span>
                <ChevronRight size={16} className="text-slate-300" />
              </div>
            </Link>
          ) : (
            <div className="rounded-xl2 border border-dashed border-slate-200 p-5 text-center">
              <p className="text-xs text-slate-400 mb-3">คุณยังไม่มีคำสั่งซื้อ</p>
              <Link href="/shop" className="text-xs font-semibold text-brand-emerald">
                เริ่มช้อปเลย
              </Link>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          logout();
          router.push("/");
        }}
        className="flex items-center gap-2 text-sm font-semibold text-rose-500 mt-8"
      >
        <LogOut size={16} /> ออกจากระบบ
      </button>
    </div>
  );
}

export default function AccountPage() {
  return (
    <AccountGate>
      <AccountDashboard />
    </AccountGate>
  );
}
