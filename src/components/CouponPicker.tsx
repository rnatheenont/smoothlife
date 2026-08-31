"use client";

import { useMemo, useState } from "react";
import { Ticket, Check, Lock, X } from "lucide-react";
import { evaluateAll, CartLine } from "@/data/coupons";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";

export default function CouponPicker() {
  const { lines, couponCode, setCouponCode } = useCart();
  const { user } = useAuth();
  const { lang, t } = useLang();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const cartLines: CartLine[] = lines.map((l) => ({
    slug: l.slug,
    qty: l.qty,
    price: l.price,
    brand: l.brand,
    category: l.category as CartLine["category"],
  }));

  const evals = useMemo(
    () => evaluateAll(cartLines, { signedIn: Boolean(user), tier: user?.tier }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(cartLines), user?.tier, user?.id]
  );

  const usableCount = evals.filter((e) => e.eligible).length;

  function applyCode(e: React.FormEvent) {
    e.preventDefault();
    const found = evals.find((v) => v.coupon.code.toLowerCase() === code.trim().toLowerCase());
    if (!found) {
      setError(t("ไม่พบโค้ดนี้", "Coupon code not found"));
      return;
    }
    if (!found.eligible) {
      setError(lang === "en" ? found.reasonEn : found.reasonTh);
      return;
    }
    setError("");
    setCouponCode(found.coupon.code);
    setCode("");
  }

  return (
    <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-brand-ink flex items-center gap-2">
          <Ticket size={17} className="text-brand-emerald" />
          {t("คูปองส่วนลด", "Coupons")}
        </h2>
        <span className="text-[11px] font-semibold text-brand-emerald bg-brand-gradient-soft rounded-full px-2.5 py-1">
          {lang === "en" ? `${usableCount} available` : `ใช้ได้ ${usableCount} ใบ`}
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-4">
        {t("เลือกคูปองที่ตรงเงื่อนไข ระบบจะคำนวณส่วนลดให้ทันที", "Pick an eligible coupon and the discount applies instantly")}
      </p>

      <form onSubmit={applyCode} className="flex gap-2 mb-4">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError("");
          }}
          placeholder={t("กรอกโค้ดส่วนลด", "Enter a coupon code")}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal uppercase"
        />
        <button type="submit" className="rounded-lg bg-surface-muted px-4 text-sm font-semibold text-brand-dark">
          {t("ใช้โค้ด", "Apply")}
        </button>
      </form>
      {error && <p className="text-xs text-rose-500 -mt-2 mb-3">{error}</p>}

      <div className="flex flex-col gap-2.5">
        {evals.map((ev) => {
          const active = couponCode === ev.coupon.code;
          const title = lang === "en" ? ev.coupon.titleEn : ev.coupon.titleTh;
          const desc = lang === "en" ? ev.coupon.descEn : ev.coupon.descTh;
          const reason = lang === "en" ? ev.reasonEn : ev.reasonTh;
          return (
            <button
              key={ev.coupon.code}
              type="button"
              disabled={!ev.eligible}
              onClick={() => setCouponCode(active ? null : ev.coupon.code)}
              className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                active
                  ? "border-brand-teal bg-brand-gradient-soft"
                  : ev.eligible
                  ? "border-slate-200 hover:border-brand-teal"
                  : "border-dashed border-slate-200 opacity-60 cursor-not-allowed"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    active ? "bg-brand-gradient text-white" : ev.eligible ? "bg-surface-muted text-brand-emerald" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {active ? <Check size={14} /> : ev.eligible ? <Ticket size={14} /> : <Lock size={12} />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-brand-ink">{title}</span>
                    <span className="text-[10px] font-mono font-bold tracking-wide rounded-sm bg-slate-100 px-1.5 py-0.5 text-slate-500">
                      {ev.coupon.code}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  <p className={`text-xs mt-1 font-semibold ${ev.eligible ? "text-brand-emerald" : "text-amber-600"}`}>
                    {reason}
                  </p>
                </div>
                {active && (
                  <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                    <X size={12} /> {t("ยกเลิก", "Remove")}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
