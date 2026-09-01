"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShoppingBag, Sparkles } from "lucide-react";
import { Product } from "@/data/types";
import { SubscriptionPlan } from "@/data/subscriptions";
import { formatTHB } from "@/lib/format";
import StarRating from "./StarRating";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";

export default function SubscriptionPicker({
  plans,
  products,
  subscriptionBillingEnabled = false,
}: {
  plans: SubscriptionPlan[];
  products: Product[];
  subscriptionBillingEnabled?: boolean;
}) {
  const popular = plans.find((p) => p.popular) ?? plans[0];
  const [selectedMonths, setSelectedMonths] = useState(popular.months);
  const plan = plans.find((p) => p.months === selectedMonths) ?? popular;
  const { addItem, setCouponCode } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [addedSlug, setAddedSlug] = useState<string | null>(null);
  const [submittingSlug, setSubmittingSlug] = useState<string | null>(null);
  const [errorSlug, setErrorSlug] = useState<{ slug: string; message: string } | null>(null);
  const [agreedSlugs, setAgreedSlugs] = useState<Set<string>>(new Set());

  function toggleAgreed(slug: string, checked: boolean) {
    setAgreedSlugs((prev) => {
      const next = new Set(prev);
      if (checked) next.add(slug);
      else next.delete(slug);
      return next;
    });
  }

  // Interim fallback — same discount-code-on-cart mechanism as before.
  function handleAdd(product: Product) {
    addItem(product.slug, plan.months);
    setCouponCode(plan.code);
    setAddedSlug(product.slug);
    setTimeout(() => setAddedSlug((s) => (s === product.slug ? null : s)), 1800);
  }

  // Real recurring billing — same one-lump-sum-per-term model as the
  // product page / set page, just triggered from this quick-pick grid.
  async function handleRealSubscribe(product: Product) {
    if (!user) {
      router.push(`/account/login?returnTo=${encodeURIComponent("/subscription")}`);
      return;
    }
    if (!agreedSlugs.has(product.slug)) return;
    setErrorSlug(null);
    setSubmittingSlug(product.slug);
    try {
      const res = await fetch("/api/account/addresses");
      const data = await res.json();
      const defaultAddress = data.addresses?.[0];
      if (!defaultAddress || defaultAddress.country !== "TH") {
        setErrorSlug({ slug: product.slug, message: "กรุณาเพิ่มที่อยู่จัดส่งเริ่มต้นก่อนสมัคร" });
        return;
      }
      const checkoutRes = await fetch("/api/subscribe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug: product.slug,
          variantId: product.variantId,
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
          consentRecurringCharge: agreedSlugs.has(product.slug),
        }),
      });
      const checkoutData = await checkoutRes.json();
      if (!checkoutData.ok) {
        setErrorSlug({ slug: product.slug, message: checkoutData.error || "เริ่มการชำระเงินไม่สำเร็จ" });
        return;
      }
      window.location.href = checkoutData.webPaymentUrl;
    } catch {
      setErrorSlug({ slug: product.slug, message: "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
    } finally {
      setSubmittingSlug(null);
    }
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
          const perMonth = Math.round(product.price * (1 - plan.discountPct / 100));
          const added = addedSlug === product.slug;
          const submitting = submittingSlug === product.slug;
          const error = errorSlug?.slug === product.slug ? errorSlug.message : null;
          const agreed = agreedSlugs.has(product.slug);

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
                    <span className="text-xs text-slate-500">ราคา/เดือน (-{plan.discountPct}%)</span>
                    <span className="text-base font-extrabold text-brand-ink">{formatTHB(perMonth)}</span>
                  </div>
                </div>
                {subscriptionBillingEnabled && (
                  <label className="flex items-start gap-1.5 text-[10px] text-slate-500">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => toggleAgreed(product.slug, e.target.checked)}
                      className="mt-0.5 h-3 w-3 shrink-0 accent-brand-emerald"
                    />
                    <span>ยอมรับตัดเงินรายเดือนอัตโนมัติจนกว่าจะยกเลิก</span>
                  </label>
                )}
                <button
                  onClick={() => (subscriptionBillingEnabled ? handleRealSubscribe(product) : handleAdd(product))}
                  disabled={submitting || (subscriptionBillingEnabled && !agreed)}
                  className={clsx(
                    "mt-2 flex items-center justify-center gap-1.5 rounded-full text-xs font-semibold py-2 transition-all active:scale-95 text-white disabled:opacity-50",
                    added ? "bg-brand-emerald" : "bg-brand-gradient hover:opacity-90"
                  )}
                >
                  {added ? <Check size={14} /> : <ShoppingBag size={14} />}
                  {submitting ? "กำลังเริ่ม..." : added ? `เพิ่มแล้ว (${plan.months} ชิ้น)` : `สมัคร ${plan.months} เดือน`}
                </button>
                {error && <p className="text-[10px] text-rose-500">{error}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-8 flex items-start gap-2 text-xs text-slate-400 max-w-2xl">
        <Sparkles size={14} className="shrink-0 mt-0.5 text-brand-teal" />
        {subscriptionBillingEnabled
          ? `เมื่อกด "สมัคร" ระบบจะตัดเงินราคา/เดือนที่แสดงไว้ทุกเดือน (ล็อกส่วนลดตามเทอมที่เลือก) ต่อเนื่องไปเรื่อยๆ จนกว่าจะยกเลิกที่หน้า "การสมัครของฉัน" — ยกเลิกได้ทุกเมื่อ มีผลตั้งแต่รอบถัดไป`
          : `เมื่อกด "สมัคร" ระบบจะเพิ่มจำนวนสินค้าตามรอบที่เลือกลงตะกร้า พร้อมส่วนลด -${plan.discountPct}% ให้อัตโนมัติ ใช้ได้จริงตอนชำระเงิน — ยกเลิกหรือเปลี่ยนแผนได้ทุกเมื่อจากหน้าตะกร้า`}
      </p>
    </div>
  );
}
