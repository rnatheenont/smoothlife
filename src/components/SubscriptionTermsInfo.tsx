"use client";

import { useState } from "react";
import { CreditCard, Package, Percent, ChevronDown } from "lucide-react";
import { subscriptionPlans } from "@/data/subscriptions";

// Single source of truth for the billing/shipping/discount terms copy —
// used on /subscription (full 3-card layout), the product page, and
// account/subscriptions (both compact/collapsible) — so the wording never
// drifts out of sync between the three places it appears. Copy switches on
// billingEnabled (same subscriptionBillingConfigured() flag every subscribe surface
// already keys off) so it never describes real recurring billing while the
// site is still on the discount-code fallback.

function CycleTerms({ billingEnabled }: { billingEnabled: boolean }) {
  return billingEnabled ? (
    <ul className="text-sm text-slate-600 flex flex-col gap-1.5">
      <li>• ตัดเงินอัตโนมัติ<strong className="text-brand-ink">ทุกเดือนจนครบเทอมที่เลือก</strong> ในราคาที่ล็อกไว้ ไม่เปลี่ยนแปลงระหว่างทาง</li>
      <li>• ยกเลิกได้ทุกเมื่อที่หน้า &ldquo;การสมัครของฉัน&rdquo; — มีผล<strong className="text-brand-ink">เมื่อจบเทอมปัจจุบัน</strong> รอบที่เหลือในเทอมยังตัดเงินและจัดส่งตามปกติ ไม่มีค่าปรับ</li>
      <li>• <strong className="text-brand-ink">ยังไม่มีต่อเทอมอัตโนมัติ</strong> — ครบเทอมแล้วระบบปิดรายการให้เอง ไม่มีการตัดเงินต่อ สมัครใหม่ได้ทุกเมื่อ</li>
    </ul>
  ) : (
    <ul className="text-sm text-slate-600 flex flex-col gap-1.5">
      <li>• กด &ldquo;สมัคร&rdquo; ครั้งเดียว ระบบพาไปหน้าชำระเงินของ Shopify ทันที พร้อมจำนวนสินค้าตามรอบที่เลือกและส่วนลดให้อัตโนมัติ แยกจากตะกร้าปกติ</li>
      <li>• ต่ออายุอัตโนมัติยังไม่เปิดใช้งาน — ครบรอบแล้วกลับมาสมัครใหม่อีกครั้งได้เลย</li>
    </ul>
  );
}

function ShippingTerms({ billingEnabled }: { billingEnabled: boolean }) {
  return billingEnabled ? (
    <ul className="text-sm text-slate-600 flex flex-col gap-1.5">
      <li>• จัดส่ง<strong className="text-brand-ink">พร้อมกับทุกรอบที่ตัดเงินสำเร็จ</strong> ไม่ต้องรอแยกต่างหาก</li>
      <li>• ส่งฟรีทุกรอบ ทั่วไทย</li>
      <li>• เปลี่ยนที่อยู่จัดส่งได้ทุกเมื่อสำหรับรอบที่ยังไม่ถึงกำหนด</li>
    </ul>
  ) : (
    <ul className="text-sm text-slate-600 flex flex-col gap-1.5">
      <li>• จัดส่งตามคำสั่งซื้อปกติทันทีที่ชำระเงินสำเร็จ (ได้รับสินค้าตามจำนวนรอบที่เลือกในครั้งเดียว)</li>
      <li>• ส่งฟรีทุกออเดอร์</li>
    </ul>
  );
}

function DiscountTable({ billingEnabled }: { billingEnabled: boolean }) {
  return (
    <>
      <div className="flex flex-col gap-1.5 text-sm">
        {subscriptionPlans.map((p) => (
          <div key={p.months} className="flex items-center justify-between rounded-lg bg-surface-soft px-3 py-1.5">
            <span className="text-slate-600">ทุก {p.months} เดือน</span>
            <span className="font-bold text-brand-emerald">-{p.discountPct}%</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-2">
        ยิ่งเลือกเทอมยาว ยิ่งได้ส่วนลดต่อเดือนมากขึ้น {billingEnabled ? "และล็อกอัตรานี้ไว้ตลอดการสมัคร" : ""}
      </p>
    </>
  );
}

export default function SubscriptionTermsInfo({
  billingEnabled,
  variant = "full",
}: {
  billingEnabled: boolean;
  variant?: "full" | "compact";
}) {
  const [open, setOpen] = useState(false);

  if (variant === "compact") {
    return (
      <div className="rounded-xl2 border border-slate-100 bg-surface-soft/60 p-3.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between text-sm font-semibold text-brand-ink"
        >
          เงื่อนไขการสมัครสมาชิก — ตัดรอบ / จัดส่ง / ส่วนลด
          <ChevronDown size={16} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="mt-3 flex flex-col gap-4">
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-brand-ink mb-1.5">
                <CreditCard size={13} className="text-brand-emerald" /> ตัดรอบ
              </h4>
              <CycleTerms billingEnabled={billingEnabled} />
            </div>
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-brand-ink mb-1.5">
                <Package size={13} className="text-brand-emerald" /> การจัดส่ง
              </h4>
              <ShippingTerms billingEnabled={billingEnabled} />
            </div>
            <div>
              <h4 className="flex items-center gap-1.5 text-xs font-bold text-brand-ink mb-1.5">
                <Percent size={13} className="text-brand-emerald" /> ส่วนลด
              </h4>
              <DiscountTable billingEnabled={billingEnabled} />
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="container-page py-10 md:py-14 border-t border-slate-100">
      <h2 className="text-xl md:text-2xl font-extrabold text-brand-ink mb-1 text-center">เงื่อนไขการสมัครสมาชิก</h2>
      <p className="text-sm text-slate-500 mb-6 text-center">อ่านให้ครบก่อนสมัคร — ไม่มีเงื่อนไขซ่อนเร้น</p>
      <div className="grid sm:grid-cols-3 gap-4 md:gap-5">
        <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-3">
            <CreditCard size={18} />
          </div>
          <h3 className="font-bold text-brand-ink mb-2">ตัดรอบ</h3>
          <CycleTerms billingEnabled={billingEnabled} />
        </div>

        <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-3">
            <Package size={18} />
          </div>
          <h3 className="font-bold text-brand-ink mb-2">การจัดส่ง</h3>
          <ShippingTerms billingEnabled={billingEnabled} />
        </div>

        <div className="rounded-xl2 border border-slate-100 shadow-card p-5">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-gradient-soft text-brand-emerald mb-3">
            <Percent size={18} />
          </div>
          <h3 className="font-bold text-brand-ink mb-2">ส่วนลด</h3>
          <DiscountTable billingEnabled={billingEnabled} />
        </div>
      </div>
    </section>
  );
}
