"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, ShoppingBag, Award, Ticket } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useOrderTotals } from "@/lib/use-order-totals";
import { formatTHB } from "@/lib/format";
import { suggestBundlesForCart } from "@/lib/bundle-suggest";
import CouponPicker from "@/components/CouponPicker";
import MobileStickyBar from "@/components/MobileStickyBar";
import ProductCard from "@/components/ProductCard";

export default function CartPage() {
  const { lines, updateQty, removeItem, changeVariant } = useCart();
  const { user } = useAuth();
  const { lang, t } = useLang();
  const totals = useOrderTotals();
  const checkoutButtonRef = useRef<HTMLAnchorElement>(null);
  const bundleSuggestions = suggestBundlesForCart(lines.map((l) => l.slug));

  if (lines.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <ShoppingBag size={48} className="mx-auto text-slate-300" />
        <h1 className="text-xl font-bold text-brand-ink mt-4">{t("ตะกร้าของคุณว่างเปล่า", "Your cart is empty")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("เลือกชมสินค้าคุณภาพดีจาก Smooth Life", "Browse quality products from Smooth Life")}
        </p>
        <Link href="/shop" className="inline-block mt-6 rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm">
          {t("เริ่มช้อปเลย", "Start shopping")}
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-6">{t("ตะกร้าสินค้า", "Shopping cart")}</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {lines.map((line) => (
            <div key={line.variantId} className="flex gap-4 rounded-xl2 border border-slate-100 p-3 md:p-4 shadow-card">
              <Link href={`/product/${line.slug}`} className="relative h-20 w-20 md:h-24 md:w-24 shrink-0 rounded-lg overflow-hidden bg-surface-soft">
                <Image src={line.image} alt={line.name} fill className="object-cover" />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/product/${line.slug}`} className="text-sm font-medium text-brand-ink line-clamp-2 hover:text-brand-emerald">
                  {line.name}
                </Link>
                {line.variants.length > 1 ? (
                  <select
                    value={line.variantId}
                    onChange={(e) => changeVariant(line.variantId, e.target.value)}
                    className="mt-0.5 rounded-md border border-slate-200 bg-white text-xs text-slate-600 pl-1.5 pr-6 py-1"
                  >
                    {line.variants.map((v) => (
                      <option key={v.variantId} value={v.variantId} disabled={!v.inStock}>
                        {(v.size || t("ค่าเริ่มต้น", "Default")) + (v.inStock ? "" : ` (${t("สินค้าหมด", "Out of stock")})`)}
                      </option>
                    ))}
                  </select>
                ) : (
                  line.size && <p className="text-xs text-slate-400 mt-0.5">{line.size}</p>
                )}
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="font-bold text-brand-ink">{formatTHB(line.price)}</span>
                  {line.compareAtPrice && (
                    <span className="text-xs text-slate-400 line-through">{formatTHB(line.compareAtPrice)}</span>
                  )}
                </div>
                <p className="text-[11px] text-brand-emerald mt-1 flex items-center gap-1">
                  <Award size={11} />
                  {lang === "en"
                    ? `+${Math.floor((line.price * line.qty) / 100)} points`
                    : `+${Math.floor((line.price * line.qty) / 100)} คะแนน`}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center border border-slate-200 rounded-full">
                    <button onClick={() => updateQty(line.variantId, line.qty - 1)} className="p-2" aria-label="Decrease">
                      <Minus size={12} />
                    </button>
                    <span className="w-6 text-center text-xs font-semibold">{line.qty}</span>
                    <button onClick={() => updateQty(line.variantId, line.qty + 1)} className="p-2" aria-label="Increase">
                      <Plus size={12} />
                    </button>
                  </div>
                  <button onClick={() => removeItem(line.variantId)} className="text-slate-400 hover:text-rose-500" aria-label="Remove">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          <CouponPicker />

          {bundleSuggestions.length > 0 && (
            <div className="mt-2">
              <h2 className="font-bold text-brand-ink mb-3">
                {t("อาจสนใจ: เซ็ต Bundle จากแบรนด์ที่คุณเลือก", "You might like: bundle deals from brands in your cart")}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {bundleSuggestions.map((p) => (
                  <ProductCard key={p.slug} product={p} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4 h-fit lg:sticky lg:top-[152px]">
          <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
            <h2 className="font-bold text-brand-ink mb-4">{t("สรุปคำสั่งซื้อ", "Order summary")}</h2>
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>{t("ยอดรวมสินค้า", "Subtotal")}</span>
              <span>{formatTHB(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-brand-emerald mb-2">
                <span className="flex items-center gap-1.5">
                  <Ticket size={13} /> {totals.coupon?.code}
                </span>
                <span>-{formatTHB(totals.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-slate-600 mb-4">
              <span>{t("ค่าจัดส่ง", "Shipping")}</span>
              <span>{totals.freeShipping ? t("ฟรี", "Free") : formatTHB(totals.shipping)}</span>
            </div>
            {!totals.freeShipping && (
              <p className="text-xs text-brand-emerald bg-brand-gradient-soft rounded-lg p-2 mb-4">
                {lang === "en"
                  ? `Spend ${formatTHB(totals.amountToFreeShipping)} more for free shipping!`
                  : `ซื้อเพิ่มอีก ${formatTHB(totals.amountToFreeShipping)} เพื่อรับส่งฟรี!`}
              </p>
            )}
            <div className="flex justify-between font-bold text-brand-ink border-t border-slate-100 pt-4 mb-5">
              <span>{t("ยอดรวมทั้งหมด", "Total")}</span>
              <span>{formatTHB(totals.total)}</span>
            </div>
            <Link
              ref={checkoutButtonRef}
              href="/checkout"
              className="block text-center rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity"
            >
              {t("ดำเนินการชำระเงิน", "Proceed to checkout")}
            </Link>
          </div>

          <div className="rounded-xl2 border border-amber-200 bg-amber-50/60 p-5">
            <h3 className="font-bold text-brand-ink flex items-center gap-2 text-sm">
              <Award size={16} className="text-amber-500" />
              {t("คะแนนที่จะได้รับ", "Points you'll earn")}
            </h3>
            <p className="text-3xl font-extrabold brand-text-gradient mt-2">
              +{totals.points.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {lang === "en"
                ? `1 point per ฿100 spent, calculated on ${formatTHB(totals.netSubtotal)} after discount.`
                : `รับ 1 คะแนนต่อทุก 100 บาท คำนวณจากยอด ${formatTHB(totals.netSubtotal)} หลังหักส่วนลด`}
            </p>

            {user ? (
              <div className="mt-4 border-t border-amber-200 pt-3">
                <div className="flex justify-between text-xs text-slate-600 mb-1.5">
                  <span>
                    {lang === "en"
                      ? `${totals.currentPoints.toLocaleString()} → ${(totals.currentPoints + totals.points).toLocaleString()} points`
                      : `${totals.currentPoints.toLocaleString()} → ${(totals.currentPoints + totals.points).toLocaleString()} คะแนน`}
                  </span>
                  <span className="font-semibold text-brand-dark">{totals.progressAfter.current}</span>
                </div>
                <div className="h-2 rounded-full bg-white overflow-hidden">
                  <div
                    className="h-full bg-brand-gradient transition-all"
                    style={{ width: `${totals.progressAfter.percent}%` }}
                  />
                </div>
                {totals.progressAfter.next && (
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {lang === "en"
                      ? `${totals.progressAfter.remaining.toLocaleString()} more points to ${totals.progressAfter.next}`
                      : `อีก ${totals.progressAfter.remaining.toLocaleString()} คะแนนถึงระดับ ${totals.progressAfter.next}`}
                  </p>
                )}
              </div>
            ) : (
              <Link
                href="/account/login?returnTo=/cart"
                className="mt-4 block text-center rounded-full bg-white border border-amber-300 text-xs font-semibold text-brand-dark py-2.5"
              >
                {t("เข้าสู่ระบบเพื่อสะสมคะแนน", "Sign in to collect points")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <MobileStickyBar hideWhenVisible={checkoutButtonRef}>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500">{t("ยอดรวมทั้งหมด", "Total")}</p>
          <p className="text-sm font-bold text-brand-ink">{formatTHB(totals.total)}</p>
        </div>
        <Link
          href="/checkout"
          className="flex items-center justify-center rounded-full bg-brand-gradient text-white font-semibold px-5 py-2.5 text-xs shrink-0 active:scale-95 transition-transform"
        >
          {t("ดำเนินการชำระเงิน", "Proceed to checkout")}
        </Link>
      </MobileStickyBar>
    </div>
  );
}
