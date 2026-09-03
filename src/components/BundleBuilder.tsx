"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, Package, Sparkles } from "lucide-react";
import { Product } from "@/data/types";
import { SubscriptionPlan, BUNDLE_MIN_ITEMS, BUNDLE_MAX_ITEMS, BUNDLE_DISCOUNT_PCT } from "@/data/subscriptions";
import { categories } from "@/data/categories";
import { formatTHB } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";
import clsx from "clsx";

export default function BundleBuilder({
  products,
  plans,
}: {
  products: Product[];
  plans: SubscriptionPlan[];
}) {
  const popular = plans.find((p) => p.popular) ?? plans[0];
  const [selectedMonths, setSelectedMonths] = useState(popular.months);
  const plan = plans.find((p) => p.months === selectedMonths) ?? popular;
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const [agreedRecurringCharge, setAgreedRecurringCharge] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleProduct(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else if (next.size < BUNDLE_MAX_ITEMS) {
        next.add(slug);
      }
      return next;
    });
  }

  const availableCategories = categories.filter((c) => products.some((p) => p.category === c.slug));
  const visibleProducts = activeCategory ? products.filter((p) => p.category === activeCategory) : products;
  const selectedProducts = products.filter((p) => selected.has(p.slug));
  const totalPerCycle = selectedProducts.reduce((sum, p) => sum + p.price, 0);
  const afterBundleDiscount = totalPerCycle * (1 - BUNDLE_DISCOUNT_PCT / 100);
  const pricePerCycle = Math.round(afterBundleDiscount * (1 - plan.discountPct / 100));
  const meetsMin = selected.size >= BUNDLE_MIN_ITEMS;

  async function handleRealSubscribe() {
    if (!user) {
      router.push(`/account/login?returnTo=${encodeURIComponent("/subscription/build")}`);
      return;
    }
    if (!meetsMin || !agreedRecurringCharge) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/account/addresses");
      const data = await res.json();
      const defaultAddress = data.addresses?.[0];
      if (!defaultAddress || defaultAddress.country !== "TH") {
        setError("กรุณาเพิ่มที่อยู่จัดส่งเริ่มต้นก่อนสมัคร");
        return;
      }
      const checkoutRes = await fetch("/api/subscribe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bundleItems: selectedProducts.map((p) => ({ productSlug: p.slug, variantId: p.variantId })),
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
        setError(checkoutData.error || "เริ่มการชำระเงินไม่สำเร็จ");
        return;
      }
      window.location.href = checkoutData.webPaymentUrl;
    } catch {
      setError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid md:grid-cols-[1.4fr,1fr] gap-8 md:gap-10">
      <div>
        <p className="text-xs font-semibold text-slate-500 mb-3">
          เลือกแล้ว {selected.size}/{BUNDLE_MAX_ITEMS} ชิ้น (เลือกอย่างน้อย {BUNDLE_MIN_ITEMS} ชิ้น)
        </p>
        {availableCategories.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                activeCategory === null ? "bg-brand-gradient text-white" : "bg-surface-soft text-slate-500 hover:text-brand-ink"
              )}
            >
              ทั้งหมด
            </button>
            {availableCategories.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => setActiveCategory(c.slug)}
                className={clsx(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  activeCategory === c.slug ? "bg-brand-gradient text-white" : "bg-surface-soft text-slate-500 hover:text-brand-ink"
                )}
              >
                {c.nameTh}
              </button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-5">
          {visibleProducts.map((product) => {
            const isSelected = selected.has(product.slug);
            const disabled = !isSelected && selected.size >= BUNDLE_MAX_ITEMS;
            return (
              <button
                key={product.slug}
                type="button"
                onClick={() => toggleProduct(product.slug)}
                disabled={disabled}
                className={`flex flex-col rounded-xl2 bg-white shadow-card overflow-hidden border-2 text-left transition-all disabled:opacity-40 disabled:pointer-events-none ${
                  isSelected ? "border-brand-emerald" : "border-transparent hover:border-slate-200"
                }`}
              >
                <div className="relative aspect-square bg-surface-soft">
                  <Image src={product.image} alt={product.name} fill sizes="(max-width:768px) 50vw, 33vw" className="object-cover" />
                  {isSelected && (
                    <span className="absolute top-2 right-2 grid h-6 w-6 place-items-center rounded-full bg-brand-emerald text-white">
                      <Check size={14} />
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-teal">{product.brand}</span>
                  <p className="text-xs font-medium text-brand-ink line-clamp-2 min-h-[2rem]">{product.name}</p>
                  <p className="text-sm font-bold text-brand-ink mt-1">{formatTHB(product.price)}</p>
                </div>
              </button>
            );
          })}
        </div>
        {visibleProducts.length === 0 && (
          <p className="text-sm text-slate-400 py-10 text-center">
            {products.length === 0 ? "ยังไม่มีสินค้าที่จัดชุดได้ในขณะนี้" : "ไม่มีสินค้าในหมวดนี้"}
          </p>
        )}
      </div>

      <div>
        <div className="rounded-xl2 border border-slate-100 shadow-card p-5 sticky top-24">
          <h2 className="text-sm font-bold text-brand-ink mb-3 flex items-center gap-1.5">
            <Package size={16} className="text-brand-emerald" /> ชุดของคุณ
          </h2>
          {selectedProducts.length === 0 ? (
            <p className="text-xs text-slate-400 mb-4">ยังไม่ได้เลือกสินค้า</p>
          ) : (
            <div className="flex flex-col gap-1.5 mb-4 max-h-40 overflow-y-auto">
              {selectedProducts.map((p) => (
                <div key={p.slug} className="flex justify-between text-xs text-slate-600">
                  <span className="line-clamp-1 pr-2">{p.name}</span>
                  <span className="shrink-0">{formatTHB(p.price)}</span>
                </div>
              ))}
            </div>
          )}

          <h3 className="text-xs font-bold text-brand-ink mb-2">เลือกระยะเวลาสมัคร</h3>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {plans.map((p) => {
              const active = p.months === selectedMonths;
              return (
                <button
                  key={p.months}
                  type="button"
                  onClick={() => setSelectedMonths(p.months)}
                  className={`rounded-xl2 p-2.5 text-center transition-all border-2 ${
                    active ? "border-brand-emerald bg-brand-gradient-soft" : "border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <p className="text-base font-extrabold text-brand-ink">{p.months}</p>
                  <p className="text-[10px] text-slate-500">เดือน</p>
                  <p className={`mt-0.5 text-[10px] font-bold ${active ? "text-brand-emerald" : "text-slate-400"}`}>-{p.discountPct}%</p>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl2 bg-surface-soft p-4 mb-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-slate-500">ราคา/เดือน (ลดชุด -{BUNDLE_DISCOUNT_PCT}% + เทอม -{plan.discountPct}%)</span>
              <span className="text-xl font-extrabold text-brand-emerald">{formatTHB(pricePerCycle)}</span>
            </div>
          </div>

          <label className="flex items-start gap-2 text-[11px] text-slate-500 mb-3">
            <input
              type="checkbox"
              checked={agreedRecurringCharge}
              onChange={(e) => setAgreedRecurringCharge(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-brand-emerald"
            />
            <span>
              ยอมรับให้ตัดเงิน {formatTHB(pricePerCycle)} บาททุกเดือนจากบัตรที่ผูกไว้ จนครบเทอม {plan.months} เดือน
              แล้วปิดรายการอัตโนมัติ ไม่มีการต่อเทอมเอง — ยกเลิกได้ทุกเมื่อที่หน้า &ldquo;การสมัครของฉัน&rdquo;
              มีผลเมื่อจบเทอม รอบที่เหลือยังตัดและจัดส่งตามปกติ
            </span>
          </label>

          <button
            onClick={handleRealSubscribe}
            disabled={!meetsMin || submitting || !agreedRecurringCharge}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-bold py-3.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
          >
            <Sparkles size={16} />
            {submitting ? "กำลังเริ่มชำระเงิน..." : !meetsMin ? `เลือกอีก ${BUNDLE_MIN_ITEMS - selected.size} ชิ้น` : "สมัครสมาชิก"}
          </button>
          {error && <p className="mt-2 text-[11px] text-rose-500 text-center">{error}</p>}
          <p className="mt-3 text-[10px] text-slate-400 text-center">
            ตัดเงิน {formatTHB(pricePerCycle)} บาททุกเดือน (ล็อกส่วนลดชุด + ส่วนลดตามเทอม {plan.months} เดือน) เมื่อครบเทอมต่ออายุอัตโนมัติในเงื่อนไขเดิม จนกว่าจะยกเลิก
          </p>
        </div>
      </div>
    </div>
  );
}
