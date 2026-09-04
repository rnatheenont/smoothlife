"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, Award, Ticket, Repeat } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useOrderTotals } from "@/lib/use-order-totals";
import { formatTHB } from "@/lib/format";
import { suggestBundlesForCart } from "@/lib/bundle-suggest";
import { pointsForAmount } from "@/data/coupons";
import { subscriptionPlans } from "@/data/subscriptions";
import CouponPicker from "@/components/CouponPicker";
import { Button } from "@/components/ui";
import FreeGiftProgress from "@/components/FreeGiftProgress";
import TieredRewardBox from "@/components/TieredRewardBox";
import MobileStickyBar from "@/components/MobileStickyBar";
import ProductCard from "@/components/ProductCard";

export default function CartPage() {
  const { lines, updateQty, removeItem, changeVariant } = useCart();
  const { user } = useAuth();
  const { lang, t } = useLang();
  const totals = useOrderTotals();
  const checkoutButtonRef = useRef<HTMLElement>(null);
  const bundleSuggestions = suggestBundlesForCart(lines.filter((l) => !l.isGift).map((l) => l.slug));
  // Subscribe-added lines never merge with a normal line of the same
  // product (see cart-context's sameLine) — grouped into their own section
  // here so a customer can see at a glance which items are a recurring
  // commitment vs. a one-off purchase, rather than one undifferentiated list.
  const subscribeLines = lines.filter((l) => !l.isGift && l.subscribeMonths);
  const normalLines = lines.filter((l) => l.isGift || !l.subscribeMonths);

  if (lines.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <span className="relative mx-auto block h-24 w-24">
          <Image src="/mascot/smoothie-say.png" alt="" fill sizes="96px" className="object-contain" />
        </span>
        <h1 className="text-xl font-bold text-brand-ink mt-2">{t("ตะกร้าของคุณว่างเปล่า", "Your cart is empty")}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {t("เลือกชมสินค้าคุณภาพดีจาก Smooth Life", "Browse quality products from Smooth Life")}
        </p>
        <Button href="/shop" size="lg" className="mt-6">
          {t("เริ่มช้อปเลย", "Start shopping")}
        </Button>
      </div>
    );
  }

  function renderLine(line: (typeof lines)[number]) {
    const plan = line.subscribeMonths ? subscriptionPlans.find((p) => p.months === line.subscribeMonths) : null;
    return (
      <div
        key={`${line.variantId}-${line.isGift ? line.giftPromoSlug : line.subscribeMonths ?? "normal"}`}
        className={`flex gap-4 rounded-xl2 border p-3 md:p-4 shadow-card ${
          plan ? "border-brand-teal/30 bg-brand-gradient-soft/30" : "border-slate-100"
        }`}
      >
        <Link href={`/product/${line.slug}`} className="relative h-20 w-20 md:h-24 md:w-24 shrink-0 self-center rounded-lg overflow-hidden bg-surface-soft">
          <Image src={line.image} alt={line.name} fill className="object-cover" />
        </Link>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/product/${line.slug}`} className="text-sm font-medium text-brand-ink line-clamp-2 hover:text-brand-emerald">
              {line.name}
              {line.isGift && (
                <span className="ml-1.5 inline-block align-middle text-[10px] font-semibold text-brand-emerald bg-brand-gradient-soft rounded px-1.5 py-0.5">
                  {t("ของแถม", "Free gift")}
                </span>
              )}
              {plan && (
                <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[10px] font-semibold text-white bg-brand-gradient rounded-full px-2 py-0.5">
                  <Repeat size={9} /> ทุก {plan.months} เดือน -{plan.discountPct}%
                </span>
              )}
            </Link>
            {!line.isGift && (
              <button
                onClick={() => removeItem(line.variantId, line.subscribeMonths)}
                className="shrink-0 text-slate-400 hover:text-rose-500"
                aria-label="Remove"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>

          {!line.isGift &&
            (line.variants.length > 1 ? (
              <select
                value={line.variantId}
                onChange={(e) => changeVariant(line.variantId, e.target.value, line.subscribeMonths)}
                className="mt-1 self-start rounded-md border border-slate-200 bg-white text-xs text-slate-600 pl-1.5 pr-5 py-1"
              >
                {line.variants.map((v) => (
                  <option key={v.variantId} value={v.variantId} disabled={!v.inStock}>
                    {(v.size || t("ค่าเริ่มต้น", "Default")) + (v.inStock ? "" : ` (${t("สินค้าหมด", "Out of stock")})`)}
                  </option>
                ))}
              </select>
            ) : (
              line.size && <p className="text-xs text-slate-400 mt-0.5">{line.size}</p>
            ))}

          <div className="flex items-baseline gap-2 mt-1.5">
            <span className="font-bold text-brand-ink">{line.isGift ? t("ฟรี", "Free") : formatTHB(line.price)}</span>
            {line.compareAtPrice && (
              <span className="text-xs text-slate-400 line-through">{formatTHB(line.compareAtPrice)}</span>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            {line.isGift ? (
              <span className="text-xs text-slate-500">{t("จำนวน", "Qty")} {line.qty}</span>
            ) : (
              <div>
                <div className="flex items-center border border-slate-200 rounded-full">
                  <button onClick={() => updateQty(line.variantId, line.qty - 1, line.subscribeMonths)} className="p-2" aria-label="Decrease">
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center text-xs font-semibold">{line.qty}</span>
                  <button
                    onClick={() => updateQty(line.variantId, line.qty + 1, line.subscribeMonths)}
                    disabled={typeof line.stock === "number" && line.qty >= line.stock}
                    className="p-2 disabled:opacity-30 disabled:pointer-events-none"
                    aria-label="Increase"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {typeof line.stock === "number" && line.qty >= line.stock && (
                  <p className="text-[11px] text-amber-600 mt-1">มีสินค้าเหลือ {line.stock} ชิ้น</p>
                )}
              </div>
            )}
            {!line.isGift && (
              <div className="text-right">
                {line.qty > 1 && (
                  <p className="text-[11px] text-slate-400">
                    {t("รวม", "Total")} {formatTHB(line.price * line.qty)}
                  </p>
                )}
                <p className="text-[11px] text-brand-emerald flex items-center gap-1 justify-end">
                  <Award size={11} />
                  {lang === "en"
                    ? `+${pointsForAmount(line.price * line.qty)} points`
                    : `+${pointsForAmount(line.price * line.qty)} คะแนน`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-6">{t("ตะกร้าสินค้า", "Shopping cart")}</h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {subscribeLines.length > 0 && (
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-bold text-brand-ink mb-2">
                <Repeat size={14} className="text-brand-emerald" /> {t("สมัครรับประจำ", "Subscription")}
              </h2>
              <div className="flex flex-col gap-3">{subscribeLines.map(renderLine)}</div>
            </div>
          )}

          {normalLines.length > 0 && (
            <div className={subscribeLines.length > 0 ? "mt-2" : undefined}>
              {subscribeLines.length > 0 && (
                <h2 className="text-sm font-bold text-brand-ink mb-2">{t("ซื้อปกติ", "One-time purchase")}</h2>
              )}
              <div className="flex flex-col gap-3">{normalLines.map(renderLine)}</div>
            </div>
          )}

          <CouponPicker />
          <FreeGiftProgress />
          <TieredRewardBox />

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
                  <Ticket size={13} />{" "}
                  {totals.referralActive
                    ? t("ส่วนลดแนะนำเพื่อน", "Referral discount")
                    : totals.subscribePlan
                    ? t(`ส่วนลดสมัครสมาชิก -${totals.subscribePlan.discountPct}%`, `Subscription discount -${totals.subscribePlan.discountPct}%`)
                    : totals.coupon?.code}
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
            <Button ref={checkoutButtonRef} href="/checkout" size="lg" fullWidth>
              {t("ดำเนินการชำระเงิน", "Proceed to checkout")}
            </Button>
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
                ? `1 point per ฿1 spent, calculated on ${formatTHB(totals.netSubtotal)} after discount.`
                : `รับ 1 คะแนนต่อทุก 1 บาท คำนวณจากยอด ${formatTHB(totals.netSubtotal)} หลังหักส่วนลด`}
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
                      ? `Spend ${formatTHB(totals.progressAfter.remaining)} more (12mo) to reach ${totals.progressAfter.next}`
                      : `ซื้อเพิ่มอีก ${formatTHB(totals.progressAfter.remaining)} (รอบ 12 เดือน) ถึงระดับ ${totals.progressAfter.next}`}
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
        <Button href="/checkout" className="shrink-0 text-xs active:scale-95">
          {t("ดำเนินการชำระเงิน", "Proceed to checkout")}
        </Button>
      </MobileStickyBar>
    </div>
  );
}
