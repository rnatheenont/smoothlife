"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ShoppingBag, Sparkles } from "lucide-react";
import { Product } from "@/data/types";
import { SubscriptionPlan } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import StarRating from "./StarRating";
import { useCart } from "@/lib/cart-context";
import clsx from "clsx";

export default function SubscriptionPicker({
  plans,
  products,
}: {
  plans: SubscriptionPlan[];
  products: Product[];
}) {
  const popular = plans.find((p) => p.popular) ?? plans[0];
  const [selectedMonths, setSelectedMonths] = useState(popular.months);
  const plan = plans.find((p) => p.months === selectedMonths) ?? popular;
  const { addItem, setCouponCode } = useCart();
  const [addedSlug, setAddedSlug] = useState<string | null>(null);

  function handleAdd(product: Product) {
    addItem(product.slug, plan.months);
    setCouponCode(plan.code);
    setAddedSlug(product.slug);
    setTimeout(() => setAddedSlug((s) => (s === product.slug ? null : s)), 1800);
  }

  return (
    <div>
      {/* Plan toggle */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-10">
        {plans.map((p) => {
          const active = p.months === selectedMonths;
          return (
            <button
              key={p.months}
              onClick={() => setSelectedMonths(p.months)}
              className={clsx(
                "relative rounded-xl2 p-4 md:p-6 text-left transition-all border-2",
                active
                  ? "border-brand-emerald bg-brand-gradient-soft shadow-cardHover scale-[1.02]"
                  : "border-slate-100 bg-white hover:border-slate-200"
              )}
            >
              {p.popular && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-brand-gradient text-white text-[10px] font-bold px-2 py-0.5 shadow-card">
                  ยอดนิยม
                </span>
              )}
              <p className="text-2xl md:text-3xl font-extrabold text-brand-ink">{p.months} เดือน</p>
              <p className="text-xs text-slate-500 mt-0.5">{p.sublabel}</p>
              <p className={clsx("mt-3 text-lg font-extrabold", active ? "text-brand-emerald" : "text-slate-400")}>
                ประหยัด {p.discountPct}%
              </p>
              {active && (
                <span className="absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full bg-brand-emerald text-white">
                  <Check size={12} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Products at the selected plan */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5">
        {products.map((product) => {
          const total = Math.round(product.price * plan.months * (1 - plan.discountPct / 100));
          const perMonth = Math.round(total / plan.months);
          const fullPrice = product.price * plan.months;
          const saved = fullPrice - total;
          const added = addedSlug === product.slug;

          return (
            <div key={product.slug} className="flex flex-col rounded-xl2 bg-white shadow-card overflow-hidden border border-slate-100">
              <Link href={`/product/${product.slug}`} className="relative aspect-square bg-surface-soft">
                <Image src={product.image} alt={product.name} fill sizes="(max-width:768px) 50vw, 25vw" className="object-cover" />
              </Link>
              <div className="flex flex-1 flex-col gap-1.5 p-3.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-teal">{product.brand}</span>
                <h3 className="text-sm font-medium text-brand-ink line-clamp-2 min-h-[2.5rem]">{product.name}</h3>
                {product.reviewCount > 0 && (
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={product.rating} size={12} />
                    <span className="text-[11px] text-slate-400">({product.reviewCount})</span>
                  </div>
                )}
                <div className="mt-1 rounded-lg bg-surface-soft p-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-slate-500">ทุกเดือนเฉลี่ย</span>
                    <span className="text-base font-extrabold text-brand-ink">{formatTHB(perMonth)}</span>
                  </div>
                  <div className="flex items-baseline justify-between mt-0.5">
                    <span className="text-[11px] text-slate-400">รวม {plan.months} เดือน</span>
                    <span className="text-[11px] text-slate-400 line-through">{formatTHB(fullPrice)}</span>
                  </div>
                  <p className="text-[11px] font-bold text-brand-emerald mt-0.5">ประหยัด {formatTHB(saved)}</p>
                </div>
                <button
                  onClick={() => handleAdd(product)}
                  className={clsx(
                    "mt-2 flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold py-2 transition-all active:scale-95 text-white",
                    added ? "bg-brand-emerald" : "bg-brand-gradient hover:opacity-90"
                  )}
                >
                  {added ? <Check size={14} /> : <ShoppingBag size={14} />}
                  {added ? `เพิ่มแล้ว (${plan.months} ชิ้น)` : `สมัคร ${plan.months} เดือน`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 flex items-start gap-2 text-xs text-slate-400 max-w-2xl">
        <Sparkles size={14} className="shrink-0 mt-0.5 text-brand-teal" />
        เมื่อกด &ldquo;สมัคร&rdquo; ระบบจะเพิ่มจำนวนสินค้าตามรอบที่เลือกลงตะกร้า พร้อมใส่โค้ดส่วนลด {plan.code} ให้อัตโนมัติ
        ใช้ได้จริงตอนชำระเงิน — ยกเลิกหรือเปลี่ยนแผนได้ทุกเมื่อจากหน้าตะกร้า
      </p>
    </div>
  );
}
