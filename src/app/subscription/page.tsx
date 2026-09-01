import Image from "next/image";
import Link from "next/link";
import { Repeat, Truck, ShieldCheck, CalendarClock, ChevronRight, CreditCard, Package, Percent } from "lucide-react";
import { subscriptionPlans, subscriptionProducts, subscriptionSets, subscriptionSetProducts } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import { twoC2PConfigured } from "@/lib/2c2p";
import SubscriptionPicker from "@/components/SubscriptionPicker";

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

      {/* Terms explainer — billing cadence, shipping, and the discount
          table, spelled out plainly before anyone picks a plan. Copy
          switches on billingEnabled (same flag SubscriptionPicker/
          ProductDetailInteractive/SubscriptionSetDetail already use) so
          this never claims real recurring billing while the site is
          actually still on the discount-code fallback. */}
      <section className="container-page py-10 md:py-14 border-t border-slate-100">
        <h2 className="text-xl md:text-2xl font-extrabold text-brand-ink mb-1 text-center">เงื่อนไขการสมัครสมาชิก</h2>
        <p className="text-sm text-slate-500 mb-6 text-center">อ่านให้ครบก่อนสมัคร — ไม่มีเงื่อนไขซ่อนเร้น</p>
        <div className="grid sm:grid-cols-3 gap-4 md:gap-5">
          <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-3">
              <CreditCard size={18} />
            </div>
            <h3 className="font-bold text-brand-ink mb-2">ตัดรอบ</h3>
            {billingEnabled ? (
              <ul className="text-sm text-slate-600 flex flex-col gap-1.5">
                <li>• ตัดเงินอัตโนมัติ<strong className="text-brand-ink">ทุกเดือน</strong> ในราคาที่ล็อกไว้ตามเทอมที่เลือก ไม่เปลี่ยนแปลงระหว่างทาง</li>
                <li>• ครบตามจำนวนรอบของเทอมแล้ว ระบบต่อเทอมใหม่ให้อัตโนมัติในเงื่อนไขเดิม ไปเรื่อยๆ จนกว่าจะยกเลิก</li>
                <li>• ยกเลิกได้ทุกเมื่อที่หน้า &ldquo;การสมัครของฉัน&rdquo; — มีผล<strong className="text-brand-ink">ตั้งแต่รอบถัดไป</strong> รอบปัจจุบันที่จ่ายแล้วยังได้รับตามปกติ ไม่มีค่าปรับ</li>
              </ul>
            ) : (
              <ul className="text-sm text-slate-600 flex flex-col gap-1.5">
                <li>• กด &ldquo;สมัคร&rdquo; ครั้งเดียว ระบบเพิ่มสินค้าตามจำนวนรอบที่เลือกลงตะกร้า พร้อมส่วนลดให้อัตโนมัติที่หน้าชำระเงิน</li>
                <li>• ต่ออายุอัตโนมัติยังไม่เปิดใช้งาน — ครบรอบแล้วกลับมาสมัครใหม่อีกครั้งได้เลย</li>
              </ul>
            )}
          </div>

          <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-3">
              <Package size={18} />
            </div>
            <h3 className="font-bold text-brand-ink mb-2">การจัดส่ง</h3>
            {billingEnabled ? (
              <ul className="text-sm text-slate-600 flex flex-col gap-1.5">
                <li>• จัดส่ง<strong className="text-brand-ink">พร้อมกับทุกรอบที่ตัดเงินสำเร็จ</strong> ไม่ต้องรอแยกต่างหาก</li>
                <li>• ส่งฟรีทุกรอบ ทั่วไทย</li>
                <li>• เปลี่ยนที่อยู่จัดส่งได้ทุกเมื่อสำหรับรอบที่ยังไม่ถึงกำหนด</li>
              </ul>
            ) : (
              <ul className="text-sm text-slate-600 flex flex-col gap-1.5">
                <li>• จัดส่งตามคำสั่งซื้อปกติทันทีที่ชำระเงินสำเร็จ (ได้รับสินค้าตามจำนวนรอบที่เลือกในครั้งเดียว)</li>
                <li>• ส่งฟรีทุกออเดอร์</li>
              </ul>
            )}
          </div>

          <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-3">
              <Percent size={18} />
            </div>
            <h3 className="font-bold text-brand-ink mb-2">ส่วนลด</h3>
            <div className="flex flex-col gap-1.5 text-sm">
              {subscriptionPlans.map((p) => (
                <div key={p.months} className="flex items-center justify-between rounded-lg bg-surface-soft px-3 py-1.5">
                  <span className="text-slate-600">ทุก {p.months} เดือน</span>
                  <span className="font-bold text-brand-emerald">-{p.discountPct}%</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-2">
              ยิ่งเลือกเทอมยาว ยิ่งได้ส่วนลดต่อเดือนมากขึ้น {billingEnabled ? "และล็อกอัตรานี้ไว้ตลอดการสมัคร" : ""}
            </p>
          </div>
        </div>
      </section>

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
    </div>
  );
}
