"use client";

import { useEffect, useState } from "react";
import { Ticket, Check, X, Loader2 } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useLang } from "@/lib/lang-context";

type WebCoupon = { code: string; title: string; summary: string };

// The coupon box, answered by Shopify.
//
// Nothing here decides whether a code is valid or what it is worth: the code
// goes to the shop, and the shop replies with money or with a reason. That is
// why the amount shown while the customer is still deciding is the same one
// the card is charged — there is only ever one calculation, and it is not
// this one.
export default function CouponPicker() {
  const { couponCode, setCouponCode, couponQuote, couponPending, lines } = useCart();
  const { t } = useLang();
  const [code, setCode] = useState("");
  const [offered, setOffered] = useState<WebCoupon[]>([]);

  // The shop advertises a coupon by naming it "WEB: …" in Shopify Admin.
  // Usually there are none, and the box below stands on its own.
  useEffect(() => {
    fetch("/api/coupons")
      .then((r) => r.json())
      .then((d) => setOffered(Array.isArray(d?.coupons) ? d.coupons : []))
      .catch(() => {});
  }, []);

  if (!lines.length) return null;

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const entered = code.trim();
    if (entered) setCouponCode(entered);
  }

  const rejected = couponQuote && couponQuote.ok === false ? couponQuote.reason : null;
  const accepted = couponQuote?.ok ? couponQuote : null;

  return (
    <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
      <h2 className="font-bold text-brand-ink flex items-center gap-2 mb-1">
        <Ticket size={17} className="text-brand-emerald" />
        {t("คูปองส่วนลด", "Coupons")}
      </h2>
      <p className="text-xs text-slate-500 mb-4">
        {t("กรอกโค้ดแล้วระบบจะตรวจกับร้านให้ทันที", "Enter a code and the shop checks it right away")}
      </p>

      {accepted ? (
        <div className="flex items-center gap-3 rounded-xl border border-brand-teal bg-brand-gradient-soft p-3.5">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-gradient text-white">
            <Check size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-brand-ink">{accepted.title || accepted.code}</span>
              <span className="text-[10px] font-mono font-bold tracking-wide rounded-sm bg-white/70 px-1.5 py-0.5 text-slate-500">
                {accepted.code}
              </span>
            </div>
            <p className="text-xs font-semibold text-brand-800 mt-0.5">
              {t("ประหยัด", "You save")} ฿{accepted.discount.toLocaleString("th-TH")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCouponCode(null);
              setCode("");
            }}
            className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 shrink-0"
          >
            <X size={12} /> {t("ยกเลิก", "Remove")}
          </button>
        </div>
      ) : (
        <form onSubmit={apply} className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t("กรอกโค้ดส่วนลด", "Enter a coupon code")}
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-hidden focus:border-brand-teal uppercase"
          />
          <button
            type="submit"
            disabled={couponPending}
            className="rounded-lg bg-surface-muted px-4 text-sm font-semibold text-brand-dark disabled:opacity-60 flex items-center gap-1.5"
          >
            {couponPending && <Loader2 size={13} className="animate-spin" />}
            {t("ใช้โค้ด", "Apply")}
          </button>
        </form>
      )}

      {rejected && !couponPending && <p className="text-xs text-rose-700 mt-2">{rejected}</p>}

      {!accepted && offered.length > 0 && (
        <div className="flex flex-col gap-2.5 mt-4">
          {offered.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                setCode(c.code);
                setCouponCode(c.code);
              }}
              className="w-full text-left rounded-xl border border-slate-200 p-3.5 transition-colors hover:border-brand-teal"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-brand-ink">{c.title}</span>
                <span className="text-[10px] font-mono font-bold tracking-wide rounded-sm bg-slate-100 px-1.5 py-0.5 text-slate-500">
                  {c.code}
                </span>
              </div>
              {c.summary && <p className="text-xs text-slate-500 mt-0.5">{c.summary}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
