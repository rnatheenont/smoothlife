"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, AlertTriangle, MapPin, QrCode, CreditCard, Award, Ticket, ChevronLeft, Lock } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { formatTHB } from "@/lib/format";
import { pointsForAmount } from "@/data/coupons";
import { AddressFormValue, emptyAddressForm } from "@/components/account/AddressFields";
import CheckoutAddressPicker from "@/components/CheckoutAddressPicker";
import PaymentModal from "@/components/PaymentModal";
import type { AddressRow } from "@/app/api/account/addresses/route";
import MobileStickyBar from "@/components/MobileStickyBar";
import CouponPicker from "@/components/CouponPicker";
import { Button } from "@/components/ui";
import { useLoginModal } from "@/lib/login-modal-context";

// Paid directly through 2C2P (card + QR PromptPay) — the customer never
// leaves smoothlife.com for a Shopify-hosted checkout page. Real Shopify
// order only gets created once 2C2P confirms the charge (see the
// checkout-2c2p-plan.md milestone breakdown) — this page only ever
// initiates the payment, never marks anything paid itself.
export default function CustomCheckout() {
  const { lines, couponQuote, clear } = useCart();
  const { user } = useAuth();
  const { open: openLogin } = useLoginModal();
  const { lang } = useLang();
  // Deliberately not useOrderTotals() here — that hook also layers in the
  // referral-cookie discount and the subscribe-flow's own SUB3/6/12 codes,
  // neither of which this one-time cart checkout supports (see
  // checkout-2c2p-plan.md's scoping notes). Coupons specifically ARE
  // supported, and the figure below is Shopify's own answer for this cart,
  // quoted in cart-context; /api/checkout/init asks Shopify the same
  // question again before charging, so what is shown here and what is
  // charged come from one calculation, not two.
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const applied = couponQuote?.ok ? couponQuote : null;
  const discount = applied ? applied.discount : 0;
  const netSubtotal = Math.max(0, subtotal - discount);
  const shipping = 0; // matches SHIPPING_FEE_THB in api/checkout/init — free nationwide, no minimum
  const total = netSubtotal + shipping;
  const points = pointsForAmount(total);
  // CheckoutAddressPicker owns loading and choosing saved addresses and hands
  // the chosen one up here; this is only ever the address the order ships to.
  const [address, setAddress] = useState<AddressFormValue>(emptyAddressForm);
  // Where the receipt and every "your parcel has shipped" goes. Seeded from
  // the account, but asked for outright when there is none: an account made
  // with a phone OTP has no email at all, and an order with nowhere to send
  // its own receipt leaves the phone as the only way to reach anybody.
  const [email, setEmail] = useState("");
  useEffect(() => {
    if (user?.email) setEmail((cur) => cur || user.email!);
  }, [user?.email]);
  const [submitting, setSubmitting] = useState(false);
  // Set once /api/checkout/init has a real 2C2P session — the payment then
  // happens in a frame over this page instead of navigating away, so the cart
  // and address stay put if the customer backs out.
  const [payment, setPayment] = useState<{ url: string; cartToken: string } | null>(null);
  // Trimmed, because a field holding one space is not a name — and the
  // district matters as much as the rest: the server needs it as the city,
  // so without it the button enabled and the only thing waiting was a
  // refusal. /api/checkout/init checks all of this again; this is only so
  // the refusal is a disabled button rather than a round trip.
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const addressReady = Boolean(
    emailOk &&
      address.recipient_name?.trim() &&
      address.phone?.replace(/\D/g, "").length >= 9 &&
      address.address_line?.trim() &&
      address.district?.trim() &&
      address.postal_code?.trim()
  );
  const [error, setError] = useState<string | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  if (lines.length === 0) {
    return (
      <div className="container-page py-20 text-center">
        <p className="text-slate-500">ตะกร้าของคุณว่างเปล่า</p>
        <Link href="/shop" className="inline-block mt-4 text-brand-800 font-semibold">เริ่มช้อป</Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const [firstName, ...rest] = address.recipient_name.trim().split(/\s+/);
    if (!firstName) {
      setError("กรุณากรอกชื่อผู้รับ");
      return;
    }
    if (!emailOk) {
      setError("กรุณากรอกอีเมลสำหรับรับใบเสร็จและแจ้งสถานะพัสดุ");
      return;
    }
    const phoneDigits = address.phone.replace(/\D/g, "");
    if (phoneDigits.length < 9 || phoneDigits.length > 10) {
      setError("กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (9–10 หลัก)");
      return;
    }
    if (!address.address_line.trim() || !address.district?.trim() || !address.postal_code.trim()) {
      setError("กรุณากรอกที่อยู่จัดส่งให้ครบ");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Gifts are display lines: our promos are display-only, so nothing on
          // Shopify's side zeroes them. Sending one would charge the shopper the
          // gift's real price — ฿950 for a "free" cleansing gel — and the app
          // that does grant gifts adds its own line at checkout anyway.
          lines: lines.filter((l) => !l.isGift).map((l) => ({ variantId: l.variantId, quantity: l.qty })),
          couponCode: applied ? applied.code : undefined,
          email: email.trim(),
          phone: phoneDigits,
          shippingAddress: {
            address1: address.address_line,
            city: address.district,
            state: address.province,
            postalCode: address.postal_code,
            countryCode: address.country,
            firstName: firstName || undefined,
            lastName: rest.length ? rest.join(" ") : undefined,
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || "เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        setSubmitting(false);
        return;
      }
      setPayment({ url: data.webPaymentUrl, cartToken: data.cartToken });
      setSubmitting(false);
    } catch {
      setError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink">ดำเนินการชำระเงิน</h1>
      {/* The way back. Changing your mind about a quantity on the last screen
          is ordinary, and without this the only route to it is the browser's
          own back button or the tab bar — neither of which says it is safe. */}
      <Link
        href="/cart"
        className="mb-2 -ml-1 inline-flex h-11 items-center gap-1 px-1 text-sm font-medium text-slate-500 transition-colors hover:text-brand-800"
      >
        <ChevronLeft size={15} aria-hidden /> กลับไปแก้ไขตะกร้า
      </Link>
      {!user ? (
        // Ordering requires an account. The gate lives here rather than in a
        // redirect so the cart is still behind it when the dialog closes —
        // and so the reason is on screen, instead of a bounce back to a page
        // they just came from.
        <div className="mx-auto max-w-[420px] rounded-xl2 border border-brand-teal/30 bg-brand-gradient-soft p-6 text-center shadow-card">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-white/70 text-brand-800">
            <Lock size={22} aria-hidden />
          </span>
          <h2 className="mt-3 text-base font-bold text-brand-ink">เข้าสู่ระบบก่อนสั่งซื้อ</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
            เพื่อให้ติดตามพัสดุ เก็บประวัติการสั่งซื้อ และสะสมแต้มของคำสั่งซื้อนี้ได้
            ถ้ายังไม่มีบัญชี กรอกเบอร์โทรรับ OTP ระบบจะสมัครให้อัตโนมัติ
          </p>
          <Button type="button" size="lg" fullWidth className="mt-5" onClick={() => openLogin("/checkout")}>
            เข้าสู่ระบบ / สมัครสมาชิก
          </Button>
          <Link
            href="/cart"
            className="mt-1 inline-flex h-11 items-center px-2 text-sm font-medium text-slate-500 transition-colors hover:text-brand-800"
          >
            กลับไปที่ตะกร้า
          </Link>
        </div>
      ) : (
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded-xl2 p-5 shadow-card">
            <h2 className="font-bold text-brand-ink mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-brand-emerald" /> ที่อยู่จัดส่ง
            </h2>
            <CheckoutAddressPicker value={address} onChange={setAddress} canSave={Boolean(user?.real)} />

            {/* Under the address rather than in its own card: it is the
                third way to reach this order, beside the name and the
                number, and a card of its own would read as a newsletter
                box. */}
            <label className="mt-4 block">
              <span className="text-xs font-semibold text-slate-500">
                อีเมลสำหรับรับใบเสร็จและแจ้งสถานะพัสดุ
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                inputMode="email"
                required
                aria-invalid={email.length > 0 && !emailOk}
                className="mt-1 w-full rounded-xl2 bg-surface-soft px-4 py-3 text-sm outline-hidden focus:ring-2 focus:ring-brand-teal/40"
              />
              {email.length > 0 && !emailOk && (
                <span className="mt-1 block text-xs text-rose-600">รูปแบบอีเมลไม่ถูกต้อง</span>
              )}
            </label>
          </div>

          <div className="rounded-xl2 p-5 shadow-card">
            <h2 className="font-bold text-brand-ink mb-3 flex items-center gap-2">
              <ShieldCheck size={18} className="text-brand-emerald" /> วิธีชำระเงิน
            </h2>
            <p className="text-sm text-slate-600 mb-3">เลือกวิธีชำระเงินในขั้นตอนถัดไป — รองรับบัตรเครดิต/เดบิต และ QR PromptPay</p>
            <div className="flex gap-3">
              <span className="flex items-center gap-1.5 rounded-lg bg-surface-soft px-3 py-2 text-xs font-semibold text-slate-600">
                <CreditCard size={14} /> บัตรเครดิต/เดบิต
              </span>
              <span className="flex items-center gap-1.5 rounded-lg bg-surface-soft px-3 py-2 text-xs font-semibold text-slate-600">
                <QrCode size={14} /> QR PromptPay
              </span>
            </div>
          </div>

          <CouponPicker />

          {error && (
            <div className="rounded-xl2 border border-rose-200 bg-rose-50 text-rose-700 text-sm p-4 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl2 p-5 h-fit shadow-card sticky top-[152px]">
          <h2 className="font-bold text-brand-ink mb-4">สรุปคำสั่งซื้อ</h2>
          <div className="flex flex-col gap-2 mb-4 max-h-56 overflow-y-auto">
            {lines.map((l) => (
              <div key={l.variantId} className="flex justify-between text-xs text-slate-600">
                <span translate="no" className="line-clamp-1 pr-2">
                  {l.name} x{l.qty}
                </span>
                <span className="shrink-0">{formatTHB(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-sm text-slate-600 mb-2">
            <span>ยอดรวมสินค้า</span>
            <span>{formatTHB(subtotal)}</span>
          </div>
          {applied && (
            <div className="flex justify-between text-sm text-brand-800 mb-2">
              <span className="flex items-center gap-1">
                <Ticket size={13} /> คูปอง {applied.code}
              </span>
              <span>-{formatTHB(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm text-slate-600 mb-4">
            <span>ค่าจัดส่ง</span>
            <span>ฟรี</span>
          </div>
          <div className="flex justify-between font-bold text-brand-ink border-t border-slate-100 pt-4 mb-5">
            <span>ยอดรวมทั้งหมด</span>
            <span>{formatTHB(total)}</span>
          </div>
          <Button size="lg" fullWidth ref={submitButtonRef} type="submit" disabled={submitting || !addressReady || lines.length === 0}>
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "กำลังไปหน้าชำระเงิน…" : "ชำระเงิน"}
          </Button>
          <p className="text-[11px] text-slate-500 mt-3 text-center flex items-center justify-center gap-1.5">
            <Award size={12} className="text-amber-500" />
            {user
              ? lang === "en"
                ? `Estimated ${points.toLocaleString()} points once payment is confirmed`
                : `คาดว่าจะได้รับ ${points.toLocaleString()} คะแนน เมื่อชำระเงินสำเร็จ`
              : lang === "en"
                ? "Create an account to start earning points on this order"
                : "สมัครสมาชิกเพื่อรับคะแนนสะสมจากคำสั่งซื้อนี้"}
          </p>
        </div>

        <MobileStickyBar hideWhenVisible={submitButtonRef}>
          <div className="min-w-0 shrink-0">
            <p className="text-[11px] text-slate-500">ยอดรวมทั้งหมด</p>
            <p className="text-base font-bold leading-tight text-brand-ink">{formatTHB(total)}</p>
          </div>
          {/* The only action on the screen, at the size that says so — it was
              a 36px button sharing the row with the total. Same bar as the
              cart's, so the two screens hand over to each other. */}
          <Button
            size="lg"
            className="min-w-0 flex-1 active:scale-95"
            type="submit"
            disabled={submitting || !addressReady || lines.length === 0}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "กำลังไป…" : "ชำระเงิน"}
          </Button>
        </MobileStickyBar>
      </form>
      )}

      {payment && (
        <PaymentModal
          webPaymentUrl={payment.url}
          cartToken={payment.cartToken}
          onClose={() => setPayment(null)}
          // What is being paid for, so the payment frame is not the only thing
          // on screen — and so the success screen can list it back.
          summary={{ total, items: lines.map((l) => ({ name: l.name, quantity: l.qty })) }}
          // Only fires once our own backend confirms the charge, so emptying
          // the cart here can't strand a customer whose payment actually failed.
          onPaid={clear}
        />
      )}
    </div>
  );
}
