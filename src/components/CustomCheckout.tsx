"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Loader2, AlertTriangle, MapPin, QrCode, CreditCard, Award } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { formatTHB } from "@/lib/format";
import { pointsForAmount } from "@/data/coupons";
import AddressFields, { AddressFormValue, emptyAddressForm } from "@/components/account/AddressFields";
import type { AddressRow } from "@/app/api/account/addresses/route";
import MobileStickyBar from "@/components/MobileStickyBar";

// Paid directly through 2C2P (card + QR PromptPay) — the customer never
// leaves smoothlife.com for a Shopify-hosted checkout page. Real Shopify
// order only gets created once 2C2P confirms the charge (see the
// checkout-2c2p-plan.md milestone breakdown) — this page only ever
// initiates the payment, never marks anything paid itself.
export default function CustomCheckout() {
  const { lines } = useCart();
  const { user } = useAuth();
  const { lang } = useLang();
  // Deliberately not useOrderTotals() here — that hook applies coupon
  // discounts client-side, but /api/checkout/init doesn't validate/apply
  // coupons yet (coupon support on this flow is a follow-up, not this
  // milestone — see checkout-2c2p-plan.md). Showing a discounted total the
  // server then charges in full would be actively misleading about real
  // money, so this computes only what the server actually charges:
  // subtotal + flat shipping, no discount. The existing Shopify-checkout
  // fallback (used whenever 2C2P isn't configured, i.e. always today)
  // still fully supports coupons as before.
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const shipping = 0; // matches SHIPPING_FEE_THB in api/checkout/init — free nationwide, no minimum
  const total = subtotal + shipping;
  const points = pointsForAmount(total);
  const [address, setAddress] = useState<AddressFormValue>(emptyAddressForm);
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!user?.real) {
      setAddressLoaded(true);
      return;
    }
    fetch("/api/account/addresses")
      .then((r) => r.json())
      .then((data) => {
        const saved: AddressRow | undefined = data.addresses?.[0];
        if (saved) {
          setAddress({
            label: saved.label ?? "บ้าน",
            recipient_name: saved.recipient_name,
            phone: saved.phone,
            address_line: saved.address_line,
            subdistrict: saved.subdistrict,
            district: saved.district,
            province: saved.province,
            postal_code: saved.postal_code,
            country: saved.country,
            is_default: false,
          });
        }
      })
      .finally(() => setAddressLoaded(true));
  }, [user?.real]);

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

    const [firstName, ...rest] = address.recipient_name.trim().split(/\s+/);
    if (!address.recipient_name || !address.phone || !address.address_line || !address.postal_code) {
      setError("กรุณากรอกที่อยู่จัดส่งให้ครบ");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/init", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.qty })),
          email: user?.email || undefined,
          phone: address.phone,
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
      window.location.href = data.webPaymentUrl;
    } catch {
      setError("เริ่มการชำระเงินไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <div className="container-page py-8 md:py-10">
      <h1 className="text-2xl md:text-3xl font-bold text-brand-ink mb-2">ดำเนินการชำระเงิน</h1>
      {!user && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-xl2 border border-brand-teal/30 bg-brand-gradient-soft p-4 text-sm">
          <span className="text-slate-600">
            สั่งซื้อแบบไม่ต้องสมัครสมาชิกได้เลย — แต่จะไม่ได้แต้มสะสมและสิทธิ์สมาชิกจนกว่าจะสมัคร
          </span>
          <Link
            href="/account/login?returnTo=/checkout"
            className="shrink-0 rounded-full bg-brand-gradient text-white text-xs font-semibold px-4 py-2 whitespace-nowrap"
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      )}
      <form onSubmit={handleSubmit} className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
            <h2 className="font-bold text-brand-ink mb-4 flex items-center gap-2">
              <MapPin size={18} className="text-brand-emerald" /> ที่อยู่จัดส่ง
            </h2>
            {!addressLoaded ? (
              <p className="text-sm text-slate-400 flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> กำลังโหลด...
              </p>
            ) : (
              <AddressFields value={address} onChange={setAddress} showDefaultToggle={false} />
            )}
          </div>

          <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
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

          {error && (
            <div className="rounded-xl2 border border-rose-200 bg-rose-50 text-rose-700 text-sm p-4 flex items-start gap-2">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="rounded-xl2 border border-slate-100 p-5 h-fit shadow-card sticky top-[152px]">
          <h2 className="font-bold text-brand-ink mb-4">สรุปคำสั่งซื้อ</h2>
          <div className="flex flex-col gap-2 mb-4 max-h-56 overflow-y-auto">
            {lines.map((l) => (
              <div key={l.variantId} className="flex justify-between text-xs text-slate-600">
                <span className="line-clamp-1 pr-2">
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
          <div className="flex justify-between text-sm text-slate-600 mb-4">
            <span>ค่าจัดส่ง</span>
            <span>ฟรี</span>
          </div>
          <div className="flex justify-between font-bold text-brand-ink border-t border-slate-100 pt-4 mb-5">
            <span>ยอดรวมทั้งหมด</span>
            <span>{formatTHB(total)}</span>
          </div>
          <button
            ref={submitButtonRef}
            type="submit"
            disabled={submitting || !addressLoaded || lines.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-full bg-brand-gradient text-white font-semibold py-3 text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "กำลังไปหน้าชำระเงิน..." : "ชำระเงิน"}
          </button>
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
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">ยอดรวมทั้งหมด</p>
            <p className="text-sm font-bold text-brand-ink">{formatTHB(total)}</p>
          </div>
          <button
            type="submit"
            disabled={submitting || !addressLoaded || lines.length === 0}
            className="flex items-center justify-center gap-1.5 rounded-full bg-brand-gradient text-white font-semibold px-5 py-2.5 text-xs shrink-0 active:scale-95 transition-transform disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "กำลังไป..." : "ชำระเงิน"}
          </button>
        </MobileStickyBar>
      </form>
    </div>
  );
}
