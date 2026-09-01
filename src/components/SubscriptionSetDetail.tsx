"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Info } from "lucide-react";
import clsx from "clsx";
import { Product } from "@/data/types";
import { SubscriptionSet, SubscriptionPlan } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import { subscribeBuyNow } from "@/lib/subscribe-checkout";

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
  const { user } = useAuth();
  const router = useRouter();

  const totalPerCycle = products.reduce((sum, p) => sum + p.price, 0);
  const pricePerCycle = Math.round(totalPerCycle * (1 - plan.discountPct / 100));

  const [subscribeSubmitting, setSubscribeSubmitting] = useState(false);
  const [subscribeError, setSubscribeError] = useState("");
  const [agreedRecurringCharge, setAgreedRecurringCharge] = useState(false);

  // Interim fallback (no 2C2P credentials yet): sends every item in the set
  // (each at the term's quantity) straight to its own Shopify checkout
  // session with the term's discount code pre-applied, bypassing this
  // site's own cart entirely so it never mixes with a regular-purchase cart.
  async function handleSubscribe() {
    setSubscribeError("");
    setSubscribeSubmitting(true);
    try {
      const checkoutUrl = await subscribeBuyNow(
        products.map((p) => ({ merchandiseId: p.variantId, quantity: plan.months })),
        plan.code,
        user?.email,
        user?.phone
      );
      window.location.href = checkoutUrl;
    } catch (err) {
      setSubscribeError(err instanceof Error ? err.message : "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubscribeSubmitting(false);
    }
  }

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
    setSubscribeError("");
    setSubscribeSubmitting(true);
    try {
      const res = await fetch("/api/account/addresses");
      const data = await res.json();
      const defaultAddress = data.addresses?.[0];
      if (!defaultAddress || defaultAddress.country !== "TH") {
        setSubscribeError("กรุณาเพิ่มที่อยู่จัดส่งเริ่มต้นก่อนสมัคร");
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
        setSubscribeError(checkoutData.error || "เริ่มการชำระเงินไม่สำเร็จ");
        return;
      }
      window.location.href = checkoutData.webPaymentUrl;
    } catch {
      setSubscribeError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubscribeSubmitting(false);
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
            disabled={subscribeSubmitting || (subscriptionBillingEnabled && !agreedRecurringCharge)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full py-3.5 text-sm font-bold text-white transition-all active:scale-95 disabled:opacity-50 bg-brand-gradient hover:opacity-90"
          >
            <ShoppingBag size={16} />
            {subscribeSubmitting ? "กำลังเริ่มชำระเงิน..." : "สมัครสมาชิก"}
          </button>
          {subscribeError && <p className="mt-2 text-[11px] text-rose-500 text-center">{subscribeError}</p>}

          <p className="mt-3 flex items-start gap-1.5 text-[11px] text-slate-400">
            <Info size={12} className="shrink-0 mt-0.5" />
            {subscriptionBillingEnabled
              ? `ตัดเงิน ${formatTHB(pricePerCycle)} บาททุกเดือน (ล็อกส่วนลด -${plan.discountPct}% ตลอดเทอม ${plan.months} เดือน) เมื่อครบเทอมต่ออายุอัตโนมัติในเทอมและราคาเดิม จนกว่าจะยกเลิก`
              : `ไปหน้าชำระเงินของ Shopify ทันที พร้อมสินค้าครบชุด ${plan.months} รอบและส่วนลด -${plan.discountPct}% ให้อัตโนมัติ แยกจากตะกร้าปกติ — ยกเลิกได้ก่อนกดชำระเงิน`}
          </p>
        </div>
      </div>
    </div>
  );
}
