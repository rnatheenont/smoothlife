"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShoppingBag, Sparkles, Info } from "lucide-react";
import clsx from "clsx";
import { Product } from "@/data/types";
import { SubscriptionSet, SubscriptionPlan } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";

export default function SubscriptionSetDetail({
  set,
  products,
  plans,
  subscriptionBillingEnabled = false,
}: {
  set: SubscriptionSet;
  products: Product[];
  plans: SubscriptionPlan[];
  subscriptionBillingEnabled?: boolean;
}) {
  const popular = plans.find((p) => p.popular) ?? plans[0];
  const [selectedMonths, setSelectedMonths] = useState(popular.months);
  const plan = plans.find((p) => p.months === selectedMonths) ?? popular;
  const { addItem, setCouponCode } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [added, setAdded] = useState(false);

  const totalPerCycle = products.reduce((sum, p) => sum + p.price, 0);
  const pricePerCycle = Math.round(totalPerCycle * (1 - plan.discountPct / 100));

  // Interim fallback (no 2C2P credentials yet): stage every item in the set
  // in the cart with a real Shopify discount code — same mechanism the
  // single-product page falls back to.
  function handleSubscribe() {
    for (const p of products) addItem(p.slug, plan.months);
    setCouponCode(plan.code);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  const [realSubscribeSubmitting, setRealSubscribeSubmitting] = useState(false);
  const [realSubscribeError, setRealSubscribeError] = useState("");
  const [agreedRecurringCharge, setAgreedRecurringCharge] = useState(false);

  // Real recurring billing path — charges the set's discounted monthly
  // amount via 2C2P, same auto-renew-forever model as a single product
  // (see ProductDetailInteractive.handleRealSubscribe). Requires a saved
  // default shipping address, same as the single-product flow.
  async function handleRealSubscribe() {
    if (!user) {
      router.push(`/account/login?returnTo=${encodeURIComponent(`/subscription/${set.slug}`)}`);
      return;
    }
    if (!agreedRecurringCharge) return;
    setRealSubscribeError("");
    setRealSubscribeSubmitting(true);
    try {
      const res = await fetch("/api/account/addresses");
      const data = await res.json();
      const defaultAddress = data.addresses?.[0];
      if (!defaultAddress || defaultAddress.country !== "TH") {
        setRealSubscribeError("กรุณาเพิ่มที่อยู่จัดส่งเริ่มต้นก่อนสมัคร");
        return;
      }
      const checkoutRes = await fetch("/api/subscribe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          setSlug: set.slug,
          months: plan.months,
          shippingAddress: {
            address1: defaultAddress.address_line,
            city: defaultAddress.district,
            state: defaultAddress.province,
            postalCode: defaultAddress.postal_code,
            countryCode: defaultAddress.country,
            firstName: defaultAddress.recipient_name?.split(/\s+/)[0],
            lastName: defaultAddress.recipient_name?.split(/\s+/).slice(1).join(" "),
            phone: defaultAddress.phone,
          },
          consentRecurringCharge: agreedRecurringCharge,
        }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutData.ok) {
        setRealSubscribeError(checkoutData.error || "เริ่มการชำระเงินไม่สำเร็จ");
        return;
      }
      window.location.href = checkoutData.webPaymentUrl;
    } catch {
      setRealSubscribeError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setRealSubscribeSubmitting(false);
    }
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
            <span className="text-xs text-slate-500">ราคาปกติ/เดือน</span>
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
              <span className="text-xs text-slate-500">ราคา/เดือน (-{plan.discountPct}%)</span>
              <span className="text-2xl font-extrabold text-brand-emerald">{formatTHB(pricePerCycle)}</span>
            </div>
          </div>

          {subscriptionBillingEnabled && (
            <label className="mt-3 flex items-start gap-2 text-[11px] text-slate-500">
              <input
                type="checkbox"
                checked={agreedRecurringCharge}
                onChange={(e) => setAgreedRecurringCharge(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-emerald"
              />
              <span>
                ยอมรับให้ตัดเงิน {formatTHB(pricePerCycle)} บาททุกเดือนจากบัตรที่ผูกไว้ ต่อเนื่องไปเรื่อยๆ จนกว่าจะยกเลิก —
                ยกเลิกได้ทุกเมื่อที่หน้า &ldquo;การสมัครของฉัน&rdquo; มีผลตั้งแต่รอบถัดไป
              </span>
            </label>
          )}

          <button
            onClick={subscriptionBillingEnabled ? handleRealSubscribe : handleSubscribe}
            disabled={realSubscribeSubmitting || (subscriptionBillingEnabled && !agreedRecurringCharge)}
            className={clsx(
              "mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50",
              added ? "bg-brand-emerald" : "bg-brand-gradient hover:opacity-90"
            )}
          >
            {added ? <Check size={16} /> : <ShoppingBag size={16} />}
            {realSubscribeSubmitting ? "กำลังเริ่มชำระเงิน..." : added ? "เพิ่มลงตะกร้าแล้ว" : "สมัครสมาชิก"}
          </button>
          {realSubscribeError && <p className="mt-2 text-[11px] text-rose-500 text-center">{realSubscribeError}</p>}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
            <Info size={12} className="shrink-0 mt-0.5" />
            {subscriptionBillingEnabled
              ? `ตัดเงิน ${formatTHB(pricePerCycle)} บาททุกเดือน (ล็อกส่วนลด -${plan.discountPct}% ตลอดเทอม ${plan.months} เดือน) เมื่อครบเทอมต่ออายุอัตโนมัติในเทอมและราคาเดิม จนกว่าจะยกเลิก`
              : `เพิ่มสินค้าครบชุด ${plan.months} รอบลงตะกร้า พร้อมส่วนลด -${plan.discountPct}% ให้อัตโนมัติที่หน้าชำระเงิน — ต่ออายุอัตโนมัติยังไม่เปิดใช้งาน ครบรอบแล้วสมัครใหม่ได้เลย`}
          </p>
          {added && !subscriptionBillingEnabled && (
            <Link href="/cart" className="mt-2 flex items-center justify-center gap-1 text-xs font-semibold text-brand-emerald hover:text-brand-sky">
              <Sparkles size={12} /> ไปที่ตะกร้าเพื่อชำระเงิน
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
