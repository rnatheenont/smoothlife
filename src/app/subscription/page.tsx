import Image from "next/image";
import Link from "next/link";
import { Repeat, Truck, ShieldCheck, CalendarClock, ChevronRight, PackagePlus } from "lucide-react";
import {
  subscriptionPlans,
  subscriptionProducts,
  subscriptionSets,
  subscriptionSetProducts,
  BUNDLE_DISCOUNT_PCT,
} from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import { twoC2PConfigured } from "@/lib/2c2p";
import SubscriptionPicker from "@/components/SubscriptionPicker";
import SubscriptionTermsInfo from "@/components/SubscriptionTermsInfo";

export const metadata = { title: "Subscription สมัครสมาชิกรายรอบ | Smoothlife.com" };

const perks = [
  { icon: Truck, label: "ส่งฟรีทุกรอบ" },
  { icon: CalendarClock, label: "เลือกรอบส่ง 3 / 6 / 12 เดือน" },
  { icon: ShieldCheck, label: "ของแท้ 100% มีอย." },
];

export default function SubscriptionPage() {
  const maxDiscount = Math.max(...subscriptionPlans.map((p) => p.discountPct));
  const billingEnabled = twoC2PConfigured();

  return (
    <div>
      <section className="relative overflow-hidden bg-brand-ink text-white">
        <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-teal/25 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-brand-sky/25 blur-3xl" />
        <div className="container-page relative py-12 md:py-20 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-semibold mb-4">
            <Repeat size={13} /> Smoothlife Subscription
          </span>
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
            ดูแลตัวเองต่อเนื่อง <br className="hidden md:block" />
            ไม่ต้องสั่งซ้ำ ประหยัดสูงสุด {maxDiscount}%
          </h1>
          <p className="mt-4 text-white/80 max-w-lg mx-auto">
            เลือกสินค้าที่ใช้ประจำ กำหนดรอบส่งของคุณเอง 3 / 6 หรือ 12 เดือน ยิ่งเลือกรอบยาว ยิ่งได้ส่วนลดมากขึ้น
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4 md:gap-6 text-xs md:text-sm text-white/85">
            {perks.map((perk) => (
              <span key={perk.label} className="flex items-center gap-1.5">
                <perk.icon size={14} /> {perk.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <SubscriptionTermsInfo billingEnabled={billingEnabled} />

      {/* Curated sets — a fixed real product group per set, priced off
          today's real prices (not a separate SKU of its own). Cheapest way
          to see "starting from" pricing without duplicating the per-plan
          math that SubscriptionPicker/the detail page already do. */}
      <section className="container-page py-10 md:py-14">
        <h2 className="text-xl md:text-2xl font-extrabold text-brand-ink mb-1">เลือกชุดสมัครสมาชิก</h2>
        <p className="text-sm text-slate-500 mb-6">ชุดสินค้าที่ทีมคัดมาให้ครบ ไม่ต้องเลือกเอง ใช้ต่อเนื่องได้จริง</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
          {subscriptionSets.map((set) => {
            const items = subscriptionSetProducts(set);
            const total = items.reduce((sum, p) => sum + p.price, 0);
            const cheapestPlan = subscriptionPlans[0];
            const perCyclePrice = Math.round(total * (1 - cheapestPlan.discountPct / 100));
            return (
              <Link
                key={set.slug}
                href={`/subscription/${set.slug}`}
                className="group flex flex-col rounded-xl2 bg-white shadow-card hover:shadow-cardHover transition-shadow overflow-hidden border border-slate-100"
              >
                <div className="relative aspect-[4/3] bg-surface-soft grid grid-cols-3 gap-px p-px">
                  {items.slice(0, 3).map((p) => (
                    <div key={p.slug} className="relative bg-white">
                      <Image src={p.image} alt={p.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="200px" />
                    </div>
                  ))}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <h3 className="font-bold text-brand-ink">{set.name}</h3>
                  <p className="text-xs text-slate-500 line-clamp-2 flex-1">{set.tagline}</p>
                  <div className="mt-1 flex items-end justify-between">
                    <div>
                      <span className="text-[11px] text-slate-400">เริ่มต้น/รอบ</span>
                      <p className="text-lg font-extrabold text-brand-emerald">{formatTHB(perCyclePrice)}</p>
                    </div>
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-brand-emerald group-hover:text-brand-sky transition-colors">
                      ดูรายละเอียด <ChevronRight size={13} />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container-page py-10 md:py-14 border-t border-slate-100">
        <h2 className="text-xl md:text-2xl font-extrabold text-brand-ink mb-1">หรือเลือกสินค้าเอง</h2>
        <p className="text-sm text-slate-500 mb-6">อยากได้แค่สินค้าชิ้นเดียวแบบสมัครรายรอบ เลือกได้จากที่นี่</p>
        <SubscriptionPicker plans={subscriptionPlans} products={subscriptionProducts} subscriptionBillingEnabled={twoC2PConfigured()} />
      </section>

      {billingEnabled && (
        <section className="container-page py-10 md:py-14 border-t border-slate-100">
          <Link
            href="/subscription/build"
            className="group flex flex-col md:flex-row items-center gap-5 rounded-xl2 border border-brand-teal/30 bg-brand-gradient-soft p-6 md:p-8 hover:shadow-cardHover transition-shadow"
          >
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-gradient text-white">
              <PackagePlus size={26} />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-lg md:text-xl font-extrabold text-brand-ink">จัดชุดสินค้าเอง</h2>
              <p className="text-sm text-slate-500 mt-1">
                เลือกสินค้าที่ใช้ประจำมาจัดเป็นชุดของตัวเอง รับส่วนลดชุดพิเศษ -{BUNDLE_DISCOUNT_PCT}% ซ้อนทับกับส่วนลดตามรอบที่เลือกได้อีก
              </p>
            </div>
            <span className="flex shrink-0 items-center gap-1 font-semibold text-brand-emerald group-hover:text-brand-sky transition-colors">
              เริ่มจัดชุด <ChevronRight size={16} />
            </span>
          </Link>
        </section>
      )}
    </div>
  );
}
