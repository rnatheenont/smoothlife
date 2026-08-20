"use client";

import { useMemo } from "react";
import { Gift, Check, Lock } from "lucide-react";
import { evaluateActiveFreeGifts } from "@/data/free-gifts";
import { CartLine } from "@/data/coupons";
import { useCart } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";

export default function FreeGiftProgress() {
  const { lines } = useCart();
  const { lang, t } = useLang();

  // Exclude gift lines themselves from eligibility math — otherwise an
  // already-unlocked gift would count toward its own (or another promo's)
  // threshold and never re-lock when the real cart drops back below it.
  const cartLines: CartLine[] = lines
    .filter((l) => !l.isGift)
    .map((l) => ({
      slug: l.slug,
      qty: l.qty,
      price: l.price,
      brand: l.brand,
      category: l.category as CartLine["category"],
    }));

  const evals = useMemo(
    () => evaluateActiveFreeGifts(cartLines),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(cartLines)]
  );

  if (evals.length === 0) return null;

  return (
    <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
      <h2 className="font-bold text-brand-ink flex items-center gap-2 mb-3">
        <Gift size={17} className="text-brand-emerald" />
        {t("ของแถมฟรี", "Free gifts")}
      </h2>
      <div className="flex flex-col gap-2.5">
        {evals.map((ev) => {
          const title = lang === "en" ? ev.promo.titleEn : ev.promo.titleTh;
          const reason = lang === "en" ? ev.reasonEn : ev.reasonTh;
          return (
            <div
              key={ev.promo.slug}
              className={`w-full rounded-xl border p-3.5 ${
                ev.eligible ? "border-brand-teal bg-brand-gradient-soft" : "border-dashed border-slate-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                    ev.eligible ? "bg-brand-gradient text-white" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {ev.eligible ? <Check size={14} /> : <Lock size={12} />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold text-brand-ink">{title}</span>
                  <p className={`text-xs mt-1 font-semibold ${ev.eligible ? "text-brand-emerald" : "text-amber-600"}`}>
                    {reason}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
