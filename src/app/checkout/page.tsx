"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Ticket, Award, Loader2, AlertTriangle, MapPin, Receipt } from "lucide-react";
import { useCart } from "@/lib/cart-context";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { useOrderTotals } from "@/lib/use-order-totals";
import { formatTHB } from "@/lib/format";
import { cartCreate, shopifyConfigured, type CartDeliveryAddressInput } from "@/lib/shopify";
import { toE164Thai } from "@/lib/firebase-client";
import type { AddressRow } from "@/app/api/account/addresses/route";
import type { TaxAddressRow } from "@/app/api/account/tax-addresses/route";
import MobileStickyBar from "@/components/MobileStickyBar";

function toTaxInvoiceAttributes(addr: TaxAddressRow): { key: string; value: string }[] {
  return [
    { key: "ต้องการใบกำกับภาษี", value: "ต้องการ" },
    { key: "ชื่อ/บริษัท (ใบกำกับภาษี)", value: addr.recipient_name },
    { key: "เลขประจำตัวผู้เสียภาษี", value: addr.tax_id },
    {
      key: "ที่อยู่ใบกำกับภาษี",
      value: `${addr.address_line} ตำบล/แขวง${addr.subdistrict} เขต/อำเภอ${addr.district} จ.${addr.province} ${addr.postal_code}`,
    },
    { key: "โทรศัพท์ (ใบกำกับภาษี)", value: addr.phone },
  ];
}

// Our address book is Thai-specific (แขวง/ตำบล, เขต/อำเภอ, จังหวัด); Shopify's
// delivery address only has address1/address2/city/province/zip, so the
// subdistrict + district both fold into address2/city rather than being lost.
function toShopifyDeliveryAddress(addr: AddressRow): CartDeliveryAddressInput | null {
  if (addr.country !== "TH") return null;
  const [firstName, ...rest] = addr.recipient_name.trim().split(/\s+/);
  return {
    address1: addr.address_line,
    address2: addr.subdistrict ? `ตำบล/แขวง${addr.subdistrict}` : undefined,
    city: addr.district,
    provinceCode: addr.province,
    zip: addr.postal_code,
    countryCode: addr.country,
    firstName: firstName || undefined,
    lastName: rest.length ? rest.join(" ") : undefined,
    phone: addr.phone ? toE164Thai(addr.phone) : undefined,
  };
}

