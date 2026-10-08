"use client";

import { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Minus, Plus, Trash2, Award, Ticket, Repeat, Gift } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useLoginModal } from "@/lib/login-modal-context";
import { useLang } from "@/lib/lang-context";
import { useOrderTotals } from "@/lib/use-order-totals";
import { formatTHB } from "@/lib/format";
import { suggestBundlesForCart } from "@/lib/bundle-suggest";
import { pointsForAmount } from "@/data/coupons";
import { getProductBySlug } from "@/data/products";
import { subscriptionPlans } from "@/data/subscriptions";
import CouponPicker from "@/components/CouponPicker";
import { Button } from "@/components/ui";
import FreeGiftProgress from "@/components/FreeGiftProgress";
import TieredRewardBox from "@/components/TieredRewardBox";
import MobileStickyBar from "@/components/MobileStickyBar";
import ProductCard from "@/components/ProductCard";

export default function CartPage() {
  const { lines, updateQty, removeItem, changeVariant } = useCart();
  const { open: openLogin } = useLoginModal();
  const { user } = useAuth();
  const { lang, t } = useLang();
  const totals = useOrderTotals();
  const checkoutButtonRef = useRef<HTMLElement>(null);
  // What the tab bar's badge counts, said out loud next to the title.
  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
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
    // What the gift would have cost. The line itself carries price 0, so the
    // only place the number survives is the catalogue — and only for gifts
    // that are in it: the ones off Shopify's unlisted free-gift shelf have a
    // variant id where a slug would be, and no price to find.
    const giftWorth = line.isGift ? getProductBySlug(line.slug)?.price ?? 0 : 0;
    return (
      <div
        key={`${line.variantId}-${line.isGift ? line.giftPromoSlug : line.subscribeMonths ?? "normal"}`}
        // A row in a sheet, not a card of its own. Five bordered cards
        // stacked inside a page that already has its own frame is three
        // frames deep, and on a phone it reads as five separate things
        // rather than one list of what you are buying.
        // bg-brand-gradient-soft, with no opacity modifier on it: that
        // utility is a background-IMAGE, and Tailwind's /nn modifier only
        // knows how to thin a colour — `bg-brand-gradient-soft/30` compiles
        // to no background at all. Measured: background-image "none". The
        // subscription row had been carrying that class, and that tint, for
        // as long as it has existed.
        className={`relative flex gap-3.5 px-4 py-4 ${
          line.isGift || plan ? "bg-brand-gradient-soft" : ""
        }`}
      >
        {/* A gift is the one row in here nobody is paying for, and it was
            reading as just another line with the word "ฟรี" where a price
            goes. The stripe is what makes it findable while scrolling past
            the things that do cost money. */}
        {line.isGift && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand-gradient" />}
        <Link href={`/product/${line.slug}`} className="relative h-20 w-20 md:h-24 md:w-24 shrink-0 self-center rounded-lg overflow-hidden bg-surface-soft">
          <Image src={line.image} alt={line.name} fill className="object-cover" />
        </Link>
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Above the name, not after it: the name is clamped to two lines,
              so a badge trailing it was the first thing to be cut off on a
              phone — on exactly the row it was there to mark. */}
          {line.isGift && (
            <span className="mb-1 inline-flex w-fit items-center gap-1 rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-bold text-white">
              <Gift size={10} aria-hidden /> {t("ของแถมฟรี", "Free gift")}
            </span>
          )}
          <div translate="no" className="flex items-start justify-between gap-2">
            <Link href={`/product/${line.slug}`} className="text-sm font-medium text-brand-ink line-clamp-2 hover:text-brand-800">
              {line.name}
              {plan && (
                <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[10px] font-semibold text-white bg-brand-gradient rounded-full px-2 py-0.5">
                  <Repeat size={9} /> ทุก {plan.months} เดือน -{plan.discountPct}%
                </span>
              )}
            </Link>
            {!line.isGift && (
              <button
                onClick={() => removeItem(line.variantId, line.subscribeMonths)}
                // -mr-2 -mt-2: the 44px of target it needs reaches back
                // over the row's own padding instead of pushing the name
                // in by that much.
                className="-mr-2 -mt-2 grid size-11 shrink-0 place-items-center text-slate-400 transition-colors hover:text-rose-500"
                aria-label={t("ลบออกจากตะกร้า", "Remove from cart")}
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>

          {!line.isGift &&
            (line.variants.length > 1 ? (
              <select
                value={line.variantId}
                onChange={(e) => changeVariant(line.variantId, e.target.value, line.subscribeMonths)}
                className="mt-1 self-start rounded-md border border-slate-200 bg-white text-xs text-slate-600 pl-1.5 pr-8 py-1"
              >
                {line.variants.map((v) => (
                  <option key={v.variantId} value={v.variantId} disabled={!v.inStock}>
                    {(v.size || t("ค่าเริ่มต้น", "Default")) + (v.inStock ? "" : ` (${t("สินค้าหมด", "Out of stock")})`)}
                  </option>
                ))}
              </select>
            ) : (
              line.size && <p className="text-xs text-slate-500 mt-0.5">{line.size}</p>
            ))}

          <div className="flex items-baseline gap-2 mt-1.5">
            <span
              className={
                line.isGift ? "brand-text-gradient text-base font-extrabold" : "font-bold text-brand-ink"
              }
            >
              {line.isGift ? t("ฟรี", "Free") : formatTHB(line.price)}
            </span>
            {/* The gift's own price, struck through: "free" says what you
                pay, this says what it is worth, and the second one is the
                reason the first is worth reading. */}
            {line.isGift && giftWorth > 0 && (
              <span className="text-xs text-slate-500 line-through">{formatTHB(giftWorth)}</span>
            )}
            {line.compareAtPrice && (
              <span className="text-xs text-slate-500 line-through">{formatTHB(line.compareAtPrice)}</span>
            )}
          </div>

          <div className="flex items-center justify-between mt-2">
            {line.isGift ? (
              <span className="text-xs text-slate-500">{t("จำนวน", "Qty")} {line.qty}</span>
            ) : (
              <div>
                {/* 28px before, on the two controls a cart screen exists
                    for. A thumb is told to find 44, and these are the ones
                    tapped over and over. */}
                <div className="inline-flex items-center rounded-full border border-slate-200">
                  <button
                    onClick={() => updateQty(line.variantId, line.qty - 1, line.subscribeMonths)}
                    className="grid size-11 place-items-center rounded-full text-brand-ink active:scale-90"
                    aria-label={t("ลดจำนวน", "Decrease quantity")}
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-7 text-center text-sm font-semibold tabular-nums">{line.qty}</span>
                  <button
                    onClick={() => updateQty(line.variantId, line.qty + 1, line.subscribeMonths)}
                    disabled={typeof line.stock === "number" && line.qty >= line.stock}
                    className="grid size-11 place-items-center rounded-full text-brand-ink active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                    aria-label={t("เพิ่มจำนวน", "Increase quantity")}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                {typeof line.stock === "number" && line.qty >= line.stock && (
                  <p className="text-[11px] text-amber-700 mt-1">มีสินค้าเหลือ {line.stock} ชิ้น</p>
                )}
              </div>
            )}
            {!line.isGift && (
              <div className="text-right">
                {line.qty > 1 && (
                  <p className="text-[11px] text-slate-500">
                    {t("รวม", "Total")} {formatTHB(line.price * line.qty)}
                  </p>
                )}
                <p className="text-[11px] text-brand-800 flex items-center gap-1 justify-end">
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
    // Tinted ground with white sheets laid on it. On a phone this is what
    // separates a list from the page holding it, and it is why a cart in an
    // app reads as a stack of things you are buying rather than as a web
    // page about them. Desktop keeps its own white, where the two-column
    // layout is already doing that job.
    <div className="bg-surface-soft lg:bg-transparent">
    <div className="container-page py-5 md:py-10">
      <h1 className="mb-4 text-xl font-bold text-brand-ink md:mb-6 md:text-3xl">
        {t("ตะกร้าสินค้า", "Shopping cart")}{" "}
        <span className="text-base font-medium text-slate-500 md:text-lg">({itemCount})</span>
      </h1>
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-4">
          {subscribeLines.length > 0 && (
            <section className="overflow-hidden rounded-2xl bg-white shadow-card">
              <h2 className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-3 text-sm font-bold text-brand-ink">
                <Repeat size={14} className="text-brand-emerald" /> {t("สมัครรับประจำ", "Subscription")}
              </h2>
              <div className="divide-y divide-slate-100">{subscribeLines.map(renderLine)}</div>
            </section>
          )}

          {normalLines.length > 0 && (
            <section className="overflow-hidden rounded-2xl bg-white shadow-card">
              {subscribeLines.length > 0 && (
                <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-brand-ink">
                  {t("ซื้อปกติ", "One-time purchase")}
                </h2>
              )}
              <div className="divide-y divide-slate-100">{normalLines.map(renderLine)}</div>
            </section>
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
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h2 className="font-bold text-brand-ink mb-4">{t("สรุปคำสั่งซื้อ", "Order summary")}</h2>
            <div className="flex justify-between text-sm text-slate-600 mb-2">
              <span>{t("ยอดรวมสินค้า", "Subtotal")}</span>
              <span>{formatTHB(totals.subtotal)}</span>
            </div>
            {totals.discount > 0 && (
              <div className="flex justify-between text-sm text-brand-800 mb-2">
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
              <p className="text-xs text-brand-800 bg-brand-gradient-soft rounded-lg p-2 mb-4">
                {lang === "en"
                  ? `Spend ${formatTHB(totals.amountToFreeShipping)} more for free shipping!`
                  : `ซื้อเพิ่มอีก ${formatTHB(totals.amountToFreeShipping)} เพื่อรับส่งฟรี!`}
              </p>
            )}
            <div className="flex justify-between font-bold text-brand-ink border-t border-slate-100 pt-4 mb-5">
              <span>{t("ยอดรวมทั้งหมด", "Total")}</span>
              <span>{formatTHB(totals.total)}</span>
            </div>
            {/* Ordering needs an account, so a guest is asked here rather
                than walked to a checkout that would only turn them back. */}
            <Button
              ref={checkoutButtonRef}
              size="lg"
              fullWidth
              {...(user
                ? { href: "/checkout" }
                : { type: "button" as const, onClick: () => openLogin("/checkout") })}
            >
              {user ? t("ดำเนินการชำระเงิน", "Proceed to checkout") : t("เข้าสู่ระบบเพื่อสั่งซื้อ", "Sign in to order")}
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
                    className="h-full bg-brand-gradient transition"
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
              <button
                type="button"
                onClick={() => openLogin("/cart")}
                // The dialog rather than the page: nobody clicking this has
                // finished with their cart.
                className="mt-4 grid h-11 w-full place-items-center rounded-full border border-amber-300 bg-white text-xs font-semibold text-brand-dark"
              >
                {t("เข้าสู่ระบบเพื่อสะสมคะแนน", "Sign in to collect points")}
              </button>
            )}
          </div>
        </div>
      </div>

      <MobileStickyBar hideWhenVisible={checkoutButtonRef}>
        <div className="min-w-0 shrink-0">
          <p className="text-[11px] text-slate-500">{t("ยอดรวมทั้งหมด", "Total")}</p>
          <p className="text-base font-bold leading-tight text-brand-ink">{formatTHB(totals.total)}</p>
        </div>
        {/* The one thing this screen is for, at the size that says so: it
            was a 36px button sharing the row with the total. */}
        <Button
          size="lg"
          className="min-w-0 flex-1 active:scale-95"
          {...(user
            ? { href: "/checkout" }
            : { type: "button" as const, onClick: () => openLogin("/checkout") })}
        >
          {user ? t("ดำเนินการชำระเงิน", "Checkout") : t("เข้าสู่ระบบเพื่อสั่งซื้อ", "Sign in to order")}
        </Button>
      </MobileStickyBar>
    </div>
    </div>
  );
}
