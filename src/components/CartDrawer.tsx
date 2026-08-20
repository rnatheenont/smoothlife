"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, ShoppingBag, Minus, Plus, Trash2, Gift, Check, Lock } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useCartDrawer } from "@/lib/cart-drawer-context";
import { useOrderTotals } from "@/lib/use-order-totals";
import { useLang } from "@/lib/lang-context";
import { useFreeGiftEvals } from "@/lib/use-free-gift-evals";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { formatTHB } from "@/lib/format";

export default function CartDrawer() {
  const { open, setOpen } = useCartDrawer();
  const { lines, updateQty, removeItem } = useCart();
  const totals = useOrderTotals();
  const { lang, t } = useLang();
  const evals = useFreeGiftEvals();
  const { settings } = useWidgetSettings();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const giftLines = lines.filter((l) => l.isGift);

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="absolute right-0 top-0 h-full w-80 max-w-[90vw] bg-white shadow-xl flex flex-col animate-slideInRight">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 shrink-0">
          <h2 className="font-bold text-brand-ink flex items-center gap-2">
            <ShoppingBag size={18} /> {t("ตะกร้าสินค้า", "Your cart")} ({lines.reduce((s, l) => s + l.qty, 0)})
          </h2>
          <button onClick={() => setOpen(false)} aria-label={t("ปิด", "Close")}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {lines.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">{t("ตะกร้าว่างเปล่า", "Your cart is empty")}</p>
          ) : (
            lines.map((line) => (
              <div key={`${line.variantId}-${line.isGift ? line.giftPromoSlug : "real"}`} className="flex gap-3">
                <div className="relative h-14 w-14 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
                  <Image src={line.image} alt={line.name} fill sizes="56px" className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-brand-ink line-clamp-2">
                    {line.name}
                    {line.isGift && (
                      <span className="ml-1 inline-block align-middle text-[9px] font-semibold text-brand-emerald bg-brand-gradient-soft rounded px-1 py-0.5">
                        {t("ของแถม", "Free")}
                      </span>
                    )}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs font-bold text-brand-ink">{line.isGift ? t("ฟรี", "Free") : formatTHB(line.price)}</span>
                    {line.isGift ? (
                      <span className="text-[11px] text-slate-400">x{line.qty}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateQty(line.variantId, line.qty - 1)} className="p-1 text-slate-400" aria-label="Decrease">
                          <Minus size={11} />
                        </button>
                        <span className="w-5 text-center text-xs">{line.qty}</span>
                        <button onClick={() => updateQty(line.variantId, line.qty + 1)} className="p-1 text-slate-400" aria-label="Increase">
                          <Plus size={11} />
                        </button>
                        <button onClick={() => removeItem(line.variantId)} className="p-1 text-slate-300 hover:text-rose-500" aria-label="Remove">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {/* Widget #6 "Offer on slide cart" — independent toggle from the Milestone bar */}
          {settings.cart_drawer_offer.enabled && evals.length > 0 && (
            <div className="rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] font-bold text-brand-ink flex items-center gap-1 mb-2">
                <Gift size={12} className="text-brand-emerald" /> {t("ข้อเสนอพิเศษ", "Special offers")}
              </p>
              {evals.map((ev) => (
                <div key={ev.promo.slug} className="flex items-center gap-2 py-1">
                  {ev.eligible ? <Check size={12} className="text-brand-emerald shrink-0" /> : <Lock size={11} className="text-slate-300 shrink-0" />}
                  <span className={`text-[11px] ${ev.eligible ? "text-brand-emerald font-semibold" : "text-slate-500"}`}>
                    {lang === "en" ? ev.reasonEn : ev.reasonTh}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Widget #10 "Gifts on Slide cart" — claimed-gift list, derived from lines already merged into the cart */}
          {settings.gifts_on_slide_cart.enabled && giftLines.length > 0 && (
            <div className="rounded-xl bg-brand-gradient-soft p-3">
              <p className="text-[11px] font-bold text-brand-ink mb-1.5">{t("ของแถมที่ได้รับ", "Gifts claimed")}</p>
              {giftLines.map((g) => (
                <p key={g.variantId} className="text-[11px] text-brand-ink">
                  🎁 {g.name} x{g.qty}
                </p>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 && (
          <div className="border-t border-slate-100 p-4 shrink-0 space-y-2">
            <div className="flex justify-between text-sm font-bold text-brand-ink">
              <span>{t("ยอดรวม", "Total")}</span>
              <span>{formatTHB(totals.total)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setOpen(false)}
              className="block text-center rounded-full bg-brand-gradient text-white font-semibold py-2.5 text-sm"
            >
              {t("ดำเนินการชำระเงิน", "Checkout")}
            </Link>
            <Link
              href="/cart"
              onClick={() => setOpen(false)}
              className="block text-center text-xs text-slate-400 hover:text-slate-600 pt-1"
            >
              {t("ดูตะกร้าแบบเต็มหน้า", "View full cart page")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
