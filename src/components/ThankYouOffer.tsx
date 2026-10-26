"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Timer, Tag } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useWidgetSettings } from "@/lib/use-widget-settings";
import { useLang } from "@/lib/lang-context";
import { formatTHB } from "@/lib/format";

// The offer on the thank-you page.
//
// The app on Shopify calls this a post-purchase upsell and sells it as a
// one-click add-on: the shopper taps "Claim offer" and it joins the order
// they just paid for, with no card details asked for again. That part cannot
// be copied honestly here. Shopify's post-purchase page runs inside Shopify's
// own checkout, and our orders are paid through 2C2P, where we hold no token
// to charge a second time — anything claiming one-click would be a button
// that silently does something else.
//
// So this is the offer without the claim: a short-lived discount on the
// thank-you page, which puts the products in a fresh cart with the code
// already applied. The shopper pays again, and the page says so rather than
// implying otherwise. It is the part of the feature that actually works, and
// the part that does not is left out rather than faked.

type OfferConfig = {
  titleTh?: string;
  subtitleTh?: string;
  code?: string;
  productSlugs?: string;
  minutes?: number;
};

export default function ThankYouOffer() {
  const { settings } = useWidgetSettings();
  const { addItem, setCouponCode, productBySlug } = useCart();
  const { t } = useLang();
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const widget = settings.thankyou_offer;
  const config = (widget?.config ?? {}) as OfferConfig;
  const minutes = Number(config.minutes ?? 15);

  // The window starts when the page is opened, not at a fixed hour: this is
  // an offer made to one shopper at the end of one order.
  useEffect(() => {
    if (!widget?.enabled) return;
    setSecondsLeft(Math.max(1, Math.round(minutes * 60)));
    const id = setInterval(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)));
    }, 1000);
    return () => clearInterval(id);
  }, [widget?.enabled, minutes]);

  if (!widget?.enabled) return null;

  const slugs = String(config.productSlugs ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const products = slugs.map((slug) => productBySlug(slug)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  if (products.length === 0 || secondsLeft === 0) return null;

  const mins = Math.floor((secondsLeft ?? 0) / 60);
  const secs = (secondsLeft ?? 0) % 60;

  function claim(slug: string, variantId: string) {
    addItem(slug, 1, variantId);
    if (config.code) setCouponCode(config.code);
    router.push("/cart");
  }

  return (
    <section className="mx-auto mt-10 max-w-2xl rounded-feature bg-brand-gradient-soft p-5 text-left shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold text-brand-ink">
          <Tag size={16} className="text-brand-emerald" />
          {config.titleTh || t("ข้อเสนอพิเศษสำหรับคุณ", "A special offer for you")}
        </h2>
        {secondsLeft !== null && (
          <span className="flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-bold tabular-nums text-brand-800">
            <Timer size={12} aria-hidden />
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-slate-600">
        {config.subtitleTh || t("ส่วนลดนี้ใช้ได้ภายในเวลาที่กำหนด", "This discount is available for a limited time")}
      </p>

      {/* Said plainly, because the alternative is a shopper who taps expecting
          the item to join the order they just paid for. */}
      <p className="mt-1 text-[11px] text-slate-500">
        {t(
          "เป็นคำสั่งซื้อใหม่ ชำระเงินอีกครั้ง — ส่วนลดจะถูกใส่ให้อัตโนมัติ",
          "This starts a new order and is paid separately — the discount is applied for you",
        )}
      </p>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {products.slice(0, 4).map((p) => (
          <li key={p.slug} className="flex items-center gap-2.5 rounded-xl2 bg-white/80 p-2">
            <span className="relative size-14 shrink-0 overflow-hidden rounded-m bg-white">
              {p.image && <Image src={p.image} alt="" fill sizes="56px" className="object-contain" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-brand-ink">{p.name}</span>
              <span className="mt-0.5 block text-[12px] font-bold text-brand-800">{formatTHB(p.price)}</span>
            </span>
            <button
              type="button"
              onClick={() => claim(p.slug, p.variantId)}
              className="shrink-0 rounded-full bg-brand-gradient px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              {t("รับข้อเสนอ", "Claim")}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
