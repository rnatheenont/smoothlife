"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ShoppingBag, Sparkles, Info } from "lucide-react";
import clsx from "clsx";
import { Product } from "@/data/types";
import { SubscriptionSet, SubscriptionPlan } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import { useCart } from "@/lib/cart-context";

export default function SubscriptionSetDetail({
  set,
  products,
  plans,
}: {
  set: SubscriptionSet;
  products: Product[];
  plans: SubscriptionPlan[];
}) {
  const popular = plans.find((p) => p.popular) ?? plans[0];
  const [selectedMonths, setSelectedMonths] = useState(popular.months);
  const plan = plans.find((p) => p.months === selectedMonths) ?? popular;
  // Auto-renew is UI-only for now — there's no recurring-billing backend
  // yet, so leaving it off by default and saying so honestly beats
  // implying a real auto-charge that can't happen.
  const [autoRenew, setAutoRenew] = useState(false);
  const { addItem, setCouponCode } = useCart();
  const [added, setAdded] = useState(false);

  const totalPerCycle = products.reduce((sum, p) => sum + p.price, 0);
  const fullPriceTerm = totalPerCycle * plan.months;
  const pricePerCycle = Math.round(totalPerCycle * (1 - plan.discountPct / 100));
  const totalTerm = pricePerCycle * plan.months;
  const savedTerm = fullPriceTerm - totalTerm;

  function handleSubscribe() {
    for (const p of products) addItem(p.slug, plan.months);
    setCouponCode(plan.code);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="grid md:grid-cols-[1.1fr,1fr] gap-8 md:gap-10">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-brand-ink">{set.name}</h1>
        <p className="mt-2 text-slate-600">{set.tagline}</p>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {products.map((p) => (
            <Link key={p.slug} href={`/product/${p.slug}`} className="group flex flex-col gap-2">
              <div className="relative aspect-square rounded-xl2 overflow-hidden bg-surface-soft border border-slate-100">
                <Image src={p.image} alt={p.name} fill sizes="200px" className="object-cover group-hover:scale-105 transition-transform duration-500" />
              </div>
              <p className="text-xs text-slate-600 line-clamp-2">{p.name}</p>
              <p className="text-xs font-bold text-brand-ink">{formatTHB(p.price)}</p>
            </Link>
          ))}
        </div>

        <div className="mt-6 rounded-xl2 bg-surface-soft p-4">
          <p className="text-sm font-bold text-brand-ink mb-2">มูลค่ารวมถ้าซื้อแยก</p>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-500">ราคาปกติต่อรอบ</span>
            <span className="text-sm text-slate-500 line-through">{formatTHB(totalPerCycle)}</span>
          </div>
        </div>
      </div>

      <div>
        <div className="rounded-xl2 border border-slate-100 shadow-card p-5 sticky top-24">
          <h2 className="text-sm font-bold text-brand-ink mb-3">เลือกระยะเวลาสมัคร</h2>
          <div className="grid grid-cols-3 gap-2">
            {plans.map((p) => {
              const active = p.months === selectedMonths;
              return (
                <button
                  key={p.months}
                  onClick={() => setSelectedMonths(p.months)}
                  className={clsx(
                    "relative rounded-xl2 p-3 text-center transition-all border-2",
                    active ? "border-brand-emerald bg-brand-gradient-soft" : "border-slate-100 hover:border-slate-200"
                  )}
                >
                  {p.popular && (
                    <span className="absolute -top-2 right-1.5 rounded-full bg-brand-gradient text-white text-[9px] font-bold px-1.5 py-0.5 shadow-card">
                      ยอดนิยม
                    </span>
                  )}
                  <p className="text-lg font-extrabold text-brand-ink">{p.months}</p>
                  <p className="text-[11px] text-slate-500">เดือน</p>
                  <p className={clsx("mt-1 text-[11px] font-bold", active ? "text-brand-emerald" : "text-slate-400")}>
                    -{p.discountPct}%
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-xl2 bg-surface-soft p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">ราคา/รอบ</span>
              <span className="text-2xl font-extrabold text-brand-emerald">{formatTHB(pricePerCycle)}</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-[11px] text-slate-400">รวมทั้งเทอม ({plan.months} รอบ)</span>
              <span className="text-xs text-slate-500">
                <span className="line-through text-slate-400 mr-1">{formatTHB(fullPriceTerm)}</span>
                {formatTHB(totalTerm)}
              </span>
            </div>
            <p className="mt-1 text-xs font-bold text-brand-emerald">ประหยัดรวม {formatTHB(savedTerm)} ตลอดเทอม</p>
          </div>

          <button
            onClick={() => setAutoRenew((v) => !v)}
            className="mt-4 flex w-full items-center justify-between rounded-xl2 border border-slate-100 px-3.5 py-3"
          >
            <span className="text-left">
              <span className="block text-sm font-semibold text-brand-ink">ต่ออายุอัตโนมัติ</span>
              <span className="block text-[11px] text-slate-400">เร็วๆ นี้ — ตอนนี้ทุกการสมัครจบเมื่อครบเทอม</span>
            </span>
            <span
              className={clsx(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors",
                autoRenew ? "bg-brand-gradient" : "bg-slate-200"
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                  autoRenew ? "translate-x-[22px]" : "translate-x-0.5"
                )}
              />
            </span>
          </button>

          <button
            onClick={handleSubscribe}
            className={clsx(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white transition-all active:scale-95",
              added ? "bg-brand-emerald" : "bg-brand-gradient hover:opacity-90"
            )}
          >
            {added ? <Check size={16} /> : <ShoppingBag size={16} />}
            {added ? "เพิ่มลงตะกร้าแล้ว" : "สมัครสมาชิก"}
          </button>

          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
            <Info size={12} className="shrink-0 mt-0.5" />
            เพิ่มสินค้าครบชุด {plan.months} รอบลงตะกร้า พร้อมโค้ดส่วนลด {plan.code} ที่ใช้ได้จริงตอนชำระเงิน
          </p>
          {added && (
            <Link href="/cart" className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-brand-emerald hover:text-brand-sky">
              <Sparkles size={12} /> ไปที่ตะกร้าเพื่อชำระเงิน
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