export default function CheckoutPage() {
  const { lines, subtotal, couponCode } = useCart();
  const { user } = useAuth();
  const { lang } = useLang();
  const totals = useOrderTotals();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultAddress, setDefaultAddress] = useState<AddressRow | null | undefined>(undefined);
  const [taxAddresses, setTaxAddresses] = useState<TaxAddressRow[]>([]);
  const [wantsTaxInvoice, setWantsTaxInvoice] = useState(false);
  const [selectedTaxAddressId, setSelectedTaxAddressId] = useState<string | null>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);
  const shippingFree = totals.freeShipping;
  const shipping = totals.shipping;
  const total = totals.total;

  useEffect(() => {
    if (!user?.real) return;
    fetch("/api/account/addresses")
      .then((r) => r.json())
      .then((data) => setDefaultAddress(data.addresses?.[0] || null))
      .catch(() => setDefaultAddress(null));
    fetch("/api/account/tax-addresses")
      .then((r) => r.json())
      .then((data) => {
        const list: TaxAddressRow[] = data.addresses || [];
        setTaxAddresses(list);
        if (list[0]) setSelectedTaxAddressId(list[0].id);
      })
      .catch(() => setTaxAddresses([]));
  }, [user?.real]);

  const selectedTaxAddress = taxAddresses.find((a) => a.id === selectedTaxAddressId) || null;

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
        totals.referralActive ? totals.referralDiscountCode : couponCode,
        user?.email || null,
        defaultAddress ? toShopifyDeliveryAddress(defaultAddress) : null,
        user?.phone ? toE164Thai(user.phone) : null,
        wantsTaxInvoice && selectedTaxAddress ? toTaxInvoiceAttributes(selectedTaxAddress) : undefined
      );
      window.location.href = cart.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "ไม่สามารถสร้างคำสั่งซื้อได้ กรุณาลองใหม่อีกครั้ง");
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
              <ShieldCheck size={18} className="text-brand-emerald" /> ที่อยู่จัดส่งและการชำระเงิน
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              คุณจะถูกนำไปยังหน้าชำระเงินที่ปลอดภัยของ Shopify เพื่อเลือกวิธีชำระเงิน
              (PromptPay, บัตรเครดิต/เดบิต หรือโอนเงินตามที่ร้านเปิดใช้งาน)
            </p>
            {defaultAddress && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-surface-soft p-3.5">
                <MapPin size={16} className="shrink-0 mt-0.5 text-brand-emerald" />
                <div className="text-xs text-slate-600 leading-relaxed">
                  <p className="font-semibold text-brand-ink mb-0.5">เติมที่อยู่จัดส่งให้อัตโนมัติ</p>
                  <p>
                    {defaultAddress.recipient_name} · {defaultAddress.phone}
                    <br />
                    {defaultAddress.address_line} ตำบล/แขวง{defaultAddress.subdistrict} เขต/อำเภอ
                    {defaultAddress.district} จ.{defaultAddress.province} {defaultAddress.postal_code}
                  </p>
                  <Link href="/account/addresses" target="_blank" className="text-brand-emerald font-semibold">
                    เปลี่ยนที่อยู่
                  </Link>
                </div>
              </div>
            )}
            {defaultAddress === null && (
              <p className="mt-4 text-xs text-slate-400">
                ยังไม่มีที่อยู่จัดส่งในระบบ — กรอกได้ที่หน้าชำระเงินของ Shopify โดยตรง
              </p>
            )}
          </div>

          {user?.real && (
            <div className="rounded-xl2 border border-slate-100 p-5 shadow-card">
              <h2 className="font-bold text-brand-ink mb-3 flex items-center gap-2">
                <Receipt size={18} className="text-brand-emerald" /> ใบกำกับภาษี
              </h2>
              <label className="flex items-start gap-2.5 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={wantsTaxInvoice}
                  onChange={(e) => setWantsTaxInvoice(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-emerald focus:ring-brand-emerald"
                />
                <span>ต้องการใบกำกับภาษีเต็มรูปสำหรับคำสั่งซื้อนี้</span>
              </label>

              {wantsTaxInvoice && taxAddresses.length === 0 && (
                <p className="mt-3 text-xs text-slate-400">
                  ยังไม่มีข้อมูลใบกำกับภาษีในระบบ —{" "}
                  <Link href="/account/tax-addresses/new" target="_blank" className="text-brand-emerald font-semibold">
                    เพิ่มข้อมูลใบกำกับภาษี
                  </Link>{" "}
                  ก่อนแล้วกลับมากดเลือกอีกครั้ง
                </p>
              )}

              {wantsTaxInvoice && taxAddresses.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {taxAddresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs cursor-pointer ${
                        selectedTaxAddressId === addr.id ? "border-brand-teal bg-brand-gradient-soft" : "border-slate-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="taxAddress"
                        checked={selectedTaxAddressId === addr.id}
                        onChange={() => setSelectedTaxAddressId(addr.id)}
                        className="mt-0.5 h-3.5 w-3.5 text-brand-emerald focus:ring-brand-emerald"
                      />
                      <span className="text-slate-600 leading-relaxed">
                        <span className="font-semibold text-brand-ink">
                          {addr.recipient_name} {addr.is_company && "(นิติบุคคล)"}
                        </span>
                        <br />
                        เลขผู้เสียภาษี {addr.tax_id}
                        <br />
                        {addr.address_line} ตำบล/แขวง{addr.subdistrict} เขต/อำเภอ{addr.district} จ.{addr.province}{" "}
                        {addr.postal_code}
                      </span>
                    </label>
                  ))}
                  <Link href="/account/tax-addresses/new" target="_blank" className="text-xs text-brand-emerald font-semibold">
                    + เพิ่มที่อยู่ใบกำกับภาษีใหม่
                  </Link>
                </div>
              )}
            </div>
          )}

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
                  {l.isGift && (
                    <span className="ml-1.5 inline-block align-middle text-[10px] font-semibold text-brand-emerald bg-brand-gradient-soft rounded px-1.5 py-0.5">
                      ของแถม
                    </span>
                  )}
                </span>
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
                <Ticket size={13} /> {totals.referralActive ? "ส่วนลดแนะนำเพื่อน" : totals.coupon?.code}
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
            {user
              ? lang === "en"
                ? `Estimated ${totals.points.toLocaleString()} points once payment is confirmed`
                : `คาดว่าจะได้รับ ${totals.points.toLocaleString()} คะแนน เมื่อชำระเงินสำเร็จ`
              : lang === "en"
                ? "Create an account to start earning points on this order"
                : "สมัครสมาชิกเพื่อรับคะแนนสะสมจากคำสั่งซื้อนี้"}
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
