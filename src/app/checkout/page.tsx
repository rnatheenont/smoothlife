"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Ticket, Award, Loader2, AlertTriangle } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useOrderTotals } from "@/lib/use-order-totals";
import { formatTHB } from "@/lib/format";
import { cartCreate, shopifyConfigured } from "@/lib/shopify";
import MobileStickyBar from "@/components/MobileStickyBar";

export default function CheckoutPage() {
  const { lines, subtotal, couponCode } = useCart();
  const { user } = useAuth();
  const { lang } = useLang();
  const totals = useOrderTotals();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const shippingFree = totals.freeShipping;
  const shipping = totals.shipping;
  const total = totals.total;

  if (!user) {
    return (
      <div className="container-page py-20 text-center max-w-md mx-auto">
        <h1 className="text-xl font-bold text-brand-ink">เข้าสู่ระบบเพื่อดำเนินการชำระเงิน</h1>
        <p className="text-sm text-slate-500 mt-2">เข้าสู่ระบบด้วย OTP, LINE หรือ Email เพื่อรับคะแนนสะสมทุกออเดอร์</p>
        <Link href="/account/login?returnTo=/checkout" className="inline-block mt-6 rounded-full bg-brand-gradient text-white font-semibold px-6 py-3 text-sm">
          เข้าสู่ระบบ / สมัครสมาชิก
        </Link>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-slate-500">ตะกร้าของคุณว่างเปล่า</p>
        <Link href="/shop" className="inline-block mt-4 text-brand-emerald font-semibold">เริ่มช้อป</Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!shopifyConfigured) {
      setError(
        "ยังไม่ได้ตั้งค่าการเชื่อมต่อ Shopify (NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN / NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN) กรุณาติดต่อผู้ดูแลระบบ"
      );
      return;
    }
    setSubmitting(true);
    try {
      const cart = await cartCreate(
        lines.map((l) => ({ merchandiseId: l.variantId, quantity: l.qty })),
        couponCode,
        user.email || null
      );
      window.location.href = cart.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถสร้างคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-6">ดำเนินการชำระเงิน</h1>
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
            <h2 className="font-bold text-brand-ink mb-4 flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand-emerald" /> ที่อยู่จัดส่งและการชำระเงิน
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              คุณจะถูกนำไปยังหน้าชำระเงินที่ปลอดภัยของ Shopify เพื่อกรอกที่อยู่จัดส่งและเลือกวิธีชำระเงิน
              (PromptPay, บัตรเครดิต/เดบิต, โอนเงิน หรือเก็บเงินปลายทางตามที่ร้านเปิดใช้งาน)
            </p>
          </div>
          {error && (
            <div className="rounded-xl2 border border-rose-200 bg-rose-50 text-rose-700 text-sm p-4 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl2 border border-slate-100 p-5 h-fit shadow-card sticky top-24">
          <h2 className="font-bold text-brand-ink mb-4">สรุปคำสั่งซื้อ</h2>
          <div className="flex flex-col gap-2 mb-4 max-h-56 overflow-y-auto">
            {lines.map((l) => (
              <div key={l.slug} className="flex justify-between text-xs text-slate-600">
                <span className="line-clamp-1 pr-2">{l.name} x{l.qty}</span>
                <span className="shrink-0">{formatTHB(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>ยอดรวมสินค้า</span>
            <span>{formatTHB(subtotal)}</span>
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
            <span>ค่าจัดส่ง</span>
            <span>{shippingFree ? "ฟรี" : formatTHB(shipping)}</span>
          </div>
          <div className="flex justify-between font-bold text-brand-ink border-t border-slate-100 pt-4 mb-5">
            <span>ยอดรวมโดยประมาณ</span>
            <span>{formatTHB(total)}</span>
          </div>
          <button
            ref={submitButtonRef}
            type="submit"
            disabled={submitting || lines.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "กำลังไปหน้าชำระเงิน..." : "ไปหน้าชำระเงินของ Shopify"}
          </button>
          <p className="text-[11px] text-slate-500 mt-3 text-center flex items-center justify-center gap-1.5">
            <Award size={12} className="text-amber-500" />
            {lang === "en"
              ? `Estimated ${totals.points.toLocaleString()} points once payment is confirmed`
              : `คาดว่าจะได้รับ ${totals.points.toLocaleString()} คะแนน เมื่อชำระเงินสำเร็จ`}
          </p>
        </div>

        <MobileStickyBar hideWhenVisible={submitButtonRef}>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">ยอดรวมโดยประมาณ</p>
            <p className="text-sm font-bold text-brand-ink">{formatTHB(total)}</p>
          </div>
          <button
            type="submit"
            disabled={submitting || lines.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-full bg-brand-gradient text-white font-semibold px-5 py-2.5 text-xs shrink-0 active:scale-95 transition-transform disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "กำลังไป..." : "ไปหน้าชำระเงิน"}
          </button>
        </MobileStickyBar>
      </form>
    </div>
  );
}
